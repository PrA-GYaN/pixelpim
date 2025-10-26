import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { BaseIntegrationService, ProductSyncResult } from '../base/base-integration.service';
import { IntegrationType, IntegrationOperation, IntegrationStatus } from '../base/integration-type.enum';
import * as crypto from 'crypto';

// Amazon SP-API client
const SellingPartner = require('amazon-sp-api');

@Injectable()
export class AmazonService extends BaseIntegrationService {
  protected integrationType = IntegrationType.AMAZON;
  private spApi: any;
  private webhookSecret: string | undefined;
  private region: string;

  constructor(
    protected prisma: PrismaService,
    protected configService: ConfigService,
  ) {
    super(prisma, configService);
    this.connect();
  }

  async connect(): Promise<void> {
    const clientId = this.configService.get<string>('AMZ_CLIENT_ID');
    const clientSecret = this.configService.get<string>('AMZ_CLIENT_SECRET');
    const refreshToken = this.configService.get<string>('AMZ_REFRESH_TOKEN');
    this.region = this.configService.get<string>('AMZ_REGION') || 'us-east-1';
    this.webhookSecret = this.configService.get<string>('AMZ_WEBHOOK_SECRET');

    if (!clientId || !clientSecret || !refreshToken) {
      this.logger.error('Amazon credentials not configured in .env');
      throw new Error('Amazon credentials not configured');
    }

    try {
      this.spApi = new SellingPartner({
        region: this.region,
        refresh_token: refreshToken,
        credentials: {
          SELLING_PARTNER_APP_CLIENT_ID: clientId,
          SELLING_PARTNER_APP_CLIENT_SECRET: clientSecret,
        },
      });

      this.logger.log('Amazon SP-API integration initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Amazon SP-API:', error);
      throw error;
    }
  }

  async exportProduct(productId: number, userId: number): Promise<ProductSyncResult> {
    try {
      const product = await this.fetchProductWithRelations(productId, userId);

      if (!product) {
        throw new BadRequestException(`Product with ID ${productId} not found`);
      }

      if (!product.sku) {
        throw new BadRequestException(`Product ${productId} is missing SKU`);
      }

      // Transform product for Amazon Listings API
      const amazonListing = this.transformProductToAmazon(product);

      // Submit feed to create/update listing
      const result = await this.submitListingFeed(amazonListing);

      await this.recordIntegrationLog({
        productId,
        integrationType: this.integrationType,
        operation: IntegrationOperation.EXPORT,
        status: IntegrationStatus.SUCCESS,
        message: 'Product exported to Amazon successfully',
        externalProductId: result.asin,
        externalSku: product.sku,
        metadata: { feedId: result.feedId },
        userId,
      });

      return {
        productId,
        status: 'success',
        externalProductId: result.asin,
      };
    } catch (error) {
      this.logger.error(`Export failed for product ${productId}:`, error);

      await this.recordIntegrationLog({
        productId,
        integrationType: this.integrationType,
        operation: IntegrationOperation.EXPORT,
        status: IntegrationStatus.ERROR,
        message: error.message,
        errorDetails: { stack: error.stack },
        userId,
      });

      return {
        productId,
        status: 'error',
        message: error.message,
      };
    }
  }

  async updateProduct(productId: number, userId: number): Promise<ProductSyncResult> {
    return this.exportProduct(productId, userId);
  }

  async deleteProduct(productId: number, userId: number): Promise<ProductSyncResult> {
    try {
      const product = await this.fetchProductWithRelations(productId, userId);
      
      if (!product) {
        throw new BadRequestException(`Product with ID ${productId} not found`);
      }

      // Delete listing on Amazon (set quantity to 0)
      await this.deleteAmazonListing(product.sku);

      await this.recordIntegrationLog({
        productId,
        integrationType: this.integrationType,
        operation: IntegrationOperation.DELETE,
        status: IntegrationStatus.SUCCESS,
        message: 'Product deleted from Amazon successfully',
        externalSku: product.sku,
        userId,
      });

      return {
        productId,
        status: 'success',
      };
    } catch (error) {
      this.logger.error(`Delete failed for product ${productId}:`, error);
      return {
        productId,
        status: 'error',
        message: error.message,
      };
    }
  }

