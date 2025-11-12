import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { IntegrationType, IntegrationOperation, IntegrationStatus } from './integration-type.enum';

export interface IntegrationLogData {
  productId: number;
  integrationType: IntegrationType;
  operation: IntegrationOperation;
  status: IntegrationStatus;
  message?: string;
  errorDetails?: any;
  externalProductId?: string;
  externalSku?: string;
  metadata?: any;
  userId: number;
}

export interface ProductSyncResult {
  productId: number;
  status: 'success' | 'error';
  externalProductId?: string;
  message?: string;
}

@Injectable()
export abstract class BaseIntegrationService {
  protected readonly logger: Logger;
  protected abstract integrationType: IntegrationType;

  constructor(
    protected prisma: PrismaService,
    protected configService: ConfigService,
  ) {
    this.logger = new Logger(this.constructor.name);
  }

  /**
   * Connect/initialize integration with credentials from .env
   */
  abstract connect(): Promise<void> | void;

  /**
   * Export a single product to the external platform
   */
  abstract exportProduct(productId: number, userId: number): Promise<ProductSyncResult>;

  /**
   * Update an existing product on the external platform
   */
  abstract updateProduct(productId: number, userId: number): Promise<ProductSyncResult>;

  /**
   * Delete a product from the external platform
   */
  abstract deleteProduct(productId: number, userId: number): Promise<ProductSyncResult>;

  /**
   * Pull updates from the external platform
   */
  abstract pullUpdates(userId: number): Promise<any>;

  /**
   * Handle incoming webhook data
   */
  abstract handleWebhook(data: any, userId?: number): Promise<any>;

  /**
   * Validate webhook signature
   */
  abstract validateWebhookSignature(headers: any, body: any, userId?: number): Promise<boolean>;

  /**
   * Record integration log entry
   */
  async recordIntegrationLog(data: IntegrationLogData): Promise<void> {
    try {
      await this.prisma.integrationLog.create({
        data: {
          productId: data.productId,
          integrationType: data.integrationType,
          operation: data.operation,
          status: data.status,
          message: data.message,
          errorDetails: data.errorDetails,
          externalProductId: data.externalProductId,
          externalSku: data.externalSku,
          metadata: data.metadata,
          userId: data.userId,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to record integration log: ${error.message}`);
    }
  }

  /**
   * Fetch product with all related data
   */
  protected async fetchProductWithRelations(productId: number, userId: number) {
    return await this.prisma.product.findFirst({
      where: {
        id: productId,
        userId,
      },
      include: {
        category: true,
        attributes: {
          include: {
            attribute: true,
          },
        },
        assets: {
          include: {
            asset: true,
          },
        },
        variants: true,
      },
    });
  }

  /**
   * Find product by SKU
   */
  protected async findProductBySku(sku: string, userId: number) {
    return await this.prisma.product.findFirst({
      where: {
        sku,
        userId,
      },
    });
  }

  /**
   * Find product by external ID
   */
  protected async findProductByExternalId(externalId: string, userId: number) {
    const log = await this.prisma.integrationLog.findFirst({
      where: {
        externalProductId: externalId,
        integrationType: this.integrationType,
        userId,
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    return log ? log.productId : null;
  }

  /**
   * Batch export products
   */
  async exportProducts(productIds: number[], userId: number): Promise<{
    syncedCount: number;
    failedCount: number;
    results: ProductSyncResult[];
  }> {
    const results: ProductSyncResult[] = [];
    let syncedCount = 0;
    let failedCount = 0;

    for (const productId of productIds) {
      try {
        const result = await this.exportProduct(productId, userId);
        results.push(result);

        if (result.status === 'success') {
          syncedCount++;
        } else {
          failedCount++;
        }
      } catch (error) {
        this.logger.error(`Failed to export product ${productId}:`, error);
        results.push({
          productId,
          status: 'error',
          message: error.message || 'Unknown error occurred',
        });
        failedCount++;
      }
    }

    return {
      syncedCount,
      failedCount,
      results,
    };
  }
}
