import { Injectable, Logger, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { BaseIntegrationService, ProductSyncResult } from '../base/base-integration.service';
import { IntegrationType, IntegrationOperation, IntegrationStatus } from '../base/integration-type.enum';
import axios, { AxiosInstance } from 'axios';
import { MyDealConnectionService } from './mydeal-connection.service';
import {
  MyDealTokenResponse,
  MyDealProductPayload,
  MyDealProductResponse,
  MyDealApiResponse,
  MyDealOrder,
} from './dto/mydeal.dto';

@Injectable()
export class MyDealService extends BaseIntegrationService {
  protected integrationType = IntegrationType.MYDEAL;
  private axiosInstance: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;
  private currentUserId: number | null = null;
  private mydealCategoriesCache: any[] | null = null;
  private categoriesCacheTimestamp: Date | null = null;
  private readonly CACHE_DURATION_MS = 3600000; // 1 hour

  constructor(
    protected prisma: PrismaService,
    protected configService: ConfigService,
    @Inject(forwardRef(() => MyDealConnectionService))
    private connectionService: MyDealConnectionService,
  ) {
    super(prisma, configService);
    this.axiosInstance = axios.create();
  //   this.axiosInstance.interceptors.request.use(
  //   (config) => {
  //     this.logger.debug('MyDeal OUTGOING REQUEST', {
  //       method: config.method,
  //       url: config.baseURL
  //         ? `${config.baseURL}${config.url}`
  //         : config.url,
  //       headers: config.headers,
  //     });

  //     return config;
  //   },
  //   (error) => Promise.reject(error),
  // );
  }

  /**
   * Legacy connect method - not used with per-user credentials
   * Each operation now connects with user-specific credentials
   */
  async connect(): Promise<void> {
    throw new Error('MyDealService requires per-user credentials. Use connectWithCredentials(userId) instead.');
  }

  /**
   * Get MyDeal credentials for a specific user
   */
  private async getUserCredentials(userId: number, connectionId?: number): Promise<{
    baseApiUrl: string;
    clientId: string;
    clientSecret: string;
    sellerId: string;
    sellerToken: string;
  }> {
    let connection;
    
    if (connectionId) {
      // Get specific connection by ID
      connection = await this.prisma.myDealConnection.findFirst({
        where: {
          id: connectionId,
          userId,
          isActive: true,
        },
      });
    } else {
      // Get default or first active connection
      connection = await this.prisma.myDealConnection.findFirst({
        where: {
          userId,
          isActive: true,
        },
        orderBy: [
          { isDefault: 'desc' },
          { createdAt: 'asc' },
        ],
      });
    }

    if (!connection) {
      throw new BadRequestException('MyDeal connection not configured for this user');
    }

    return {
      baseApiUrl: connection.baseApiUrl,
      clientId: connection.clientId,
      clientSecret: connection.clientSecret,
      sellerId: connection.sellerId,
      sellerToken: connection.sellerToken,
    };
  }

  /**
   * Connect to MyDeal with user-specific credentials and get access token
   */
  private async connectWithCredentials(userId: number, connectionId?: number): Promise<void> {
    // If already connected for this user and token is still valid, reuse it
    if (this.accessToken && this.currentUserId === userId && this.tokenExpiresAt && new Date() < this.tokenExpiresAt) {
      return;
    }

    const { baseApiUrl, clientId, clientSecret, sellerId, sellerToken } = await this.getUserCredentials(userId, connectionId);
    this.currentUserId = userId;

    this.logger.log(`Connecting to MyDeal API for user ${userId}`);

    try {
      // Get access token
      const tokenResponse = await axios.post<MyDealTokenResponse>(
        `${baseApiUrl}/mydealaccesstoken`,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.accessToken = tokenResponse.data.access_token;
      
      // Calculate token expiration (subtract 5 minutes for safety)
      const expiresInMs = (tokenResponse.data.expires_in - 300) * 1000;
      this.tokenExpiresAt = new Date(Date.now() + expiresInMs);

      // Configure axios instance with default headers
      this.axiosInstance = axios.create({
        baseURL: baseApiUrl,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'SellerID': sellerId,
          'SellerToken': sellerToken,
          'Content-Type': 'application/json',
        },
      });

      // Add request interceptor to the new instance
      this.axiosInstance.interceptors.request.use(
        (config) => {
          this.logger.debug('MyDeal OUTGOING REQUEST', {
            method: config.method,
            url: config.baseURL
              ? `${config.baseURL}${config.url}`
              : config.url,
            headers: config.headers,
          });
          return config;
        },
        (error) => Promise.reject(error),
      );

      this.logger.log('MyDeal API connected successfully ✅');
    } catch (error: any) {
      this.logger.error('Failed to connect to MyDeal API:', error.response?.data || error.message);
      throw new Error('MyDeal connection failed');
    }
  }

  /**
   * Fetch MyDeal categories from API with caching
   */
  private async fetchMyDealCategories(): Promise<any[]> {
    // Check if cache is valid
    if (
      this.mydealCategoriesCache &&
      this.categoriesCacheTimestamp &&
      new Date().getTime() - this.categoriesCacheTimestamp.getTime() < this.CACHE_DURATION_MS
    ) {
      this.logger.log('Using cached MyDeal categories');
      return this.mydealCategoriesCache;
    }

    try {
      this.logger.log('Fetching MyDeal categories from API');
      const response = await this.axiosInstance.get('/categories');
      
      if (response.data && Array.isArray(response.data)) {
        this.mydealCategoriesCache = response.data;
        this.categoriesCacheTimestamp = new Date();
        this.logger.log(`Fetched ${response.data.length} MyDeal categories`);
        return response.data;
      }
      
      return [];
    } catch (error: any) {
      this.logger.error('Failed to fetch MyDeal categories:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Match internal category name with MyDeal category and return the ID
   * Only returns categories where IsAssignable is true
   */
  private async matchMyDealCategory(productId: number, userId: number): Promise<number> {
    const DEFAULT_CATEGORY_ID = 135; // Default fallback category

    try {
      // Fetch product's category from database
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        include: {
          category: true,
        },
      });

      if (!product?.category?.name) {
        this.logger.warn(`Product ${productId} has no category, using default: ${DEFAULT_CATEGORY_ID}`);
        return DEFAULT_CATEGORY_ID;
      }

      const internalCategoryName = product.category.name.toLowerCase().trim();
      this.logger.log(`Matching internal category "${product.category.name}" with MyDeal categories`);

      // Fetch MyDeal categories
      const mydealCategories = await this.fetchMyDealCategories();

      // Find matching category (case-insensitive, must be assignable)
      const matchedCategory = mydealCategories.find(
        (cat: any) =>
          cat.IsAssignable === true &&
          cat.CategoryName.toLowerCase().trim() === internalCategoryName
      );

      if (matchedCategory) {
        this.logger.log(`Matched category "${product.category.name}" to MyDeal category ID: ${matchedCategory.CategoryID}`);
        return matchedCategory.CategoryID;
      }

      this.logger.warn(`No matching MyDeal category found for "${product.category.name}", using default: ${DEFAULT_CATEGORY_ID}`);
      return DEFAULT_CATEGORY_ID;
    } catch (error: any) {
      this.logger.error('Error matching category:', error);
      return DEFAULT_CATEGORY_ID;
    }
  }

  /**
   * Export a single product to MyDeal
   */
  async exportProduct(productId: number, userId: number, connectionId?: number): Promise<ProductSyncResult> {
    try {
      await this.connectWithCredentials(userId, connectionId);

      const product = await this.fetchProductWithRelations(productId, userId);

      if (!product) {
        throw new BadRequestException(`Product with ID ${productId} not found`);
      }

      if (!product.sku) {
        throw new BadRequestException(`Product ${productId} is missing SKU`);
      }

      // Log the product data being exported
      this.logger.log(`Exporting product data for product ID ${productId}:`, {
        id: product.id,
        sku: product.sku,
        name: product.name,
        categoryId: product.categoryId,
        status: product.status,
        attributes: product.attributes?.length || 0,
        assets: product.assets?.length || 0,
        variants: product.variants?.length || 0,
      });

      // Get export mapping if connectionId provided
      let fieldMappings: Record<string, any> = {};
      let selectedFields: string[] | null = null;
      
      if (connectionId) {
        const exportMapping = await this.connectionService.getActiveExportMapping(userId, connectionId);
        if (exportMapping) {
          fieldMappings = exportMapping.fieldMappings;
          selectedFields = exportMapping.selectedFields;
          this.logger.log(`Using export mapping with fields: ${selectedFields?.join(', ')}`);
        }
      }

      const mydealProductData = await this.transformProductToMyDeal(product, fieldMappings, selectedFields, userId, productId);

      // Log the transformed MyDeal product data
      this.logger.log(`Transformed MyDeal product data for product ID ${productId}:`, JSON.stringify(mydealProductData, null, 2));

      // MyDeal API uses async processing, so we send the product
      const response = await this.createOrUpdateMyDealProduct([mydealProductData]);

      let externalProductId: string | undefined;
      let message = 'Product export initiated';

      if (response.ResponseStatus === 'AsyncResponsePending') {
        // Extract work item ID from PendingUri
        let workItemId = response.PendingUri || `work-${Date.now()}-${productId}`;
        if (response.PendingUri) {
          // Extract ID from URL like: https://...?workItemID=329974
          const match = response.PendingUri.match(/workItemID=(\d+)/);
          if (match) {
            workItemId = match[1];
          }
        }

        // Store work item in database for tracking
        await this.storeWorkItem({
          workItemId,
          userId,
          connectionId,
          productId,
          status: 'pending',
          operation: 'export',
          requestPayload: mydealProductData,
          pendingUri: response.PendingUri,
          externalSku: product.sku,
        });

        message = `Product export pending. Work Item ID: ${workItemId}`;
        externalProductId = product.sku; // Use SKU as temporary identifier
      } else if (response.ResponseStatus === 'Complete') {
        // Store completed work item
        await this.storeWorkItem({
          workItemId: `work-${Date.now()}-${productId}`,
          userId,
          connectionId,
          productId,
          status: 'completed',
          operation: 'export',
          requestPayload: mydealProductData,
          responseData: response.Data,
          externalProductId: product.sku,
          externalSku: product.sku,
          completedAt: new Date(),
        });

        externalProductId = product.sku;
        message = 'Product exported successfully';
      } else if (response.ResponseStatus === 'Failed' && response.Errors) {
        const errorMsg = response.Errors.map(e => e.Message).join(', ');
        
        // Store failed work item
        await this.storeWorkItem({
          workItemId: `work-${Date.now()}-${productId}`,
          userId,
          connectionId,
          productId,
          status: 'failed',
          operation: 'export',
          requestPayload: mydealProductData,
          responseData: response,
          errorMessage: errorMsg,
          externalSku: product.sku,
        });

        throw new Error(errorMsg);
      }

      await this.recordIntegrationLog({
        productId,
        integrationType: this.integrationType,
        operation: IntegrationOperation.EXPORT,
        status: IntegrationStatus.SUCCESS,
        message,
        externalProductId,
        externalSku: product.sku,
        metadata: { pendingUri: response.PendingUri },
        userId,
      });

      return {
        productId,
        status: 'success',
        externalProductId,
        message,
      };
    } catch (error: any) {
      this.logger.error(`Export failed for product ${productId}:`, error);

      await this.recordIntegrationLog({
        productId,
        integrationType: this.integrationType,
        operation: IntegrationOperation.EXPORT,
        status: IntegrationStatus.ERROR,
        message: error.message,
        errorDetails: { stack: error.stack, response: error.response?.data },
        userId,
      });

      return {
        productId,
        status: 'error',
        message: error.message,
      };
    }
  }

  /**
   * Export multiple products to MyDeal
   */
  async exportProducts(productIds: number[], userId: number, connectionId?: number): Promise<{
    syncedCount: number;
    failedCount: number;
    results: ProductSyncResult[];
  }> {
    const results: ProductSyncResult[] = [];
    let syncedCount = 0;
    let failedCount = 0;

    for (const productId of productIds) {
      const result = await this.exportProduct(productId, userId, connectionId);
      results.push(result);
      
      if (result.status === 'success') {
        syncedCount++;
      } else {
        failedCount++;
      }
    }

    return { syncedCount, failedCount, results };
  }

  /**
   * Update an existing product on MyDeal
   */
  async updateProduct(productId: number, userId: number, connectionId?: number): Promise<ProductSyncResult> {
    // MyDeal uses the same endpoint for create and update
    return this.exportProduct(productId, userId, connectionId);
  }

  /**
   * Delete a product from MyDeal
   */
  async deleteProduct(productId: number, userId: number, connectionId?: number): Promise<ProductSyncResult> {
    try {
      await this.connectWithCredentials(userId, connectionId);

      const product = await this.fetchProductWithRelations(productId, userId);

      if (!product || !product.sku) {
        throw new BadRequestException(`Product with ID ${productId} not found or missing SKU`);
      }

      // MyDeal doesn't have a direct delete endpoint in the API
      // We set the quantity to 0 and listing status to inactive
      const mydealProductData = await this.transformProductToMyDeal(product, {}, null);
      
      // Set all buyable products to inactive
      mydealProductData.BuyableProducts = mydealProductData.BuyableProducts.map(bp => ({
        ...bp,
        Quantity: 0,
        ListingStatus: 0, // 0 = Inactive
      }));

      const response = await this.createOrUpdateMyDealProduct([mydealProductData]);

      // Store work item for delete operation
      if (response.ResponseStatus === 'AsyncResponsePending') {
        await this.storeWorkItem({
          workItemId: response.PendingUri || `work-delete-${Date.now()}-${productId}`,
          userId,
          connectionId,
          productId,
          status: 'pending',
          operation: 'delete',
          requestPayload: mydealProductData,
          pendingUri: response.PendingUri,
          externalSku: product.sku,
        });
      } else if (response.ResponseStatus === 'Complete') {
        await this.storeWorkItem({
          workItemId: `work-delete-${Date.now()}-${productId}`,
          userId,
          connectionId,
          productId,
          status: 'completed',
          operation: 'delete',
          requestPayload: mydealProductData,
          responseData: response.Data,
          externalSku: product.sku,
          completedAt: new Date(),
        });
      }

      await this.recordIntegrationLog({
        productId,
        integrationType: this.integrationType,
        operation: IntegrationOperation.DELETE,
        status: IntegrationStatus.SUCCESS,
        message: 'Product deactivated on MyDeal',
        externalSku: product.sku,
        userId,
      });

      return {
        productId,
        status: 'success',
        message: 'Product deactivated on MyDeal',
      };
    } catch (error: any) {
      this.logger.error(`Delete failed for product ${productId}:`, error);

      await this.recordIntegrationLog({
        productId,
        integrationType: this.integrationType,
        operation: IntegrationOperation.DELETE,
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

  /**
   * Pull updates from MyDeal (fetch products or orders)
   */
  async pullUpdates(userId: number, connectionId?: number): Promise<any> {
    try {
      await this.connectWithCredentials(userId, connectionId);

      // Fetch products from MyDeal
      const response = await this.axiosInstance.get<MyDealApiResponse<MyDealProductResponse[]>>(
        '/products',
        {
          params: {
            fields: 'ExternalProductId,ProductSKU,Title,Description,Brand,Tags,Condition,Categories,Images,Weight,WeightUnit,BuyableProducts',
            page: 1,
            limit: 100,
          },
        }
      );

      if (response.data.ResponseStatus === 'Complete' && response.data.Data) {
        // If connectionId provided, apply import mapping
        let products = response.data.Data;
        
        if (connectionId) {
          const importMapping = await this.connectionService.getActiveImportMapping(userId, connectionId);
          if (importMapping) {
            products = await Promise.all(
              products.map(p => this.transformMyDealToProduct(p, importMapping.attributeMappings, importMapping.fieldMappings))
            );
          }
        }

        return {
          success: true,
          products,
          count: products.length,
        };
      }

      return {
        success: false,
        message: 'Failed to fetch products from MyDeal',
      };
    } catch (error: any) {
      this.logger.error('Pull updates failed:', error);
      throw error;
    }
  }

  /**
   * Handle incoming webhook data from MyDeal
   */
  async handleWebhook(data: any, userId?: number): Promise<any> {
    this.logger.log('MyDeal webhook received:', JSON.stringify(data, null, 2));
    
    // MyDeal webhooks are primarily for orders
    // Implement order processing logic here if needed
    
    return {
      success: true,
      message: 'Webhook processed',
    };
  }

  /**
   * Transform MyDeal product to internal format with import mapping
   */
  private async transformMyDealToProduct(
    mydealProduct: MyDealProductResponse,
    attributeMappings: Record<string, any> = {},
    fieldMappings: Record<string, any> = {},
  ): Promise<any> {
    // Apply field mappings
    const mapField = (mydealField: string): string => {
      return fieldMappings[mydealField] || mydealField.toLowerCase();
    };

    // Build attributes array from MyDeal product fields
    const attributes: Array<{ name: string; value: any }> = [];

    // Map basic fields
    if (mydealProduct.Description) {
      attributes.push({ 
        name: mapField('Description'), 
        value: mydealProduct.Description 
      });
    }

    if (mydealProduct.Brand) {
      attributes.push({ 
        name: attributeMappings['Brand'] || mapField('Brand'), 
        value: mydealProduct.Brand 
      });
    }

    if (mydealProduct.Tags) {
      attributes.push({ 
        name: mapField('Tags'), 
        value: mydealProduct.Tags 
      });
    }

    if (mydealProduct.Condition) {
      attributes.push({ 
        name: mapField('Condition'), 
        value: mydealProduct.Condition 
      });
    }

    // Map dimensions and weight
    if (mydealProduct.Weight) {
      attributes.push({ 
        name: mapField('Weight'), 
        value: mydealProduct.Weight 
      });
    }

    if (mydealProduct.WeightUnit) {
      attributes.push({ 
        name: mapField('WeightUnit'), 
        value: mydealProduct.WeightUnit 
      });
    }

    if (mydealProduct.Length) {
      attributes.push({ 
        name: mapField('Length'), 
        value: mydealProduct.Length 
      });
    }

    if (mydealProduct.Height) {
      attributes.push({ 
        name: mapField('Height'), 
        value: mydealProduct.Height 
      });
    }

    if (mydealProduct.Width) {
      attributes.push({ 
        name: mapField('Width'), 
        value: mydealProduct.Width 
      });
    }

    if (mydealProduct.DimensionUnit) {
      attributes.push({ 
        name: mapField('DimensionUnit'), 
        value: mydealProduct.DimensionUnit 
      });
    }

    // Map identifiers
    if (mydealProduct.GTIN) {
      attributes.push({ 
        name: attributeMappings['GTIN'] || mapField('GTIN'), 
        value: mydealProduct.GTIN 
      });
    }

    if (mydealProduct.MPN) {
      attributes.push({ 
        name: attributeMappings['MPN'] || mapField('MPN'), 
        value: mydealProduct.MPN 
      });
    }

    // Get price and quantity from first BuyableProduct
    const firstBuyable = mydealProduct.BuyableProducts?.[0];
    if (firstBuyable) {
      attributes.push({ 
        name: mapField('Price'), 
        value: firstBuyable.Price 
      });

      if (firstBuyable.RRP) {
        attributes.push({ 
          name: mapField('RRP'), 
          value: firstBuyable.RRP 
        });
      }

      attributes.push({ 
        name: mapField('Quantity'), 
        value: firstBuyable.Quantity 
      });
    }

    // Get category
    const categoryId = mydealProduct.Categories?.[0]?.CategoryId;

    return {
      sku: mydealProduct.ProductSKU,
      name: mydealProduct.Title,
      categoryId,
      externalProductId: mydealProduct.ExternalProductId,
      images: mydealProduct.Images?.map(img => img.Src) || [],
      attributes,
      variants: mydealProduct.BuyableProducts?.map(bp => ({
        sku: bp.SKU,
        price: bp.Price,
        compareAtPrice: bp.RRP,
        quantity: bp.Quantity,
        isActive: bp.ListingStatus === 1,
      })) || [],
    };
  }

  /**
   * Validate webhook signature
   */
  async validateWebhookSignature(headers: any, body: any, userId?: number): Promise<boolean> {
    // MyDeal webhook validation would go here
    // For now, return true (implement signature validation as needed)
    return true;
  }

  /**
   * Get orders from MyDeal
   */
  async getOrders(userId: number, params?: { page?: number; limit?: number; status?: string; connectionId?: number }): Promise<MyDealOrder[]> {
    try {
      await this.connectWithCredentials(userId, params?.connectionId);

      const response = await this.axiosInstance.get<MyDealApiResponse<MyDealOrder[]>>(
        '/orders',
        {
          params: {
            page: params?.page || 1,
            limit: params?.limit || 100,
            ...(params?.status && { status: params.status }),
          },
        }
      );

      if (response.data.ResponseStatus === 'Complete' && response.data.Data) {
        return response.data.Data;
      }

      return [];
    } catch (error: any) {
      this.logger.error('Failed to fetch orders:', error);
      throw error;
    }
  }

  /**
   * Get MyDeal product count
   */
  async getMyDealProductCount(userId: number, connectionId?: number): Promise<number> {
    try {
      await this.connectWithCredentials(userId, connectionId);

      const response = await this.axiosInstance.get<MyDealApiResponse<MyDealProductResponse[]>>(
        '/products',
        {
          params: {
            fields: 'ExternalProductId',
            page: 1,
            limit: 1,
          },
        }
      );

      // Note: MyDeal API doesn't return total count in the response
      // This is a limitation of the API
      return 0;
    } catch (error: any) {
      this.logger.error('Failed to fetch product count:', error);
      return 0;
    }
  }

  /**
   * Transform internal product to MyDeal format
   */
  private async transformProductToMyDeal(
    product: any,
    fieldMappings: Record<string, any> = {},
    selectedFields: string[] | null = null,
    userId?: number,
    productId?: number,
  ): Promise<MyDealProductPayload> {
    // Helper function to check if a field should be exported
    const shouldExportField = (internalField: string): boolean => {
      return !selectedFields || selectedFields.includes(internalField);
    };

    // Map of internal field names to their default MyDeal field names
    const fieldDefaults: Record<string, { mydealField: string; defaultValue: any; required?: boolean; onlyInBuyableProducts?: boolean; processor?: (val: any) => any }> = {
      'name': { mydealField: 'Title', defaultValue: 'Untitled Product', required: true },
      'sku': { mydealField: 'ProductSKU', defaultValue: product.sku || product.id.toString(), required: true },
      'description': { mydealField: 'Description', defaultValue: 'This product is available for purchase. Please contact us for more details.' },
      'specifications': { mydealField: 'Specifications', defaultValue: '' },
      'brand': { mydealField: 'Brand', defaultValue: '' },
      'tags': { mydealField: 'Tags', defaultValue: '', processor: (val) => Array.isArray(val) ? val.join(', ') : (val || '') },
      'condition': { mydealField: 'Condition', defaultValue: 'new', required: true },
      'weight': { mydealField: 'Weight', defaultValue: 1, processor: parseFloat },
      'weightUnit': { mydealField: 'WeightUnit', defaultValue: 'kg' },
      'length': { mydealField: 'Length', defaultValue: 0.1, processor: parseFloat },
      'height': { mydealField: 'Height', defaultValue: 0.1, processor: parseFloat },
      'width': { mydealField: 'Width', defaultValue: 0.1, processor: parseFloat },
      'dimensionUnit': { mydealField: 'DimensionUnit', defaultValue: 'm' },
      'gtin': { mydealField: 'GTIN', defaultValue: null },
      'mpn': { mydealField: 'MPN', defaultValue: null },
      'requiresShipping': { mydealField: 'RequiresShipping', defaultValue: true, processor: (val) => val === true || val === 'true' },
      'shippingCostStandard': { mydealField: 'ShippingCostStandard', defaultValue: 10, processor: parseFloat },
      'shippingCostExpedited': { mydealField: 'ShippingCostExpedited', defaultValue: 15, processor: parseFloat },
      'deliveryTime': { mydealField: 'DeliveryTime', defaultValue: '5-10 business days' },
      'maxDaysForDelivery': { mydealField: 'MaxDaysForDelivery', defaultValue: 10, processor: parseInt },
      'has48HoursDispatch': { mydealField: 'Has48HoursDispatch', defaultValue: false, processor: (val) => val === true || val === 'true' },
      'price': { mydealField: 'Price', defaultValue: 0, onlyInBuyableProducts: true, processor: parseFloat },
      'compareAtPrice': { mydealField: 'RRP', defaultValue: 0, onlyInBuyableProducts: true, processor: parseFloat },
      'quantity': { mydealField: 'Quantity', defaultValue: 0, onlyInBuyableProducts: true, processor: parseInt },
      'isActive': { mydealField: 'ListingStatus', defaultValue: true, onlyInBuyableProducts: true, processor: (val) => val ? 1 : 0 },
      'productUnlimited': { mydealField: 'ProductUnlimited', defaultValue: false, onlyInBuyableProducts: true, processor: (val) => val === true || val === 'true' },
    };

    // Helper function to get the MyDeal field name from internal field name
    const getMappedFieldName = (internalField: string): string => {
      // If there's a custom mapping, use it
      if (fieldMappings[internalField]) {
        return fieldMappings[internalField];
      }
      // Otherwise use the default MyDeal field name from fieldDefaults
      const config = fieldDefaults[internalField];
      return config ? config.mydealField : internalField;
    };

    // Helper function to get field value
    const getFieldValue = (internalField: string, defaultValue: any = null): any => {
      // First check if value exists directly on product
      if (product[internalField] !== undefined && product[internalField] !== null) {
        return product[internalField];
      }

      // Then check in attributes
      if (product.attributes && Array.isArray(product.attributes)) {
        const attr = product.attributes.find(
          (a: any) => a.attribute?.name?.toLowerCase() === internalField.toLowerCase()
        );
        if (attr) {
          return attr.value;
        }
      }

      return defaultValue;
    };

    // Get base URL for relative image URLs
    const baseUrl = this.configService.get<string>('BASE_URL') || 'http://localhost:3000';

    // Helper function to convert relative URL to absolute URL
    const toAbsoluteUrl = (url: string): string => {
      if (!url) return '';
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
      const cleanUrl = url.startsWith('/') ? url : `/${url}`;
      return `${baseUrl}${cleanUrl}`;
    };

    // Match MyDeal category
    let categoryId = 135; // Default
    if (userId && productId) {
      categoryId = await this.matchMyDealCategory(productId, userId);
    }

    // Initialize payload with ONLY absolutely required fields
    const payload: any = {
      ExternalProductId: product.sku || product.id.toString(),
      ProductSKU: product.sku || product.id.toString(),
      Title: 'Untitled Product',
      Condition: 'new',
      Categories: [{ CategoryId: categoryId }], // Use the matched categoryId
      Images: [],
      ShippingCostCategory: 1,
      CustomFreightSchemeID: null,
      RequestFreightQuote: false,
      ProductSpecifics: [],
      IsDirectImport: false,
      BuyableProducts: [],
    };

    // Process each field based on selectedFields and fieldMappings
    Object.keys(fieldDefaults).forEach(internalField => {
      const config = fieldDefaults[internalField];
      const shouldExport = shouldExportField(internalField);
      
      // Skip fields that should only be in BuyableProducts
      if (config.onlyInBuyableProducts) {
        return;
      }
      
      // Always include required fields, or if field is in selectedFields (or no selectedFields specified)
      if (config.required || shouldExport) {
        const mappedFieldName = getMappedFieldName(internalField);
        let value = getFieldValue(internalField, config.defaultValue);
        
        // Apply processor if available
        if (config.processor && value !== null && value !== undefined) {
          value = config.processor(value);
        }
        
        // Set value in payload using the mapped field name
        payload[mappedFieldName] = value;
      }
    });

    // Handle special fields that always need to be set
    payload.ExternalProductId = product.sku || product.id.toString();
    
    // Handle images (only if images field should be exported)
    if (shouldExportField('images')) {
      const mainImageUrl = product.imageUrl || (product.assets?.[0]?.asset?.url || product.assets?.[0]?.url || product.assets?.[0]?.imageUrl);
      const subImages = product.subImages || product.assets?.slice(1, 10) || [];

      payload.Images = [
        ...(mainImageUrl ? [{
          Src: toAbsoluteUrl(mainImageUrl),
          Position: 0,
        }] : []),
        ...subImages.slice(0, 9).map((imageItem: any, index: number) => {
          const imageUrl = typeof imageItem === 'string' ? imageItem : (imageItem?.url || imageItem?.imageUrl || imageItem?.src || '');
          return {
            Src: toAbsoluteUrl(imageUrl),
            Position: index + 1,
          };
        }).filter(img => img.Src),
      ];
    }

    // Handle category - only override if explicitly provided in attributes
    if (shouldExportField('categoryId')) {
      const categoryAttr = getFieldValue('mydealCategoryId');
      if (categoryAttr) {
        // Only override if there's a specific MyDeal category ID in attributes
        payload.Categories = [{ CategoryId: parseInt(categoryAttr) || categoryId }];
      }
      // Otherwise keep the matched categoryId that was already set
    }

    // Handle BuyableProducts - only include fields that should be exported
    const hasPriceField = shouldExportField('price');
    const hasQuantityField = shouldExportField('quantity');
    const hasCompareAtPriceField = shouldExportField('compareAtPrice');
    const hasIsActiveField = shouldExportField('isActive');
    const hasProductUnlimitedField = shouldExportField('productUnlimited');

    const price = hasPriceField ? (parseFloat(getFieldValue('price', 0)) || 0) : 0;
    const compareAtPrice = hasCompareAtPriceField ? (parseFloat(getFieldValue('compareAtPrice', price)) || price) : price;
    const quantity = hasQuantityField ? (parseInt(getFieldValue('quantity', 0)) || 0) : 0;
    const isActive = hasIsActiveField ? getFieldValue('isActive', true) : true;
    const productUnlimited = hasProductUnlimitedField ? getFieldValue('productUnlimited', false) : false;

    // Attributes that should be mapped to BuyableProduct fields, not Options
    const buyableProductFieldAttributes = [
      'price', 'compareatprice', 'rrp', 'quantity', 'isactive', 'listingstatus',
      'productunlimited', 'sku', 'externalsku', 'barcode', 'gtin', 'mpn',
    ];

    // Check if variants should be exported
    const shouldExportVariants = shouldExportField('variants');
    
    // Build buyable products array with only variants that have differing attributes
    let buyableProducts: any[] = [];
    
    if (shouldExportVariants && product.variants?.length > 0) {
      // Process each variant and collect those with differing attributes
      const variantsWithOptions = product.variants
        .map((variant: any) => {
          const buyableProduct: any = {
            ExternalBuyableProductID: variant.sku || variant.id.toString(),
            SKU: variant.sku || variant.id.toString(),
          };

          if (hasPriceField) {
            buyableProduct.Price = parseFloat(variant.price) || price || 0;
          }
          if (hasCompareAtPriceField) {
            buyableProduct.RRP = parseFloat(variant.compareAtPrice || variant.price) || compareAtPrice || 0;
          }
          if (hasQuantityField) {
            buyableProduct.Quantity = variant.quantity !== undefined ? variant.quantity : quantity;
          }
          if (hasIsActiveField) {
            buyableProduct.ListingStatus = (variant.isActive !== undefined ? variant.isActive : isActive) ? 1 : 0;
          }
          if (hasProductUnlimitedField) {
            buyableProduct.ProductUnlimited = productUnlimited === true || productUnlimited === 'true';
          }

          // Build Options from variant attributes that differ from parent
          const options: any[] = [];
          
          if (variant.attributes && Array.isArray(variant.attributes)) {
            // Compare each variant attribute with parent attributes
            variant.attributes.forEach((varAttr: any) => {
              const attrId = varAttr.attribute?.id;
              const attrName = varAttr.attribute?.name;
              const varValue = varAttr.value;
              
              // Skip attributes that should be BuyableProduct fields, not Options
              if (attrName && buyableProductFieldAttributes.includes(attrName.toLowerCase())) {
                return;
              }
              
              // Find matching parent attribute
              const parentAttr = product.attributes?.find((pa: any) => pa.attribute?.id === attrId);
              const parentValue = parentAttr?.value;
              
              // Only include if value differs from parent or parent doesn't have this attribute
              if (!parentAttr || parentValue !== varValue) {
                options.push({
                  OptionName: attrName || 'Option',
                  OptionValue: varValue || '',
                  Position: options.length + 1,
                });
              }
            });
          }

          buyableProduct.Options = options;
          buyableProduct.MetaInfo = [];
          
          return { buyableProduct, hasOptions: options.length > 0 };
        })
        .filter(item => item.hasOptions) // Only include variants with differing attributes
        .map(item => item.buyableProduct);

      // If only one variant with options or no variants with options, treat as standalone product
      if (variantsWithOptions.length <= 1) {
        buyableProducts = [];
      } else {
        buyableProducts = variantsWithOptions;
      }
    }

    // If no buyable products with variants, create standalone product
    if (buyableProducts.length === 0) {
      const buyableProduct: any = {
        ExternalBuyableProductID: product.sku || product.id.toString(),
        SKU: product.sku || product.id.toString(),
        Options: [],
        MetaInfo: [],
      };

      if (hasPriceField) {
        buyableProduct.Price = price;
      }
      if (hasCompareAtPriceField) {
        buyableProduct.RRP = compareAtPrice;
      }
      if (hasQuantityField) {
        buyableProduct.Quantity = quantity;
      }
      if (hasIsActiveField) {
        buyableProduct.ListingStatus = isActive ? 1 : 0;
      }
      if (hasProductUnlimitedField) {
        buyableProduct.ProductUnlimited = productUnlimited === true || productUnlimited === 'true';
      }

      buyableProducts.push(buyableProduct);
    }

    payload.BuyableProducts = buyableProducts;

    // Build ProductSpecifics from remaining attributes (only if not in selectedFields restriction)
    const excludedAttributes = [
      'specifications', 'brand', 'condition', 'weight', 'weightunit',
      'length', 'height', 'width', 'dimensionunit', 'gtin', 'mpn',
      'barcode', 'manufacturerpartnumber', 'categoryid', 'mydealcategoryid',
      'price', 'compareatprice', 'rrp', 'quantity', 'requiresshipping',
      'shippingcoststandard', 'shippingcostexpedited', 'deliverytime',
      'maxdaysfordelivery', 'has48hoursdispatch', 'productunlimited', 'tags',
      'name', 'sku', 'description', 'isactive',
    ];

    if (product.attributes && Array.isArray(product.attributes)) {
      product.attributes.forEach((attr: any) => {
        const attrName = attr.attribute?.name;
        if (attrName && !excludedAttributes.includes(attrName.toLowerCase()) && attr.value) {
          payload.ProductSpecifics.push({
            Name: attrName,
            Value: attr.value.toString(),
          });
        }
      });
    }

    // this.logger.log(`Transformed product ${product.id} with ${product.attributes?.length || 0} attributes`);
    // this.logger.log(`ProductSpecifics: ${JSON.stringify(payload.ProductSpecifics)}`);

    return payload as MyDealProductPayload;
  }

  /**
  }

  /**
   * Create or update product on MyDeal
   */
  private async createOrUpdateMyDealProduct(
    products: MyDealProductPayload[]
  ): Promise<MyDealApiResponse> {
    try {
      // Log headers before sending
      // this.logger.log('Sending request to MyDeal /products endpoint with headers:', {
      //   Authorization: this.axiosInstance.defaults.headers['Authorization'] ? 'Bearer [REDACTED]' : 'MISSING',
      //   SellerID: this.axiosInstance.defaults.headers['SellerID'] || 'MISSING',
      //   SellerToken: this.axiosInstance.defaults.headers['SellerToken'] ? '[REDACTED]' : 'MISSING',
      //   ContentType: this.axiosInstance.defaults.headers['Content-Type'] || 'MISSING',
      // });

      const response = await this.axiosInstance.post<MyDealApiResponse>(
        '/products',
        products
      );

      return response.data;
    } catch (error: any) {
      this.logger.error('Failed to create/update MyDeal product:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Check work item status (for async operations)
   */
  async checkWorkItemStatus(workItemId: string, userId: number, connectionId?: number): Promise<MyDealApiResponse<any>> {
    try {
      // First, look up the work item from database to get the actual MyDeal work item ID
      const dbWorkItem = await this.prisma.myDealWorkItem.findUnique({
        where: { id: parseInt(workItemId) },
      });

      // this.logger.debug(`Work Item:${dbWorkItem}`);

      if (!dbWorkItem) {
        throw new BadRequestException(`Work item with ID ${workItemId} not found`);
      }

      // Extract the actual MyDeal work item ID from the pendingUri
      let actualWorkItemId: string | null = null;
      if (dbWorkItem.pendingUri) {
        const match = dbWorkItem.pendingUri.match(/workItemID=(\d+)/);
        if (match) {
          actualWorkItemId = match[1];
        }
      }



      if (!actualWorkItemId) {
        throw new BadRequestException(`Unable to extract MyDeal work item ID from pending URI: ${dbWorkItem.pendingUri}`);
      }

      // this.logger.log(`Checking MyDeal work item ID ${actualWorkItemId} (DB ID: ${workItemId})`);

      await this.connectWithCredentials(userId, connectionId);

      // Log headers before checking work item status
      // this.logger.log('Checking work item status with headers:', {
      //   Authorization: this.axiosInstance.defaults.headers['Authorization'] ? 'Bearer [REDACTED]' : 'MISSING',
      //   SellerID: this.axiosInstance.defaults.headers['SellerID'] || 'MISSING',
      //   SellerToken: this.axiosInstance.defaults.headers['SellerToken'] ? '[REDACTED]' : 'MISSING',
      //   workItemID: actualWorkItemId,
      // });

      const response = await this.axiosInstance.get<MyDealApiResponse>(
        '/pending-responses',
        {
          params: { workItemID: actualWorkItemId },
        }
      );

      // Update the work item in database
      const existingWorkItem = dbWorkItem;

      if (existingWorkItem) {
        const updateData: any = {
          responseData: response.data,
          updatedAt: new Date(),
        };

        if (response.data.ResponseStatus === 'Complete') {
          updateData.status = 'completed';
          updateData.completedAt = new Date();
          if (response.data.Data) {
            updateData.responseData = response.data.Data;
          }
        } else if (response.data.ResponseStatus === 'Failed') {
          updateData.status = 'failed';
          updateData.errorMessage = response.data.Errors?.map(e => e.Message).join(', ') || 'Unknown error';
        } else if (response.data.ResponseStatus === 'AsyncResponsePending') {
          updateData.status = 'processing';
        }

        await this.prisma.myDealWorkItem.update({
          where: { id: parseInt(workItemId) },
          data: updateData,
        });
      }

      return response.data;
    } catch (error: any) {
      this.logger.error('Failed to check work item status:', error);
      
      // Update work item as failed if it exists
      try {
        await this.prisma.myDealWorkItem.update({
          where: { id: parseInt(workItemId) },
          data: {
            status: 'failed',
            errorMessage: error.message,
            updatedAt: new Date(),
          },
        });
      } catch (dbError) {
        this.logger.error('Failed to update work item status:', dbError);
      }
      
      throw error;
    }
  }

  /**
   * Store work item in database
   */
  private async storeWorkItem(data: {
    workItemId: string;
    userId: number;
    connectionId?: number;
    productId?: number;
    status: string;
    operation: string;
    requestPayload?: any;
    responseData?: any;
    errorMessage?: string;
    pendingUri?: string;
    externalProductId?: string;
    externalSku?: string;
    completedAt?: Date;
  }): Promise<void> {

    // this.logger.log(`Storing work item ${data.workItemId} for user ${data.userId} for connection ${data.connectionId}`);
    try {
      await this.prisma.myDealWorkItem.upsert({
        where: { workItemId: data.workItemId },
        create: {
          workItemId: data.workItemId,
          userId: data.userId,
          connectionId: data.connectionId,
          productId: data.productId,
          status: data.status,
          operation: data.operation,
          requestPayload: data.requestPayload || null,
          responseData: data.responseData || null,
          errorMessage: data.errorMessage,
          pendingUri: data.pendingUri,
          externalProductId: data.externalProductId,
          externalSku: data.externalSku,
          completedAt: data.completedAt,
        },
        update: {
          status: data.status,
          responseData: data.responseData || null,
          errorMessage: data.errorMessage,
          externalProductId: data.externalProductId,
          completedAt: data.completedAt,
          updatedAt: new Date(),
        },
      });

      // this.logger.log(`Work item ${data.workItemId} stored/updated for user ${data.userId}`);
    } catch (error: any) {
      this.logger.error('Failed to store work item:', error);
      // Don't throw - this shouldn't break the main operation
    }
  }

  /**
   * Get work items for a user
   */
  async getWorkItems(userId: number, filters?: {
    status?: string;
    operation?: string;
    productId?: number;
    limit?: number;
  }) {
    const where: any = { userId };

    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.operation) {
      where.operation = filters.operation;
    }
    if (filters?.productId) {
      where.productId = filters.productId;
    }

    const workItems = await this.prisma.myDealWorkItem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 100,
    });

    return {
      success: true,
      count: workItems.length,
      items: workItems,
    };
  }

  /**
   * Update product price and quantity on MyDeal
   */
  async updateProductQuantityPrice(
    products: any[],
    userId: number,
    connectionId?: number,
  ): Promise<any> {
    try {
      await this.connectWithCredentials(userId, connectionId);

      const productGroups: any[] = [];
      const errors: any[] = [];

      // Process each product group
      for (const productGroup of products) {
        try {
          // Validate required fields
          if (!productGroup.ExternalProductID || !productGroup.ProductSKU) {
            errors.push({
              ID: productGroup.ExternalProductID || 'UNKNOWN',
              Code: 'InvalidRequest',
              Message: 'ExternalProductID and ProductSKU are required',
            });
            continue;
          }

          if (!productGroup.BuyableProducts || productGroup.BuyableProducts.length === 0) {
            errors.push({
              ID: productGroup.ExternalProductID,
              Code: 'InvalidRequest',
              Message: 'At least one BuyableProduct is required',
            });
            continue;
          }

          // Build the payload with only required fields
          const payload: any = {
            ExternalProductId: productGroup.ExternalProductID,
            ProductSKU: productGroup.ProductSKU,
            BuyableProducts: productGroup.BuyableProducts.map((bp: any) => {
              const buyableProduct: any = {
                ExternalBuyableProductID: bp.ExternalBuyableProductID,
                SKU: bp.SKU,
              };

              // Only include fields that are provided
              if (bp.Price !== undefined && bp.Price !== null) {
                buyableProduct.Price = parseFloat(bp.Price);
              }
              if (bp.RRP !== undefined && bp.RRP !== null) {
                buyableProduct.RRP = parseFloat(bp.RRP);
              }
              if (bp.ProductUnlimited === true) {
                buyableProduct.ProductUnlimited = true;
                // When ProductUnlimited is true, don't include Quantity
              } else if (bp.Quantity !== undefined && bp.Quantity !== null) {
                buyableProduct.Quantity = parseInt(bp.Quantity);
                buyableProduct.ProductUnlimited = false;
              }

              return buyableProduct;
            }),
          };

          // Make API call to MyDeal
          const response = await this.axiosInstance.post(
            '/products/quantityprice',
            [payload],
          );

          // Check response
          if (response.data?.ResponseStatus === 'Complete') {
            productGroups.push({
              ExternalProductID: productGroup.ExternalProductID,
              ProductSKU: productGroup.ProductSKU,
              Success: true,
              BuyableProductsProcessed: productGroup.BuyableProducts.length,
            });
          } else if (response.data?.ResponseStatus === 'AsyncResponsePending') {
            // Store work item for async processing
            await this.storeWorkItem({
              workItemId: response.data.PendingUri?.split('/').pop() || '',
              userId,
              connectionId,
              operation: 'UPDATE_QUANTITY_PRICE',
              status: 'pending',
              requestPayload: payload,
              pendingUri: response.data.PendingUri,
              externalProductId: productGroup.ExternalProductID,
              externalSku: productGroup.ProductSKU,
            });

            productGroups.push({
              ExternalProductID: productGroup.ExternalProductID,
              ProductSKU: productGroup.ProductSKU,
              Success: true,
              Message: 'Processing asynchronously',
              BuyableProductsProcessed: productGroup.BuyableProducts.length,
            });
          } else {
            // Handle errors from API response
            if (response.data?.Errors && response.data.Errors.length > 0) {
              errors.push(...response.data.Errors);
            }
            productGroups.push({
              ExternalProductID: productGroup.ExternalProductID,
              ProductSKU: productGroup.ProductSKU,
              Success: false,
              Message: response.data?.Errors?.[0]?.Message || 'Update failed',
            });
          }
        } catch (error: any) {
          this.logger.error(
            `Error updating product ${productGroup.ExternalProductID}:`,
            error.response?.data || error.message,
          );
          
          errors.push({
            ID: productGroup.ExternalProductID,
            Code: 'UpdateFailed',
            Message: error.response?.data?.message || error.message || 'Failed to update product',
          });

          productGroups.push({
            ExternalProductID: productGroup.ExternalProductID,
            ProductSKU: productGroup.ProductSKU,
            Success: false,
            Message: error.response?.data?.message || error.message,
          });
        }
      }

      return {
        ResponseStatus: errors.length === 0 ? 'Complete' : 'Failed',
        ProductGroups: productGroups,
        Errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error: any) {
      this.logger.error('Error in updateProductQuantityPrice:', error.response?.data || error.message);
      
      return {
        ResponseStatus: 'Failed',
        ProductGroups: [],
        Errors: [
          {
            ID: 'SYSTEM_ERROR',
            Code: 'SystemError',
            Message: error.response?.data?.message || error.message || 'Failed to process request',
          },
        ],
      };
    }
  }

  /**
   * Update product listing status on MyDeal
   */
  async updateProductListingStatus(
    products: any[],
    userId: number,
    connectionId?: number,
  ): Promise<any> {
    try {
      await this.connectWithCredentials(userId, connectionId);

      const productGroups: any[] = [];
      const errors: any[] = [];

      // Process each product group
      for (const productGroup of products) {
        try {
          // Validate required fields
          if (!productGroup.ExternalProductID || !productGroup.ProductSKU) {
            errors.push({
              ID: productGroup.ExternalProductID || 'UNKNOWN',
              Code: 'InvalidRequest',
              Message: 'ExternalProductID and ProductSKU are required',
            });
            continue;
          }

          if (!productGroup.BuyableProducts || productGroup.BuyableProducts.length === 0) {
            errors.push({
              ID: productGroup.ExternalProductID,
              Code: 'InvalidRequest',
              Message: 'At least one BuyableProduct is required',
            });
            continue;
          }

          // Validate ListingStatus values
          const invalidStatuses = productGroup.BuyableProducts.filter(
            (bp: any) => bp.ListingStatus !== 'NotLive' && bp.ListingStatus !== 'Live',
          );
          if (invalidStatuses.length > 0) {
            errors.push({
              ID: productGroup.ExternalProductID,
              Code: 'InvalidRequest',
              Message: 'ListingStatus must be either "NotLive" or "Live"',
            });
            continue;
          }

          // Build the payload with only required fields
          const payload: any = {
            ExternalProductId: productGroup.ExternalProductID,
            ProductSKU: productGroup.ProductSKU,
            BuyableProducts: productGroup.BuyableProducts.map((bp: any) => ({
              ExternalBuyableProductID: bp.ExternalBuyableProductID,
              SKU: bp.SKU,
              ListingStatus: bp.ListingStatus,
            })),
          };

          // Make API call to MyDeal
          const response = await this.axiosInstance.post(
            '/products/listingstatus',
            [payload],
          );

          // Check response
          if (response.data?.ResponseStatus === 'Complete') {
            productGroups.push({
              ExternalProductID: productGroup.ExternalProductID,
              ProductSKU: productGroup.ProductSKU,
              Success: true,
              BuyableProductsProcessed: productGroup.BuyableProducts.length,
            });
          } else if (response.data?.ResponseStatus === 'AsyncResponsePending') {
            // Store work item for async processing
            await this.storeWorkItem({
              workItemId: response.data.PendingUri?.split('/').pop() || '',
              userId,
              connectionId,
              operation: 'UPDATE_LISTING_STATUS',
              status: 'pending',
              requestPayload: payload,
              pendingUri: response.data.PendingUri,
              externalProductId: productGroup.ExternalProductID,
              externalSku: productGroup.ProductSKU,
            });

            productGroups.push({
              ExternalProductID: productGroup.ExternalProductID,
              ProductSKU: productGroup.ProductSKU,
              Success: true,
              Message: 'Processing asynchronously',
              BuyableProductsProcessed: productGroup.BuyableProducts.length,
            });
          } else {
            // Handle errors from API response
            if (response.data?.Errors && response.data.Errors.length > 0) {
              errors.push(...response.data.Errors);
            }
            productGroups.push({
              ExternalProductID: productGroup.ExternalProductID,
              ProductSKU: productGroup.ProductSKU,
              Success: false,
              Message: response.data?.Errors?.[0]?.Message || 'Update failed',
            });
          }
        } catch (error: any) {
          this.logger.error(
            `Error updating listing status for product ${productGroup.ExternalProductID}:`,
            error.response?.data || error.message,
          );
          
          errors.push({
            ID: productGroup.ExternalProductID,
            Code: 'UpdateFailed',
            Message: error.response?.data?.message || error.message || 'Failed to update listing status',
          });

          productGroups.push({
            ExternalProductID: productGroup.ExternalProductID,
            ProductSKU: productGroup.ProductSKU,
            Success: false,
            Message: error.response?.data?.message || error.message,
          });
        }
      }

      return {
        ResponseStatus: errors.length === 0 ? 'Complete' : 'Failed',
        ProductGroups: productGroups,
        Errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error: any) {
      this.logger.error('Error in updateProductListingStatus:', error.response?.data || error.message);
      
      return {
        ResponseStatus: 'Failed',
        ProductGroups: [],
        Errors: [
          {
            ID: 'SYSTEM_ERROR',
            Code: 'SystemError',
            Message: error.response?.data?.message || error.message || 'Failed to process request',
          },
        ],
      };
    }
  }
}