  async pullUpdates(userId: number): Promise<any> {
    try {
      // Fetch inventory from Amazon
      const inventory = await this.getAmazonInventory();
      const updates: Array<{ productId: number; action: string }> = [];

      for (const item of inventory) {
        try {
          const localProduct = await this.findProductBySku(item.sku, userId);
          
          if (localProduct) {
            // Update existing product
            await this.updateLocalProduct(localProduct.id, item, userId);
            updates.push({ productId: localProduct.id, action: 'updated' });
          } else {
            // Create new product
            const newProduct = await this.createLocalProduct(item, userId);
            updates.push({ productId: newProduct.id, action: 'created' });
          }
        } catch (error) {
          this.logger.error(`Failed to sync Amazon product ${item.sku}:`, error);
        }
      }

      return {
        success: true,
        syncedCount: updates.length,
        updates,
      };
    } catch (error) {
      this.logger.error('Failed to pull updates from Amazon:', error);
      throw error;
    }
  }

  validateWebhookSignature(headers: any, body: any): boolean {
    if (!this.webhookSecret) {
      this.logger.warn('AMZ_WEBHOOK_SECRET not configured, skipping signature validation');
      return true;
    }

    const signature = headers['x-amz-sns-signature'];
    if (!signature) {
      this.logger.warn('No Amazon webhook signature found in headers');
      return false;
    }

    // Amazon SNS signature validation
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('base64');

    return signature === expectedSignature;
  }

  async handleWebhook(data: any, userId?: number): Promise<any> {
    try {
      const notificationType = data.notificationType || data.NotificationType;
      const payload = data.payload || data.Payload;

      this.logger.log(`Handling Amazon webhook: ${notificationType}`);

      switch (notificationType) {
        case 'INVENTORY_UPDATE':
          return await this.handleInventoryUpdate(payload, userId);
        case 'PRICE_CHANGE':
          return await this.handlePriceChange(payload, userId);
        case 'LISTINGS_ITEM_STATUS_CHANGE':
          return await this.handleListingStatusChange(payload, userId);
        default:
          this.logger.warn(`Unhandled webhook notification type: ${notificationType}`);
          return { success: false, message: 'Unhandled notification type' };
      }
    } catch (error) {
      this.logger.error('Amazon webhook handling error:', error);
      throw error;
    }
  }

  private async handleInventoryUpdate(payload: any, userId?: number): Promise<any> {
    const sku = payload.sku || payload.sellerSku;
    const quantity = payload.quantity || payload.availableQuantity;

    if (!userId) {
      // Try to find userId from integration logs
      const log = await this.prisma.integrationLog.findFirst({
        where: {
          externalSku: sku,
          integrationType: this.integrationType,
        },
        orderBy: { timestamp: 'desc' },
      });
      userId = log?.userId;
    }

    if (!userId) {
      this.logger.warn('Cannot update inventory: userId not found');
      return { success: false, message: 'User ID not found' };
    }

    const localProduct = await this.findProductBySku(sku, userId);
    
    if (!localProduct) {
      this.logger.warn(`Product with SKU ${sku} not found locally`);
      return { success: false, message: 'Product not found' };
    }

    // Update product attribute for stock quantity
    await this.updateProductStockAttribute(localProduct.id, quantity, userId);

    await this.recordIntegrationLog({
      productId: localProduct.id,
      integrationType: this.integrationType,
      operation: IntegrationOperation.WEBHOOK,
      status: IntegrationStatus.SUCCESS,
      message: 'Inventory updated from Amazon',
      externalSku: sku,
      metadata: { quantity },
      userId,
    });

    return { success: true, productId: localProduct.id };
  }

  private async handlePriceChange(payload: any, userId?: number): Promise<any> {
    const sku = payload.sku || payload.sellerSku;
    const price = payload.price || payload.listPrice;

    if (!userId) {
      const log = await this.prisma.integrationLog.findFirst({
        where: {
          externalSku: sku,
          integrationType: this.integrationType,
        },
        orderBy: { timestamp: 'desc' },
      });
      userId = log?.userId;
    }

    if (!userId) {
      return { success: false, message: 'User ID not found' };
    }

    const localProduct = await this.findProductBySku(sku, userId);
    
    if (!localProduct) {
      return { success: false, message: 'Product not found' };
    }

    // Update product attribute for price
    await this.updateProductPriceAttribute(localProduct.id, price, userId);

    await this.recordIntegrationLog({
      productId: localProduct.id,
      integrationType: this.integrationType,
      operation: IntegrationOperation.WEBHOOK,
      status: IntegrationStatus.SUCCESS,
      message: 'Price updated from Amazon',
      externalSku: sku,
      metadata: { price },
      userId,
    });

    return { success: true, productId: localProduct.id };
  }

