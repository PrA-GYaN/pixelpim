import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { BaseIntegrationService, ProductSyncResult } from '../base/base-integration.service';
import { IntegrationType, IntegrationOperation, IntegrationStatus } from '../base/integration-type.enum';
import * as WooCommerceAPI from 'woocommerce-api';
import * as crypto from 'crypto';

@Injectable()
export class WooCommerceService extends BaseIntegrationService {
  protected integrationType = IntegrationType.WOOCOMMERCE;
  private wooCommerce: any;
  private webhookSecret: string | undefined;

  constructor(
    protected prisma: PrismaService,
    protected configService: ConfigService,
  ) {
    super(prisma, configService);
    // Removed automatic connect() call - will be initialized later when needed
  }

  connect(): void {
    const wcUrl = this.configService.get<string>('WC_API_URL');
    const wcKey = this.configService.get<string>('WC_CONSUMER_KEY');
    const wcSecret = this.configService.get<string>('WC_CONSUMER_SECRET');
    this.webhookSecret = this.configService.get<string>('WC_WEBHOOK_SECRET');

    if (!wcUrl || !wcKey || !wcSecret) {
      this.logger.error('WooCommerce credentials not configured in .env');
      throw new Error('WooCommerce credentials not configured');
    }

    this.wooCommerce = new WooCommerceAPI({
      url: wcUrl,
      consumerKey: wcKey,
      consumerSecret: wcSecret,
      wpAPI: true,
      version: 'wc/v3',
    });

    this.logger.log('WooCommerce integration initialized');
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

      const wooProductData = this.transformProductToWooCommerce(product);
      const existingProduct = await this.findWooCommerceProductBySku(product.sku);

      let wooProductId: number;
      let operation: IntegrationOperation;

      if (existingProduct) {
        wooProductId = existingProduct.id;
        operation = IntegrationOperation.UPDATE;
        await this.updateWooCommerceProduct(wooProductId, wooProductData);
      } else {
        operation = IntegrationOperation.EXPORT;
        const createdProduct = await this.createWooCommerceProduct(wooProductData);
        wooProductId = createdProduct.id;
      }

      await this.recordIntegrationLog({
        productId,
        integrationType: this.integrationType,
        operation,
        status: IntegrationStatus.SUCCESS,
        message: `Product ${operation === IntegrationOperation.EXPORT ? 'exported' : 'updated'} successfully`,
        externalProductId: wooProductId.toString(),
        externalSku: product.sku,
        userId,
      });

      return {
        productId,
        status: 'success',
        externalProductId: wooProductId.toString(),
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

      const existingProduct = await this.findWooCommerceProductBySku(product.sku);
      if (!existingProduct) {
        throw new BadRequestException(`Product not found in WooCommerce`);
      }

      await this.deleteWooCommerceProduct(existingProduct.id);

      await this.recordIntegrationLog({
        productId,
        integrationType: this.integrationType,
        operation: IntegrationOperation.DELETE,
        status: IntegrationStatus.SUCCESS,
        message: 'Product deleted successfully',
        externalProductId: existingProduct.id.toString(),
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
      const products = await this.getAllWooCommerceProducts();
      const updates: Array<{ productId: number; action: string }> = [];

      for (const wooProduct of products) {
        try {
          const localProduct = await this.findProductBySku(wooProduct.sku, userId);
          
          if (localProduct) {
            // Update existing product
            await this.updateLocalProduct(localProduct.id, wooProduct, userId);
            updates.push({ productId: localProduct.id, action: 'updated' });
          } else {
            // Create new product
            const newProduct = await this.createLocalProduct(wooProduct, userId);
            updates.push({ productId: newProduct.id, action: 'created' });
          }
        } catch (error) {
          this.logger.error(`Failed to sync WooCommerce product ${wooProduct.id}:`, error);
        }
      }

      return {
        success: true,
        syncedCount: updates.length,
        updates,
      };
    } catch (error) {
      this.logger.error('Failed to pull updates from WooCommerce:', error);
      throw error;
    }
  }

  validateWebhookSignature(headers: any, body: any): boolean {
    if (!this.webhookSecret) {
      this.logger.warn('WC_WEBHOOK_SECRET not configured, skipping signature validation');
      return true;
    }

    const signature = headers['x-wc-webhook-signature'];
    if (!signature) {
      this.logger.warn('No webhook signature found in headers');
      return false;
    }

    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    const hash = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('base64');

    return hash === signature;
  }

  async handleWebhook(data: any, userId?: number): Promise<any> {
    try {
      const topic = data.topic || data.action;
      const resource = data.resource || data;

      this.logger.log(`Handling WooCommerce webhook: ${topic}`);

      switch (topic) {
        case 'product.created':
          return await this.handleProductCreated(resource, userId);
        case 'product.updated':
          return await this.handleProductUpdated(resource, userId);
        case 'product.deleted':
          return await this.handleProductDeleted(resource, userId);
        default:
          this.logger.warn(`Unhandled webhook topic: ${topic}`);
          return { success: false, message: 'Unhandled webhook topic' };
      }
    } catch (error) {
      this.logger.error('Webhook handling error:', error);
      throw error;
    }
  }

  private async handleProductCreated(wooProduct: any, userId?: number): Promise<any> {
    if (!userId) {
      // If no userId, try to find it from existing integration logs
      const log = await this.prisma.integrationLog.findFirst({
        where: {
          externalProductId: wooProduct.id.toString(),
          integrationType: this.integrationType,
        },
        orderBy: { timestamp: 'desc' },
      });
      userId = log?.userId;
    }

    if (!userId) {
      this.logger.warn('Cannot create product: userId not found');
      return { success: false, message: 'User ID not found' };
    }

    const existingProduct = await this.findProductBySku(wooProduct.sku, userId);
    
    if (existingProduct) {
      return await this.updateLocalProduct(existingProduct.id, wooProduct, userId);
    }

    const newProduct = await this.createLocalProduct(wooProduct, userId);
    return { success: true, productId: newProduct.id };
  }

  private async handleProductUpdated(wooProduct: any, userId?: number): Promise<any> {
    if (!userId) {
      const log = await this.prisma.integrationLog.findFirst({
        where: {
          externalProductId: wooProduct.id.toString(),
          integrationType: this.integrationType,
        },
        orderBy: { timestamp: 'desc' },
      });
      userId = log?.userId;
    }

    if (!userId) {
      this.logger.warn('Cannot update product: userId not found');
      return { success: false, message: 'User ID not found' };
    }

    const localProduct = await this.findProductBySku(wooProduct.sku, userId);
    
    if (!localProduct) {
      return await this.handleProductCreated(wooProduct, userId);
    }

    return await this.updateLocalProduct(localProduct.id, wooProduct, userId);
  }

  private async handleProductDeleted(wooProduct: any, userId?: number): Promise<any> {
    if (!userId) {
      const log = await this.prisma.integrationLog.findFirst({
        where: {
          externalProductId: wooProduct.id.toString(),
          integrationType: this.integrationType,
        },
        orderBy: { timestamp: 'desc' },
      });
      userId = log?.userId;
    }

    if (!userId) {
      return { success: false, message: 'User ID not found' };
    }

    const localProduct = await this.findProductBySku(wooProduct.sku, userId);
    
    if (localProduct) {
      await this.prisma.product.delete({
        where: { id: localProduct.id },
      });

      await this.recordIntegrationLog({
        productId: localProduct.id,
        integrationType: this.integrationType,
        operation: IntegrationOperation.WEBHOOK,
        status: IntegrationStatus.SUCCESS,
        message: 'Product deleted via webhook',
        externalProductId: wooProduct.id.toString(),
        userId,
      });
    }

    return { success: true };
  }

  private async createLocalProduct(wooProduct: any, userId: number) {
    const productData: any = {
      name: wooProduct.name,
      sku: wooProduct.sku,
      productLink: wooProduct.permalink,
      imageUrl: wooProduct.images?.[0]?.src,
      subImages: wooProduct.images?.slice(1).map((img: any) => img.src) || [],
      status: wooProduct.status === 'publish' ? 'complete' : 'incomplete',
      userId,
    };

    const product = await this.prisma.product.create({
      data: productData,
    });

    // Record the sync
    await this.recordIntegrationLog({
      productId: product.id,
      integrationType: this.integrationType,
      operation: IntegrationOperation.WEBHOOK,
      status: IntegrationStatus.SUCCESS,
      message: 'Product imported from WooCommerce',
      externalProductId: wooProduct.id.toString(),
      externalSku: wooProduct.sku,
      metadata: { price: wooProduct.price, stock: wooProduct.stock_quantity },
      userId,
    });

    return product;
  }

  private async updateLocalProduct(productId: number, wooProduct: any, userId: number) {
    await this.prisma.product.update({
      where: { id: productId },
      data: {
        name: wooProduct.name,
        imageUrl: wooProduct.images?.[0]?.src,
        subImages: wooProduct.images?.slice(1).map((img: any) => img.src) || [],
        status: wooProduct.status === 'publish' ? 'complete' : 'incomplete',
        productLink: wooProduct.permalink,
      },
    });

    await this.recordIntegrationLog({
      productId,
      integrationType: this.integrationType,
      operation: IntegrationOperation.WEBHOOK,
      status: IntegrationStatus.SUCCESS,
      message: 'Product updated from WooCommerce',
      externalProductId: wooProduct.id.toString(),
      externalSku: wooProduct.sku,
      metadata: { price: wooProduct.price, stock: wooProduct.stock_quantity },
      userId,
    });

    return { success: true, productId };
  }

  private transformProductToWooCommerce(product: any): any {
    const images: Array<{ src: string; alt: string }> = [];

    if (product.imageUrl) {
      images.push({ src: product.imageUrl, alt: product.name });
    }

    if (product.subImages && product.subImages.length > 0) {
      product.subImages.forEach((url: string, index: number) => {
        images.push({ src: url, alt: `${product.name} - Image ${index + 1}` });
      });
    }

    if (product.assets && product.assets.length > 0) {
      product.assets.forEach((assetRelation: any) => {
        if (assetRelation.asset && assetRelation.asset.filePath) {
          images.push({
            src: assetRelation.asset.filePath,
            alt: assetRelation.asset.name,
          });
        }
      });
    }

    let description = product.productLink 
      ? `<p>Product Link: <a href="${product.productLink}">${product.productLink}</a></p>` 
      : '';

    if (product.attributes && product.attributes.length > 0) {
      description += '<h3>Attributes:</h3><ul>';
      product.attributes.forEach((attr: any) => {
        if (attr.value) {
          description += `<li><strong>${attr.attribute.name}:</strong> ${attr.value}</li>`;
        }
      });
      description += '</ul>';
    }

    let price = '0';
    const priceAttr = product.attributes?.find((attr: any) =>
      attr.attribute.name.toLowerCase().includes('price')
    );
    if (priceAttr && priceAttr.value) {
      price = priceAttr.value.replace(/[^\d.]/g, '');
    }

    return {
      name: product.name,
      sku: product.sku,
      description,
      regular_price: price,
      images,
      categories: product.category ? [{ name: product.category.name }] : [],
      status: product.status === 'incomplete' ? 'draft' : 'publish',
    };
  }

  private async findWooCommerceProductBySku(sku: string): Promise<any | null> {
    return new Promise((resolve, reject) => {
      this.wooCommerce.get('products', { sku }, (err: any, data: any, res: any) => {
        if (err) {
          reject(err);
          return;
        }
        try {
          const products = JSON.parse(res);
          resolve(products.length > 0 ? products[0] : null);
        } catch (parseError) {
          reject(parseError);
        }
      });
    });
  }

  private async createWooCommerceProduct(productData: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.wooCommerce.post('products', productData, (err: any, data: any, res: any) => {
        if (err) {
          reject(err);
          return;
        }
        try {
          const product = JSON.parse(res);
          resolve(product);
        } catch (parseError) {
          reject(parseError);
        }
      });
    });
  }

