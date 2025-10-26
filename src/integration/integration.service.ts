import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { WooCommerceService } from './woocommerce/woocommerce.service';
import { WooCommerceIntegrationResultDto } from './woocommerce/dto/woocommerce.dto';

/**
 * Legacy IntegrationService - kept for backward compatibility
 * @deprecated Use WooCommerceService directly instead
 */
@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private woocommerceService: WooCommerceService,
  ) {}

  /**
   * @deprecated Use woocommerceService.exportProducts() instead
   */
  async syncProductsToWooCommerce(
    productIds: number[],
    userId: number,
  ): Promise<{
    syncedCount: number;
    failedCount: number;
    woocommerceTotal?: number;
    results: WooCommerceIntegrationResultDto[];
  }> {
    this.logger.warn('IntegrationService.syncProductsToWooCommerce is deprecated. Use WooCommerceService.exportProducts instead.');
    
    const result = await this.woocommerceService.exportProducts(productIds, userId);
    const woocommerceTotal = await this.woocommerceService.getWooCommerceProductCount();

    return {
      syncedCount: result.syncedCount,
      failedCount: result.failedCount,
      woocommerceTotal,
      results: result.results.map((r) => ({
        productId: r.productId,
        status: r.status,
        wooProductId: r.externalProductId ? parseInt(r.externalProductId) : undefined,
        message: r.message,
      })),
    };
  }
}