  private async handleListingStatusChange(payload: any, userId?: number): Promise<any> {
    const sku = payload.sku || payload.sellerSku;
    const status = payload.status;

    if (!userId) {
      const log = await this.prisma.integrationLog.findFirst({
        where: {
          externalSku: sku,
          integrationType: this.integrationType,
        },
        orderBy: { timestamp: 'desc' },
      });
      userId = log?.userId;
    }

    if (!userId) {
      return { success: false, message: 'User ID not found' };
    }

    const localProduct = await this.findProductBySku(sku, userId);
    
    if (!localProduct) {
      return { success: false, message: 'Product not found' };
    }

    // Update product status
    await this.prisma.product.update({
      where: { id: localProduct.id },
      data: { status: status === 'ACTIVE' ? 'complete' : 'incomplete' },
    });

    await this.recordIntegrationLog({
      productId: localProduct.id,
      integrationType: this.integrationType,
      operation: IntegrationOperation.WEBHOOK,
      status: IntegrationStatus.SUCCESS,
      message: 'Listing status updated from Amazon',
      externalSku: sku,
      metadata: { status },
      userId,
    });

    return { success: true, productId: localProduct.id };
  }

  private async createLocalProduct(amazonItem: any, userId: number) {
    const productData: any = {
      name: amazonItem.productName || amazonItem.itemName,
      sku: amazonItem.sku || amazonItem.sellerSku,
      imageUrl: amazonItem.mainImage,
      status: 'complete',
      userId,
    };

    const product = await this.prisma.product.create({
      data: productData,
    });

    await this.recordIntegrationLog({
      productId: product.id,
      integrationType: this.integrationType,
      operation: IntegrationOperation.WEBHOOK,
      status: IntegrationStatus.SUCCESS,
      message: 'Product imported from Amazon',
      externalProductId: amazonItem.asin,
      externalSku: amazonItem.sku || amazonItem.sellerSku,
      metadata: { price: amazonItem.price, quantity: amazonItem.quantity },
      userId,
    });

    return product;
  }

  private async updateLocalProduct(productId: number, amazonItem: any, userId: number) {
    await this.prisma.product.update({
      where: { id: productId },
      data: {
        name: amazonItem.productName || amazonItem.itemName,
        imageUrl: amazonItem.mainImage,
      },
    });

    await this.recordIntegrationLog({
      productId,
      integrationType: this.integrationType,
      operation: IntegrationOperation.WEBHOOK,
      status: IntegrationStatus.SUCCESS,
      message: 'Product updated from Amazon',
      externalProductId: amazonItem.asin,
      externalSku: amazonItem.sku || amazonItem.sellerSku,
      metadata: { price: amazonItem.price, quantity: amazonItem.quantity },
      userId,
    });

    return { success: true, productId };
  }

  private transformProductToAmazon(product: any): any {
    // Extract price from attributes
    let price = '0';
    const priceAttr = product.attributes?.find((attr: any) =>
      attr.attribute.name.toLowerCase().includes('price')
    );
    if (priceAttr && priceAttr.value) {
      price = priceAttr.value.replace(/[^\d.]/g, '');
    }

    // Extract quantity from attributes
    let quantity = 0;
    const quantityAttr = product.attributes?.find((attr: any) =>
      attr.attribute.name.toLowerCase().includes('quantity') ||
      attr.attribute.name.toLowerCase().includes('stock')
    );
    if (quantityAttr && quantityAttr.value) {
      quantity = parseInt(quantityAttr.value) || 0;
    }

    return {
      sku: product.sku,
      productName: product.name,
      price: price,
      quantity: quantity,
      mainImage: product.imageUrl,
      description: this.generateProductDescription(product),
      // Add more Amazon-specific fields as needed
    };
  }