  private async updateWooCommerceProduct(productId: number, productData: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.wooCommerce.put(`products/${productId}`, productData, (err: any, data: any, res: any) => {
        if (err) {
          reject(err);
          return;
        }
        try {
          const product = JSON.parse(res);
          resolve(product);
        } catch (parseError) {
          reject(parseError);
        }
      });
    });
  }

  private async deleteWooCommerceProduct(productId: number): Promise<any> {
    return new Promise((resolve, reject) => {
      this.wooCommerce.delete(`products/${productId}`, { force: true }, (err: any, data: any, res: any) => {
        if (err) {
          reject(err);
          return;
        }
        try {
          const result = JSON.parse(res);
          resolve(result);
        } catch (parseError) {
          reject(parseError);
        }
      });
    });
  }

  private async getAllWooCommerceProducts(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.wooCommerce.get('products', { per_page: 100 }, (err: any, data: any, res: any) => {
        if (err) {
          reject(err);
          return;
        }
        try {
          const products = JSON.parse(res);
          resolve(products);
        } catch (parseError) {
          reject(parseError);
        }
      });
    });
  }

  async getWooCommerceProductCount(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.wooCommerce.get('products/count', (err: any, data: any, res: any) => {
        if (err) {
          reject(err);
          return;
        }
        try {
          const result = JSON.parse(res);
          resolve(result.count || 0);
        } catch (parseError) {
          reject(parseError);
        }
      });
    });
  }
}
