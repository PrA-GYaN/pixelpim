import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { BaseIntegrationService, ProductSyncResult } from '../base/base-integration.service';
import { IntegrationType, IntegrationOperation, IntegrationStatus } from '../base/integration-type.enum';
import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api';
import * as crypto from 'crypto';

@Injectable()
export class WooCommerceService extends BaseIntegrationService {
  protected integrationType = IntegrationType.WOOCOMMERCE;
  private wooCommerce: WooCommerceRestApi;
  private webhookSecret: string | undefined;

  constructor(
    protected prisma: PrismaService,
    protected configService: ConfigService,
  ) {
    super(prisma, configService);
    // Initialize WooCommerce connection
    // this.connect();
  }

  async connect(): Promise<void> 
  {
      const wcUrl = this.configService.get<string>('WC_API_URL');
      const wcKey = this.configService.get<string>('WC_CONSUMER_KEY');
      const wcSecret = this.configService.get<string>('WC_CONSUMER_SECRET');
      this.webhookSecret = this.configService.get<string>('WC_WEBHOOK_SECRET');

      this.logger.log(
        `WooCommerce config values - URL: "${wcUrl}", Key: "${wcKey?.substring(0, 10)}...", Secret: "${wcSecret?.substring(0, 10)}..."`
      );

      if (!wcUrl || !wcKey || !wcSecret) {
        this.logger.error('WooCommerce credentials not configured in .env');
        throw new Error('WooCommerce credentials not configured');
      }

      // Clean up the base URL
      let baseUrl = wcUrl.trim().replace(/\/wp-json.*$/, '');
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        const isLocal = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1') || baseUrl.includes('.local');
        baseUrl = isLocal ? `http://${baseUrl}` : `https://${baseUrl}`;
      }