  private generateProductDescription(product: any): string {
    let description = product.name;

    if (product.attributes && product.attributes.length > 0) {
      description += '\n\nAttributes:\n';
      product.attributes.forEach((attr: any) => {
        if (attr.value) {
          description += `- ${attr.attribute.name}: ${attr.value}\n`;
        }
      });
    }

    return description;
  }

  private async submitListingFeed(listing: any): Promise<{ feedId: string; asin?: string }> {
    try {
      // Use Amazon SP-API to submit listing feed
      // This is a simplified example - actual implementation depends on product type
      const feed = await this.spApi.callAPI({
        operation: 'createFeed',
        endpoint: 'feeds',
        body: {
          feedType: 'POST_PRODUCT_DATA',
          marketplaceIds: [this.getMarketplaceId()],
          inputFeedDocumentId: listing.sku,
        },
      });

      return {
        feedId: feed.feedId,
        asin: listing.asin,
      };
    } catch (error) {
      this.logger.error('Failed to submit Amazon listing feed:', error);
      throw error;
    }
  }

  private async deleteAmazonListing(sku: string): Promise<void> {
    try {
      // Set inventory to 0 to effectively remove the listing
      await this.spApi.callAPI({
        operation: 'patchListingsItem',
        endpoint: 'listings',
        path: {
          sellerId: this.configService.get<string>('AMZ_SELLER_ID'),
          sku: sku,
        },
        body: {
          productType: 'PRODUCT',
          patches: [
            {
              op: 'replace',
              path: '/attributes/fulfillment_availability',
              value: [
                {
                  fulfillment_channel_code: 'DEFAULT',
                  quantity: 0,
                },
              ],
            },
          ],
        },
      });
    } catch (error) {
      this.logger.error(`Failed to delete Amazon listing ${sku}:`, error);
      throw error;
    }
  }

  private async getAmazonInventory(): Promise<any[]> {
    try {
      const response = await this.spApi.callAPI({
        operation: 'getInventorySummaries',
        endpoint: 'fbaInventory',
        query: {
          granularityType: 'Marketplace',
          granularityId: this.getMarketplaceId(),
          marketplaceIds: [this.getMarketplaceId()],
        },
      });

      return response.inventorySummaries || [];
    } catch (error) {
      this.logger.error('Failed to fetch Amazon inventory:', error);
      throw error;
    }
  }

  private async updateProductStockAttribute(productId: number, quantity: number, userId: number): Promise<void> {
    // Find or create stock/quantity attribute
    let stockAttribute = await this.prisma.attribute.findFirst({
      where: {
        name: { contains: 'stock', mode: 'insensitive' },
        userId,
      },
    });

    if (!stockAttribute) {
      stockAttribute = await this.prisma.attribute.create({
        data: {
          name: 'Stock Quantity',
          type: 'number',
          userId,
        },
      });
    }

    // Update or create product attribute
    await this.prisma.productAttribute.upsert({
      where: {
        productId_attributeId: {
          productId,
          attributeId: stockAttribute.id,
        },
      },
      update: {
        value: quantity.toString(),
      },
      create: {
        productId,
        attributeId: stockAttribute.id,
        value: quantity.toString(),
      },
    });
  }

  private async updateProductPriceAttribute(productId: number, price: string, userId: number): Promise<void> {
    // Find or create price attribute
    let priceAttribute = await this.prisma.attribute.findFirst({
      where: {
        name: { contains: 'price', mode: 'insensitive' },
        userId,
      },
    });

    if (!priceAttribute) {
      priceAttribute = await this.prisma.attribute.create({
        data: {
          name: 'Price',
          type: 'number',
          userId,
        },
      });
    }

    // Update or create product attribute
    await this.prisma.productAttribute.upsert({
      where: {
        productId_attributeId: {
          productId,
          attributeId: priceAttribute.id,
        },
      },
      update: {
        value: price,
      },
      create: {
        productId,
        attributeId: priceAttribute.id,
        value: price,
      },
    });
  }

  private getMarketplaceId(): string {
    // Map region to marketplace ID
    const marketplaceMap: Record<string, string> = {
      'us-east-1': 'ATVPDKIKX0DER', // US
      'eu-west-1': 'A1F83G8C2ARO7P', // UK
      'us-west-2': 'A2EUQ1WTGCTBG2', // Canada
      // Add more as needed
    };

    return marketplaceMap[this.region] || marketplaceMap['us-east-1'];
  }
}
