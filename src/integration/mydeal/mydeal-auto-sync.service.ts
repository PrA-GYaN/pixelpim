import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MyDealService } from './mydeal.service';

/**
 * Service to handle automatic synchronization of products to MyDeal
 * when products, attributes, or assets are updated
 */
@Injectable()
export class MyDealAutoSyncService {
  private readonly logger = new Logger(MyDealAutoSyncService.name);

  constructor(
    private prisma: PrismaService,
    private mydealService: MyDealService,
  ) {}

  /**
   * Automatically sync a product to MyDeal when it's updated
   * This is called when a product is updated
   */
  async autoSyncProductUpdate(
    productId: number,
    userId: number,
  ): Promise<void> {
    try {
      // Check if this product has been synced to MyDeal before
      const syncRecords = await this.prisma.integrationLog.findMany({
        where: {
          productId,
          userId,
          integrationType: 'mydeal',
          status: 'success',
        },
        orderBy: {
          timestamp: 'desc',
        },
        take: 1,
      });

      if (syncRecords.length === 0) {
        this.logger.log(`Product ${productId} has no MyDeal sync records, skipping auto-sync`);
        return;
      }

      this.logger.log(`Auto-syncing product ${productId} to MyDeal`);

      // Update product in MyDeal
      await this.mydealService.updateProduct(productId, userId);

      this.logger.log(`Successfully auto-synced product ${productId} to MyDeal`);
    } catch (error: any) {
      this.logger.error(
        `Error in auto-sync for product ${productId}: ${error.message}`,
      );
      // Don't throw - we don't want to break the product update if sync fails
    }
  }

  /**
   * Delete MyDeal sync records when a product is deleted
   * This keeps the sync data clean
   */
  async cleanupProductSyncData(productId: number): Promise<void> {
    try {
      this.logger.log(`Cleaning up MyDeal sync data for product ${productId}`);

      const deleted = await this.prisma.integrationLog.deleteMany({
        where: {
          productId,
          integrationType: 'mydeal',
        },
      });

      this.logger.log(`Deleted ${deleted.count} MyDeal sync records for product ${productId}`);
    } catch (error: any) {
      this.logger.error(
        `Error cleaning up sync data for product ${productId}: ${error.message}`,
      );
    }
  }

  /**
   * Enable auto-sync for a product
   */
  async enableAutoSync(productId: number, userId: number): Promise<void> {
    this.logger.log(`Enabling auto-sync for product ${productId} to MyDeal`);
    
    // Auto-sync is enabled by default when a product is exported
    // This method can be used to add additional metadata if needed
  }

  /**
   * Disable auto-sync for a product
   */
  async disableAutoSync(productId: number, userId: number): Promise<void> {
    this.logger.log(`Disabling auto-sync for product ${productId} to MyDeal`);
    
    // Mark the product as not synced by removing sync records
    await this.cleanupProductSyncData(productId);
  }

  /**
   * Check if a product has auto-sync enabled
   */
  async isAutoSyncEnabled(productId: number, userId: number): Promise<boolean> {
    const syncRecords = await this.prisma.integrationLog.findMany({
      where: {
        productId,
        userId,
        integrationType: 'mydeal',
        status: 'success',
      },
      take: 1,
    });

    return syncRecords.length > 0;
  }

  /**
   * Bulk sync multiple products to MyDeal
   */
  async bulkSyncProducts(productIds: number[], userId: number): Promise<void> {
    this.logger.log(`Bulk syncing ${productIds.length} products to MyDeal`);

    const results = await this.mydealService.exportProducts(productIds, userId);

    this.logger.log(
      `Bulk sync complete: ${results.syncedCount} succeeded, ${results.failedCount} failed`,
    );
  }
}