      try {
        const isHttps = baseUrl.startsWith('https://');

        this.wooCommerce = new WooCommerceRestApi({
          url: baseUrl,
          consumerKey: wcKey,
          consumerSecret: wcSecret,
          version: 'wc/v3',
          queryStringAuth: !isHttps, // true for HTTP, false for HTTPS
        });

        this.logger.log('WooCommerce REST API client initialized successfully');
        this.logger.log(`  - URL: ${baseUrl}`);
        this.logger.log(`  - Version: wc/v3`);
        this.logger.log(`  - Protocol: ${isHttps ? 'HTTPS (OAuth1.0a)' : 'HTTP (Query String Auth)'}`);

        // Test connection immediately
        try {
          const response = await this.wooCommerce.get('system_status');
          this.logger.log(`WooCommerce API reachable ✅ WP Version: ${response.data.environment.wp_version}, WooCommerce: ${response.data.environment.version}`);
        } catch (error: any) {
          if (error.response) {
            this.logger.error(`WooCommerce API Error (${error.response.status}): ${error.response.data?.message || 'Unknown error'}`);
            if (error.response.status === 401) {
              this.logger.warn('Check your WC_CONSUMER_KEY / WC_CONSUMER_SECRET permissions (Read/Write) and ensure the key is active.');
            } else if (error.response.status === 404) {
              this.logger.warn('Check WC_API_URL and ensure WooCommerce REST API is enabled.');
            } else if (error.response.status === 500) {
              this.logger.warn('Internal server error. Verify WooCommerce is active and there are no plugin conflicts.');
            }
          } else if (error.request) {
            this.logger.error('No response from WooCommerce API. Check network, firewall, or URL accessibility.');
          } else {
            this.logger.error('Unexpected error while testing WooCommerce connection:', error.message);
          }
          throw new Error('WooCommerce connection test failed');
        }
      } catch (error) {
        this.logger.error('Failed to initialize or connect to WooCommerce:', error);
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

      const wooProductData = await this.transformProductToWooCommerce(product);
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

  private async transformProductToWooCommerce(product: any): Promise<any> {
    // Helper function to sanitize HTML
    const sanitizeHtml = (html: string): string => {
      if (!html) return '';
      return html
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    };

    // Helper function to find attribute by name pattern
    const findAttribute = (patterns: string[]): any => {
      return product.attributes?.find((attr: any) =>
        patterns.some(pattern => 
          attr.attribute.name.toLowerCase().includes(pattern.toLowerCase())
        )
      );
    };

    // Helper function to extract numeric value
    const extractNumeric = (value: string): string => {
      if (!value) return '';
      return value.replace(/[^\d.]/g, '');
    };

    // 1. Build images array
    const images: Array<{ src: string; alt: string }> = [];
    if (product.imageUrl) {
      images.push({ src: product.imageUrl, alt: product.name });
    }

    if (product.subImages && product.subImages.length > 0) {
      product.subImages.forEach((url: string, index: number) => {
        images.push({ src: url, alt: `${product.name} - Gallery ${index + 1}` });
      });
    }

    // 2. Extract pricing from attributes
    const regularPriceAttr = findAttribute(['regular_price', 'price', 'regular price']);
    const salePriceAttr = findAttribute(['sale_price', 'sale price', 'discount price']);
    const saleStartDateAttr = findAttribute(['sale_start_date', 'sale start', 'discount start']);
    const saleEndDateAttr = findAttribute(['sale_end_date', 'sale end', 'discount end']);

    const regularPrice = regularPriceAttr ? extractNumeric(regularPriceAttr.value) : '';
    const salePrice = salePriceAttr ? extractNumeric(salePriceAttr.value) : '';

    // 3. Extract weight and dimensions from attributes
    const weightAttr = findAttribute(['weight']);
    const lengthAttr = findAttribute(['length', 'dimension_length']);
    const widthAttr = findAttribute(['width', 'dimension_width']);
    const heightAttr = findAttribute(['height', 'dimension_height']);

    const dimensions: any = {};
    if (lengthAttr?.value) dimensions.length = extractNumeric(lengthAttr.value);
    if (widthAttr?.value) dimensions.width = extractNumeric(widthAttr.value);
    if (heightAttr?.value) dimensions.height = extractNumeric(heightAttr.value);

    // 4. Extract stock status
    const stockStatusAttr = findAttribute(['stock_status', 'stock status', 'availability']);
    let stockStatus = 'instock';
    if (stockStatusAttr?.value) {
      const value = stockStatusAttr.value.toLowerCase();
      if (value.includes('out') || value.includes('unavailable')) {
        stockStatus = 'outofstock';
      } else if (value.includes('backorder')) {
        stockStatus = 'onbackorder';
      }
    }

    // 5. Define mapped attribute names (these will NOT appear in WooCommerce attributes)
    const mappedAttributeNames = [
      'regular_price', 'price', 'regular price',
      'sale_price', 'sale price', 'discount price',
      'sale_start_date', 'sale start', 'discount start',
      'sale_end_date', 'sale end', 'discount end',
      'weight', 'length', 'width', 'height',
      'dimension_length', 'dimension_width', 'dimension_height',
      'stock_status', 'stock status', 'availability',
      'description', 'desc', 'long description'
    ];

    // 6. Build WooCommerce attributes array
    // All non-mapped attributes should be created as WooCommerce attributes
    const wooAttributes: Array<{ name: string; options: string[]; visible: boolean; variation: boolean }> = [];

    if (product.attributes && product.attributes.length > 0) {
      for (const attr of product.attributes) {
        const attrName = attr.attribute.name.toLowerCase();
        const isMapped = mappedAttributeNames.some(name => attrName.includes(name.toLowerCase()));
        
        if (!isMapped && attr.value) {
          // Parse array values
          let options: string[] = [];
          
          try {
            // Check if value is a JSON array string
            if (typeof attr.value === 'string' && attr.value.trim().startsWith('[')) {
              const parsed = JSON.parse(attr.value);
              options = Array.isArray(parsed) ? parsed : [attr.value];
            } else {
              options = [attr.value];
            }
          } catch (e) {
            // If parsing fails, treat as single value
            options = [attr.value];
          }

          // Check if this is a variation attribute (color, size, material, etc.)
          const variationPatterns = ['color', 'colour', 'size', 'material', 'style'];
          const isVariation = variationPatterns.some(pattern => attrName.includes(pattern));
          
          // Ensure attribute exists in WooCommerce
          await this.ensureWooCommerceAttribute(attr.attribute.name, options);
          
          wooAttributes.push({
            name: attr.attribute.name,
            options: options,
            visible: true,
            variation: isVariation
          });
        }
      }
    }

    // 7. Build description HTML - ONLY from description attribute, NOT from other attributes
    let description = '';

    // Add description from attributes
    const descriptionAttr = findAttribute(['description', 'desc', 'long description']);
    if (descriptionAttr?.value) {
      description += sanitizeHtml(`<div class="product-description">${descriptionAttr.value}</div>`);
    }

    // Add assets as media in description
    if (product.assets && product.assets.length > 0) {
      description += '<h3>Additional Media:</h3><div class="product-media">';
      product.assets.forEach((assetRelation: any) => {
        if (assetRelation.asset) {
          const asset = assetRelation.asset;
          const isImage = asset.mimeType?.startsWith('image/');
          
          if (isImage && asset.filePath) {
            description += sanitizeHtml(`<img src="${asset.filePath}" alt="${asset.name}" style="max-width: 100%; height: auto; margin: 10px 0;" />`);
          } else if (asset.filePath) {
            description += sanitizeHtml(`<p><a href="${asset.filePath}" download="${asset.fileName}">${asset.name}</a></p>`);
          }
        }
      });
      description += '</div>';
    }

    // 8. Build categories - ensure they exist in WooCommerce
    const categories: Array<{ id: number }> = [];
    if (product.category) {
      const categoryId = await this.ensureWooCommerceCategory(product.category.name);
      categories.push({ id: categoryId });
    }

    // 9. Extract tags if available
    const tagsAttr = findAttribute(['tags', 'product tags']);
    const tags: Array<{ name: string }> = [];
    if (tagsAttr?.value) {
      const tagValues = tagsAttr.value.split(',').map((tag: string) => tag.trim());
      tagValues.forEach((tag: string) => {
        if (tag) tags.push({ name: tag });
      });
    }

    // 10. Determine product status
    let productStatus = 'draft';
    const statusAttr = findAttribute(['status', 'publish status']);
    if (statusAttr?.value) {
      const value = statusAttr.value.toLowerCase();
      productStatus = value.includes('publish') ? 'publish' : 'draft';
    } else if (product.status) {
      productStatus = product.status === 'complete' ? 'publish' : 'draft';
    }

    // 11. Build final WooCommerce product object
    const wooProduct: any = {
      name: product.name,
      sku: product.sku,
      type: 'simple',
      status: productStatus,
      description: sanitizeHtml(description) || '', // Empty string if no description
    };

    // Add optional fields only if they have values
    if (regularPrice) wooProduct.regular_price = regularPrice;
    if (salePrice) wooProduct.sale_price = salePrice;
    if (saleStartDateAttr?.value) wooProduct.date_on_sale_from = saleStartDateAttr.value;
    if (saleEndDateAttr?.value) wooProduct.date_on_sale_to = saleEndDateAttr.value;
    if (weightAttr?.value) wooProduct.weight = extractNumeric(weightAttr.value);
    if (Object.keys(dimensions).length > 0) wooProduct.dimensions = dimensions;
    wooProduct.stock_status = stockStatus;
    if (images.length > 0) wooProduct.images = images;
    if (categories.length > 0) wooProduct.categories = categories;
    if (tags.length > 0) wooProduct.tags = tags;
    if (wooAttributes.length > 0) wooProduct.attributes = wooAttributes;

    return wooProduct;
  }

  private async findWooCommerceProductBySku(sku: string): Promise<any | null> {
    try {
      this.logger.log(`Searching for WooCommerce product with SKU: ${sku}`);
      
      const response = await this.wooCommerce.get('products', { sku });
      const products = response.data;
      
      return products.length > 0 ? products[0] : null;
    } catch (error) {
      this.logger.error(`WooCommerce API error for SKU ${sku}:`, error);
      throw error;
    }
  }

  private async createWooCommerceProduct(productData: any): Promise<any> {
    try {
      const response = await this.wooCommerce.post('products', productData);
      return response.data;
    } catch (error) {
      this.logger.error('Error creating WooCommerce product:', error);
      throw error;
    }
  }

  private async updateWooCommerceProduct(productId: number, productData: any): Promise<any> {
    try {
      const response = await this.wooCommerce.put(`products/${productId}`, productData);
      return response.data;
    } catch (error) {
      this.logger.error(`Error updating WooCommerce product ${productId}:`, error);
      throw error;
    }
  }

  private async deleteWooCommerceProduct(productId: number): Promise<any> {
    try {
      const response = await this.wooCommerce.delete(`products/${productId}`, { force: true });
      return response.data;
    } catch (error) {
      this.logger.error(`Error deleting WooCommerce product ${productId}:`, error);
      throw error;
    }
  }

  private async getAllWooCommerceProducts(): Promise<any[]> {
    try {
      const response = await this.wooCommerce.get('products', { per_page: 100 });
      return response.data;
    } catch (error) {
      this.logger.error('Error fetching WooCommerce products:', error);
      throw error;
    }
  }

  async getWooCommerceProductCount(): Promise<number> {
    try {
      // The modern SDK doesn't have a separate count endpoint
      // We'll use the X-WP-Total header from a products request
      const response = await this.wooCommerce.get('products', { per_page: 1 });
      
      // Extract total from headers
      const total = response.headers['x-wp-total'];
      return total ? parseInt(total, 10) : 0;
    } catch (error) {
      this.logger.error('Error getting WooCommerce product count:', error);
      throw error;
    }
  }

  /**
   * Ensure a category exists in WooCommerce, create if it doesn't
   * @param categoryName The category name
   * @returns The WooCommerce category ID
   */
  private async ensureWooCommerceCategory(categoryName: string): Promise<number> {
    try {
      // Search for existing category
      const response = await this.wooCommerce.get('products/categories', { 
        search: categoryName,
        per_page: 100 
      });
      
      const categories = response.data;
      const existingCategory = categories.find(
        (cat: any) => cat.name.toLowerCase() === categoryName.toLowerCase()
      );

      if (existingCategory) {
        this.logger.log(`Category "${categoryName}" already exists with ID: ${existingCategory.id}`);
        return existingCategory.id;
      }

      // Create new category
      this.logger.log(`Creating new category: "${categoryName}"`);
      const createResponse = await this.wooCommerce.post('products/categories', {
        name: categoryName
      });

      this.logger.log(`Created category "${categoryName}" with ID: ${createResponse.data.id}`);
      return createResponse.data.id;
    } catch (error) {
      this.logger.error(`Error ensuring category "${categoryName}":`, error);
      throw error;
    }
  }

  /**
   * Ensure an attribute exists in WooCommerce, create if it doesn't
   * @param attributeName The attribute name
   * @param options The attribute options (terms)
   */
  private async ensureWooCommerceAttribute(attributeName: string, options: string[]): Promise<void> {
    try {
      // Get all attributes
      const response = await this.wooCommerce.get('products/attributes');
      const attributes = response.data;
      
      // Find existing attribute (case-insensitive)
      let attribute = attributes.find(
        (attr: any) => attr.name.toLowerCase() === attributeName.toLowerCase()
      );

      // Create attribute if it doesn't exist
      if (!attribute) {
        this.logger.log(`Creating new attribute: "${attributeName}"`);
        const createResponse = await this.wooCommerce.post('products/attributes', {
          name: attributeName,
          type: 'select',
          order_by: 'menu_order',
          has_archives: false
        });
        attribute = createResponse.data;
        this.logger.log(`Created attribute "${attributeName}" with ID: ${attribute.id}`);
      } else {
        this.logger.log(`Attribute "${attributeName}" already exists with ID: ${attribute.id}`);
      }

      // Ensure all attribute terms (options) exist
      if (options && options.length > 0) {
        await this.ensureWooCommerceAttributeTerms(attribute.id, options);
      }
    } catch (error) {
      this.logger.error(`Error ensuring attribute "${attributeName}":`, error);
      // Don't throw - we'll still try to export the product
      // WooCommerce might handle it as a custom attribute
    }
  }

  /**
   * Ensure attribute terms exist in WooCommerce, create if they don't
   * @param attributeId The WooCommerce attribute ID
   * @param terms The terms to ensure exist
   */
  private async ensureWooCommerceAttributeTerms(attributeId: number, terms: string[]): Promise<void> {
    try {
      // Get existing terms for this attribute
      const response = await this.wooCommerce.get(`products/attributes/${attributeId}/terms`, {
        per_page: 100
      });
      const existingTerms = response.data;

      for (const termName of terms) {
        if (!termName || termName.trim() === '') continue;

        // Check if term already exists (case-insensitive)
        const existingTerm = existingTerms.find(
          (term: any) => term.name.toLowerCase() === termName.toLowerCase()
        );

        if (!existingTerm) {
          // Create new term
          this.logger.log(`Creating new term "${termName}" for attribute ID ${attributeId}`);
          await this.wooCommerce.post(`products/attributes/${attributeId}/terms`, {
            name: termName
          });
        }
      }
    } catch (error) {
      this.logger.error(`Error ensuring attribute terms for attribute ${attributeId}:`, error);
      // Don't throw - attribute might still work without pre-created terms
    }
  }
}
