import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WooCommerceMultiStoreService } from './woocommerce-multistore.service';

/**
 * Service to handle automatic synchronization of products to WooCommerce
 * when products, attributes, or assets are updated
 */
@Injectable()
export class WooCommerceAutoSyncService {
  private readonly logger = new Logger(WooCommerceAutoSyncService.name);

  constructor(
    private prisma: PrismaService,
    private multiStoreService: WooCommerceMultiStoreService,
  ) {}

  /**
   * Automatically sync a product to all its connected WooCommerce stores
   * This is called when a product is updated
   */
  async autoSyncProductUpdate(
    productId: number,
    userId: number,
  ): Promise<void> {
    try {
      // Find all WooCommerce connections where this product has been synced
      const syncRecords = await this.prisma.wooCommerceProductSync.findMany({
        where: {
          productId,
        },
        include: {
          connection: {
            select: {
              id: true,
              storeName: true,
              userId: true,
            },
          },
        },
      });

      if (syncRecords.length === 0) {
        this.logger.log(`Product ${productId} has no WooCommerce sync records, skipping auto-sync`);
        return;
      }

      this.logger.log(
        `Auto-syncing product ${productId} to ${syncRecords.length} WooCommerce connection(s)`,
      );

      // Update product in each connection
      const syncPromises = syncRecords.map(async (syncRecord) => {
        try {
          // Verify the connection belongs to the same user
          if (syncRecord.connection.userId !== userId) {
            this.logger.warn(
              `Skipping auto-sync for connection ${syncRecord.connectionId} - user mismatch`,
            );
            return;
          }

          await this.multiStoreService.updateProduct(
            userId,
            syncRecord.connectionId,
            productId,
          );

          this.logger.log(
            `Successfully auto-synced product ${productId} to connection ${syncRecord.connection.storeName}`,
          );
        } catch (error: any) {
          this.logger.error(
            `Failed to auto-sync product ${productId} to connection ${syncRecord.connectionId}: ${error.message}`,
          );
          // Continue with other connections even if one fails
        }
      });

      await Promise.allSettled(syncPromises);
    } catch (error: any) {
      this.logger.error(
        `Error in auto-sync for product ${productId}: ${error.message}`,
      );
      // Don't throw - we don't want to break the product update if sync fails
    }
  }

  /**
   * Delete WooCommerce sync records when a product is deleted
   * This keeps the sync data clean
   */
  async cleanupProductSyncData(productId: number): Promise<void> {
    try {
      this.logger.log(`Cleaning up WooCommerce sync data for product ${productId}`);

      const deleted = await this.prisma.wooCommerceProductSync.deleteMany({
        where: {
          productId,
        },
      });

      this.logger.log(
        `Deleted ${deleted.count} WooCommerce sync record(s) for product ${productId}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to cleanup sync data for product ${productId}: ${error.message}`,
      );
      // Don't throw - this is cleanup operation
    }
  }

  /**
   * Auto-sync when product attributes are updated
   */
  async autoSyncAttributeUpdate(
    productId: number,
    userId: number,
  ): Promise<void> {
    // Attribute updates should trigger the same sync as product updates
    await this.autoSyncProductUpdate(productId, userId);
  }

  /**
   * Auto-sync when product assets are updated
   */
  async autoSyncAssetUpdate(
    productId: number,
    userId: number,
  ): Promise<void> {
    // Asset updates should trigger the same sync as product updates
    await this.autoSyncProductUpdate(productId, userId);
  }
}
