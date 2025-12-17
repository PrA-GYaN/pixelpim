import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WooCommerceConnectionService } from './woocommerce-connection.service';
import {
  ExportProductsDto,
  ExportProductsResponseDto,
  ProductSyncResponseDto,
  ImportProductsDto,
  ImportProductsResponseDto,
} from './dto/woocommerce-connection.dto';

@Injectable()
export class WooCommerceMultiStoreService {
  private readonly logger = new Logger(WooCommerceMultiStoreService.name);

  constructor(
    private prisma: PrismaService,
    private connectionService: WooCommerceConnectionService,
  ) {}

  /**
   * Export products to a specific WooCommerce connection with selective fields
   */
  async exportProducts(
    userId: number,
    dto: ExportProductsDto,
  ): Promise<ExportProductsResponseDto> {
    // Get connection and verify ownership
    const connection = await this.connectionService.getConnection(userId, dto.connectionId);
    const wooClient = await this.connectionService.getWooCommerceClient(
      userId,
      dto.connectionId,
    );

    console.log("Client Connected Successfully");

    // Get export mapping or use provided fields
    let fieldsToExport = dto.fieldsToExport;
    let fieldMappings: Record<string, any> = {};

    if (!fieldsToExport) {
      const exportMapping = await this.connectionService.getActiveExportMapping(
        userId,
        dto.connectionId,
      );

      if (exportMapping) {
        fieldsToExport = exportMapping.selectedFields;
        fieldMappings = exportMapping.fieldMappings;
      } else {
        // Default fields if no mapping exists
        fieldsToExport = ['name', 'sku'];
      }
    }

    // Validate that required fields are present
    if (!fieldsToExport.includes('name') || !fieldsToExport.includes('sku')) {
      throw new BadRequestException('Export must include "name" and "sku" fields');
    }

    const results: ProductSyncResponseDto[] = [];
    let syncedCount = 0;
    let failedCount = 0;

    // Fetch products with their attributes
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: dto.productIds },
        userId,
        isDeleted: false,
      },
      include: {
        attributes: {
          include: {
            attribute: true,
          },
        },
        category: true,
        assets: {
          include: {
            asset: true,
          },
        },
      },
    });

    for (const product of products) {
      try {
        // Check if product already synced to this connection
        const existingSync = await this.prisma.wooCommerceProductSync.findUnique({
          where: {
            connectionId_productId: {
              connectionId: dto.connectionId,
              productId: product.id,
            },
          },
        });

        // Build WooCommerce product data based on selected fields
        const wooProductData = await this.buildWooProductData(
          product,
          fieldsToExport,
          fieldMappings,
          dto.partialUpdate && existingSync ? existingSync.lastModifiedFields as any : null,
          wooClient,
        );

        // this.logger.log(`Product Data:${JSON.stringify(wooProductData)}`);
        let wooProductId: number;
        // this.logger.log(`Product Data:${JSON.stringify(product)}`);
        // this.logger.log(`Found Existing Sync:${JSON.stringify(existingSync)}`);
        // this.logger.log(`WooCommerce Data:${JSON.stringify(wooProductData)}`);
        
        if (existingSync && existingSync.wooProductId && existingSync.wooProductId > 0) {
          // Update existing product (only if wooProductId is valid)
          this.logger.log(
            `Updating WooCommerce product ${existingSync.wooProductId} for local product ${product.id}`,
          );

          const response = await wooClient.put(
            `products/${existingSync.wooProductId}`,
            wooProductData,
          );
          wooProductId = response.data.id;

          // Update sync record
          await this.prisma.wooCommerceProductSync.update({
            where: { id: existingSync.id },
            data: {
              lastExportedAt: new Date(),
              lastModifiedFields: fieldsToExport,
              syncStatus: 'synced',
              errorMessage: null,
            },
          });
        } else {
          // Create new product (or retry if previous sync had invalid wooProductId)
          this.logger.log(`Creating new WooCommerce product for local product ${product.id}`);
          this.logger.log(`Woocommerce Data:${wooProductData}`)
          const response = await wooClient.post('products', wooProductData);
          this.logger.log(`Response from WooClient:${response}`)
          wooProductId = response.data.id;

          // Create or update sync record
          if (existingSync) {
            // Update existing sync record with valid wooProductId
            await this.prisma.wooCommerceProductSync.update({
              where: { id: existingSync.id },
              data: {
                wooProductId,
                lastExportedAt: new Date(),
                lastModifiedFields: fieldsToExport,
                syncStatus: 'synced',
                errorMessage: null,
              },
            });
          } else {
            // Create new sync record
            await this.prisma.wooCommerceProductSync.create({
              data: {
                connectionId: dto.connectionId,
                productId: product.id,
                wooProductId,
                lastExportedAt: new Date(),
                lastModifiedFields: fieldsToExport,
                syncStatus: 'synced',
              },
            });
          }
        }

        results.push({
          connectionId: dto.connectionId,
          productId: product.id,
          wooProductId,
          status: 'success',
          exportedFields: fieldsToExport,
          lastExportedAt: new Date(),
        });

        syncedCount++;
      } catch (error: any) {
        this.logger.error(
          `Failed to export product ${product.id} to connection ${dto.connectionId}:`,
          error,
        );

        // Update or create sync record with error
        await this.prisma.wooCommerceProductSync.upsert({
          where: {
            connectionId_productId: {
              connectionId: dto.connectionId,
              productId: product.id,
            },
          },
          update: {
            syncStatus: 'error',
            errorMessage: error.message || 'Export failed',
          },
          create: {
            connectionId: dto.connectionId,
            productId: product.id,
            wooProductId: 0, // Placeholder
            syncStatus: 'error',
            errorMessage: error.message || 'Export failed',
          },
        });

        results.push({
          connectionId: dto.connectionId,
          productId: product.id,
          status: 'error',
          message: error.response?.data?.message || error.message || 'Export failed',
        });

        failedCount++;
      }
    }

    // Update last synced timestamp
    await this.connectionService.updateLastSynced(dto.connectionId);

    return {
      success: failedCount === 0,
      connectionId: dto.connectionId,
      syncedCount,
      failedCount,
      results,
    };
  }

  /**
   * Import products from WooCommerce with attribute mapping
   */
  async importProducts(
    userId: number,
    dto: ImportProductsDto,
  ): Promise<ImportProductsResponseDto> {
    // Get connection and verify ownership
    const connection = await this.connectionService.getConnection(userId, dto.connectionId);
    const wooClient = await this.connectionService.getWooCommerceClient(
      userId,
      dto.connectionId,
    );

    // Get import mapping if requested
    let attributeMappings: Record<string, any> = {};
    let fieldMappings: Record<string, any> = {};

    if (dto.useMapping !== false) {
      const importMapping = await this.connectionService.getActiveImportMapping(
        userId,
        dto.connectionId,
      );

      if (importMapping) {
        attributeMappings = importMapping.attributeMappings;
        fieldMappings = importMapping.fieldMappings;
      }
    }

    const products: Array<{
      wooProductId: number;
      productId?: number;
      status: 'imported' | 'updated' | 'error';
      message?: string;
    }> = [];

    let importedCount = 0;
    let updatedCount = 0;
    let failedCount = 0;

    try {
      // Fetch products from WooCommerce
      let wooProducts: any[];

      if (dto.wooProductIds && dto.wooProductIds.length > 0) {
        // Fetch specific products
        wooProducts = await Promise.all(
          dto.wooProductIds.map(async (id) => {
            const response = await wooClient.get(`products/${id}`);
            return response.data;
          }),
        );
      } else {
        // Fetch all products (paginated)
        wooProducts = await this.getAllWooProducts(wooClient);
      }

      for (const wooProduct of wooProducts) {
        try {
          this.logger.log(`WooCommerce product data for ID ${wooProduct.id}: ${JSON.stringify(wooProduct, null, 2)}`);
          // Check if product already exists in our system
          const existingSync = await this.prisma.wooCommerceProductSync.findUnique({
            where: {
              connectionId_wooProductId: {
                connectionId: dto.connectionId,
                wooProductId: wooProduct.id,
              },
            },
          });

          // Check if sync exists and has a valid product
          const hasValidProduct = existingSync && existingSync.productId && existingSync.productId > 0;

          if (hasValidProduct) {
            if (!dto.updateExisting) {
              this.logger.log(
                `Skipping WooCommerce product ${wooProduct.id} - already imported`,
              );
              continue;
            }

            // TypeScript assertion: we know productId is valid here due to hasValidProduct check
            const validProductId = existingSync.productId!;

            // Update existing product
            const productData = await this.buildLocalProductData(
              wooProduct,
              attributeMappings,
              fieldMappings,
              userId,
            );
            this.logger.log(`Mapped local product data for WooCommerce ID ${wooProduct.id}: ${JSON.stringify(productData, null, 2)}`);

            // Extract attributes to create separately
            const attributesToCreate = productData._attributesToCreate;
            delete productData._attributesToCreate;

            await this.prisma.product.update({
              where: { id: validProductId },
              data: productData,
            });

            // Process attributes
            if (attributesToCreate && attributesToCreate.length > 0) {
              await this.processProductAttributes(validProductId, userId, attributesToCreate);
            }

            // Update sync record
            await this.prisma.wooCommerceProductSync.update({
              where: { id: existingSync.id },
              data: {
                lastImportedAt: new Date(),
                syncStatus: 'synced',
                errorMessage: null,
              },
            });

            products.push({
              wooProductId: wooProduct.id,
              productId: validProductId,
              status: 'updated',
            });

            updatedCount++;
          } else {
            // Import new product
            const productData = await this.buildLocalProductData(
              wooProduct,
              attributeMappings,
              fieldMappings,
              userId,
            );

            this.logger.log(`Mapped local product data for WooCommerce ID ${wooProduct.id}: ${JSON.stringify(productData, null, 2)}`);
            
            // Extract attributes to create separately
            const attributesToCreate = productData._attributesToCreate;
            delete productData._attributesToCreate;

            const newProduct = await this.prisma.product.create({
              data: {
                ...productData,
                userId,
              },
            });

            // Process attributes
            if (attributesToCreate && attributesToCreate.length > 0) {
              await this.processProductAttributes(newProduct.id, userId, attributesToCreate);
            }

            // Create or update sync record
            if (existingSync) {
              // Update existing sync record with valid productId
              await this.prisma.wooCommerceProductSync.update({
                where: { id: existingSync.id },
                data: {
                  productId: newProduct.id,
                  lastImportedAt: new Date(),
                  syncStatus: 'synced',
                  errorMessage: null,
                },
              });
              this.logger.log(`Updated sync record for WooCommerce product ${wooProduct.id} with new product ID ${newProduct.id}`);
            } else {
              // Create new sync record
              await this.prisma.wooCommerceProductSync.create({
                data: {
                  connectionId: dto.connectionId,
                  productId: newProduct.id,
                  wooProductId: wooProduct.id,
                  lastImportedAt: new Date(),
                  syncStatus: 'synced',
                },
              });
            }

            products.push({
              wooProductId: wooProduct.id,
              productId: newProduct.id,
              status: 'imported',
            });

            importedCount++;
          }
        } catch (error: any) {
          this.logger.error(
            `Failed to import WooCommerce product ${wooProduct.id}:`,
            error,
          );

          // Create/update sync record with error status and null productId
          await this.prisma.wooCommerceProductSync.upsert({
            where: {
              connectionId_wooProductId: {
                connectionId: dto.connectionId,
                wooProductId: wooProduct.id,
              },
            },
            update: {
              syncStatus: 'error',
              errorMessage: error.message || 'Import failed',
            },
            create: {
              connectionId: dto.connectionId,
              productId: null, // Null for failed imports
              wooProductId: wooProduct.id,
              syncStatus: 'error',
              errorMessage: error.message || 'Import failed',
            },
          });

          products.push({
            wooProductId: wooProduct.id,
            status: 'error',
            message: error.message || 'Import failed',
          });

          failedCount++;
        }
      }
    } catch (error: any) {
      this.logger.error('Failed to fetch products from WooCommerce:', error);
      throw new BadRequestException(
        error.response?.data?.message || 'Failed to fetch products from WooCommerce',
      );
    }

    // Update last synced timestamp
    await this.connectionService.updateLastSynced(dto.connectionId);

    return {
      success: failedCount === 0,
      importedCount,
      updatedCount,
      failedCount,
      products,
    };
  }

  /**
   * Update a single product in WooCommerce (partial update)
   */
  async updateProduct(
    userId: number,
    connectionId: number,
    productId: number,
  ): Promise<ProductSyncResponseDto> {
    // Get connection and verify ownership
    await this.connectionService.getConnection(userId, connectionId);
    const wooClient = await this.connectionService.getWooCommerceClient(userId, connectionId);

    // Get product
    const product = await this.prisma.product.findFirst({
      where: { id: productId, userId, isDeleted: false },
      include: {
        attributes: { include: { attribute: true } },
        category: true,
        assets: { include: { asset: true } },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Get sync record
    const sync = await this.prisma.wooCommerceProductSync.findUnique({
      where: {
        connectionId_productId: {
          connectionId,
          productId,
        },
      },
    });

    if (!sync) {
      throw new NotFoundException('Product not synced to this connection');
    }

    // Get export mapping
    const exportMapping = await this.connectionService.getActiveExportMapping(
      userId,
      connectionId,
    );

    const fieldsToExport = exportMapping?.selectedFields || ['name', 'sku'];
    const fieldMappings = exportMapping?.fieldMappings || {};

    // Build partial update data
    const wooProductData = await this.buildWooProductData(
      product,
      fieldsToExport,
      fieldMappings,
      sync.lastModifiedFields as any,
      wooClient,
    );

    try {
      await wooClient.put(`products/${sync.wooProductId}`, wooProductData);

      // Update sync record
      await this.prisma.wooCommerceProductSync.update({
        where: { id: sync.id },
        data: {
          lastExportedAt: new Date(),
          lastModifiedFields: fieldsToExport,
          syncStatus: 'synced',
          errorMessage: null,
        },
      });

      return {
        connectionId,
        productId,
        wooProductId: sync.wooProductId,
        status: 'success',
        exportedFields: fieldsToExport,
        lastExportedAt: new Date(),
      };
    } catch (error: any) {
      this.logger.error(`Failed to update product ${productId}:`, error);

      await this.prisma.wooCommerceProductSync.update({
        where: { id: sync.id },
        data: {
          syncStatus: 'error',
          errorMessage: error.message || 'Update failed',
        },
      });

      return {
        connectionId,
        productId,
        wooProductId: sync.wooProductId,
        status: 'error',
        message: error.response?.data?.message || error.message || 'Update failed',
      };
    }
  }

  /**
   * Delete a product from WooCommerce
   */
  async deleteProduct(
    userId: number,
    connectionId: number,
    productId: number,
  ): Promise<{ success: boolean; message?: string }> {
    // Get connection and verify ownership
    await this.connectionService.getConnection(userId, connectionId);
    const wooClient = await this.connectionService.getWooCommerceClient(userId, connectionId);

    // Get sync record
    const sync = await this.prisma.wooCommerceProductSync.findUnique({
      where: {
        connectionId_productId: {
          connectionId,
          productId,
        },
      },
    });

    if (!sync) {
      throw new NotFoundException('Product not synced to this connection');
    }

    try {
      // Delete from WooCommerce
      await wooClient.delete(`products/${sync.wooProductId}`, { force: true });

      // Delete sync record
      await this.prisma.wooCommerceProductSync.delete({
        where: { id: sync.id },
      });

      return { success: true };
    } catch (error: any) {
      this.logger.error(`Failed to delete product ${productId}:`, error);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Delete failed',
      };
    }
  }

  /**
   * Get sync status for products
   */
  async getSyncStatus(
    userId: number,
    connectionId: number,
    productIds?: number[],
    paginationDto?: { page?: number; limit?: number; skip?: number },
  ): Promise<any> {
    // Verify connection ownership
    await this.connectionService.getConnection(userId, connectionId);

    const where: any = { connectionId };
    if (productIds && productIds.length > 0) {
      where.productId = { in: productIds };
    }

    // If no pagination provided, return all (for backward compatibility)
    if (!paginationDto) {
      return this.prisma.wooCommerceProductSync.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
      });
    }

    // With pagination, return paginated response
    const page = paginationDto.page ?? 1;
    const limit = paginationDto.limit ?? 10;
    const skip = paginationDto.skip ?? (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.wooCommerceProductSync.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.wooCommerceProductSync.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  // ===== Helper Methods =====

  /**
   * Build WooCommerce product data from local product
   */
  private async buildWooProductData(
    product: any,
    fieldsToExport: string[],
    fieldMappings: Record<string, any>,
    lastModifiedFields: string[] | null,
    wooClient: any,
  ): Promise<any> {
    // Validate required fields
    if (!product.name || !product.sku) {
      throw new BadRequestException('Product must have name and sku');
    }

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
        patterns.some(pattern => attr.attribute.name.toLowerCase().includes(pattern.toLowerCase()))
      );
    };

    // Helper function to extract numeric value
    const extractNumeric = (value: string): string => {
      if (!value) return '';
      return value.replace(/[^\d.]/g, '');
    };

    // Check if field should be included
    const shouldIncludeField = (field: string): boolean => {
      if (!fieldsToExport.includes(field)) return false;
      if (lastModifiedFields) {
        // If field is in lastModifiedFields, include it
        if (lastModifiedFields.includes(field)) return true;
        // If 'attributes' was previously exported and field is an attribute, include it
        if (lastModifiedFields.includes('attributes') && isAttributeField(field)) return true;
        return false;
      }
      return true;
    };

    // Check if field is an attribute field (not a standard WooCommerce field)
    const isAttributeField = (field: string): boolean => {
      const standardFields = ['name', 'sku', 'price', 'sale_price', 'weight', 'dimensions', 'stock_status', 'description', 'images', 'categories', 'tags', 'status', 'type'];
      return !standardFields.includes(field);
    };

    // Get mapped field name
    const getMappedField = (field: string): string => {
      return fieldMappings[field] || field;
    };

    const wooProduct: any = {};

    // Required fields
    if (shouldIncludeField('name')) {
      wooProduct[getMappedField('name')] = product.name;
    }
    if (shouldIncludeField('sku')) {
      wooProduct[getMappedField('sku')] = product.sku;
    }

    // Optional fields
    // Images
    if (shouldIncludeField('images')) {
      const images: Array<{ src: string; alt: string }> = [];
      if (product.imageUrl) {
        images.push({ src: product.imageUrl, alt: product.name });
      }
      if (product.subImages && product.subImages.length > 0) {
        product.subImages.forEach((url: string, index: number) => {
          images.push({ src: url, alt: `${product.name} - Gallery ${index + 1}` });
        });
      }
      if (images.length > 0) {
        wooProduct[getMappedField('images')] = images;
      }
    }

    // Pricing
    if (shouldIncludeField('price') || shouldIncludeField('regular_price')) {
      const regularPriceAttr = findAttribute(['regular_price', 'price', 'regular price']);
      const regularPrice = regularPriceAttr ? extractNumeric(regularPriceAttr.value) : '';
      if (regularPrice) {
        wooProduct[getMappedField('regular_price')] = regularPrice;
      }
    }

    if (shouldIncludeField('sale_price')) {
      const salePriceAttr = findAttribute(['sale_price', 'sale price', 'discount price']);
      const salePrice = salePriceAttr ? extractNumeric(salePriceAttr.value) : '';
      if (salePrice) {
        wooProduct[getMappedField('sale_price')] = salePrice;
      }
    }

    if (shouldIncludeField('date_on_sale_from')) {
      const saleStartDateAttr = findAttribute(['sale_start_date', 'sale start', 'discount start']);
      if (saleStartDateAttr?.value) {
        wooProduct[getMappedField('date_on_sale_from')] = saleStartDateAttr.value;
      }
    }

    if (shouldIncludeField('date_on_sale_to')) {
      const saleEndDateAttr = findAttribute(['sale_end_date', 'sale end', 'discount end']);
      if (saleEndDateAttr?.value) {
        wooProduct[getMappedField('date_on_sale_to')] = saleEndDateAttr.value;
      }
    }

    // Weight
    if (shouldIncludeField('weight')) {
      const weightAttr = findAttribute(['weight']);
      if (weightAttr?.value) {
        wooProduct[getMappedField('weight')] = extractNumeric(weightAttr.value);
      }
    }

    // Dimensions
    if (shouldIncludeField('dimensions')) {
      const lengthAttr = findAttribute(['length', 'dimension_length']);
      const widthAttr = findAttribute(['width', 'dimension_width']);
      const heightAttr = findAttribute(['height', 'dimension_height']);
      const dimensions: any = {};
      if (lengthAttr?.value) dimensions.length = extractNumeric(lengthAttr.value);
      if (widthAttr?.value) dimensions.width = extractNumeric(widthAttr.value);
      if (heightAttr?.value) dimensions.height = extractNumeric(heightAttr.value);
      if (Object.keys(dimensions).length > 0) {
        wooProduct[getMappedField('dimensions')] = dimensions;
      }
    }

    // Stock status
    if (shouldIncludeField('stock_status')) {
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
      wooProduct[getMappedField('stock_status')] = stockStatus;
    }

    // Description
    if (shouldIncludeField('description')) {
      let description = '';
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
      if (description) {
        wooProduct[getMappedField('description')] = description;
      }
    }

    // Categories
    if (shouldIncludeField('categories') && product.category) {
      const categoryId = await this.ensureWooCommerceCategory(product.category.name, wooClient);
      wooProduct[getMappedField('categories')] = [{ id: categoryId }];
    }

    // Tags
    if (shouldIncludeField('tags')) {
      const tagsAttr = findAttribute(['tags', 'product tags']);
      const tags: Array<{ name: string }> = [];
      if (tagsAttr?.value) {
        const tagValues = tagsAttr.value.split(',').map((tag: string) => tag.trim());
        tagValues.forEach((tag: string) => {
          if (tag) tags.push({ name: tag });
        });
      }
      if (tags.length > 0) {
        wooProduct[getMappedField('tags')] = tags;
      }
    }

    // Attributes - only include selected individual attributes
    const wooAttributes: Array<{ name: string; options: string[]; visible: boolean; variation: boolean }> = [];
    const mappedAttributeNames = [
      'regular_price', 'price', 'regular price', 'sale_price', 'sale price', 'discount price',
      'sale_start_date', 'sale start', 'discount start', 'sale_end_date', 'sale end', 'discount end',
      'weight', 'length', 'width', 'height', 'dimension_length', 'dimension_width', 'dimension_height',
      'stock_status', 'stock status', 'availability', 'description', 'desc', 'long description',
      'tags', 'product tags', 'categories', 'category'
    ];

    if (product.attributes && product.attributes.length > 0) {
      for (const attr of product.attributes) {
        const attrName = attr.attribute.name.toLowerCase();
        const isMapped = mappedAttributeNames.some(name => attrName.includes(name.toLowerCase()));
        if (!isMapped && shouldIncludeField(attr.attribute.name) && attr.value) {
          let options: string[] = [];
          try {
            if (typeof attr.value === 'string' && attr.value.trim().startsWith('[')) {
              const parsed = JSON.parse(attr.value);
              options = Array.isArray(parsed) ? parsed : [attr.value];
            } else {
              options = [attr.value];
            }
          } catch (e) {
            options = [attr.value];
          }
          const variationPatterns = ['color', 'colour', 'size', 'material', 'style'];
          const isVariation = variationPatterns.some(pattern => attrName.includes(pattern));
          await this.ensureWooCommerceAttribute(attr.attribute.name, options, wooClient);
          wooAttributes.push({
            name: attr.attribute.name,
            options: options,
            visible: true,
            variation: isVariation
          });
        }
      }
    }
    if (wooAttributes.length > 0) {
      wooProduct[getMappedField('attributes')] = wooAttributes;
    }

    // Status
    if (shouldIncludeField('status')) {
      let productStatus = 'draft';
      const statusAttr = findAttribute(['status', 'publish status']);
      if (statusAttr?.value) {
        const value = statusAttr.value.toLowerCase();
        productStatus = value.includes('publish') ? 'publish' : 'draft';
      } else if (product.status) {
        productStatus = product.status === 'complete' ? 'publish' : 'draft';
      }
      wooProduct[getMappedField('status')] = productStatus;
    }

    // Type
    if (shouldIncludeField('type')) {
      wooProduct[getMappedField('type')] = 'simple';
    }

    return wooProduct;
  }

  /**
   * Build local product data from WooCommerce product
   */
  private async buildLocalProductData(
    wooProduct: any,
    attributeMappings: Record<string, any>,
    fieldMappings: Record<string, any>,
    userId: number,
  ): Promise<any> {
    // 1. Validate required fields (name and SKU)
    if (!wooProduct.name || !wooProduct.sku) {
      throw new BadRequestException(
        `Product ID ${wooProduct.id} is missing required field(s): ${!wooProduct.name ? 'name' : ''} ${!wooProduct.sku ? 'sku' : ''}`.trim()
      );
    }

    const data: any = {
      name: wooProduct.name,
      sku: wooProduct.sku,
    };

    // Description
    if (wooProduct.description) {
      data.productLink = wooProduct.description;
    }

    // Images
    if (wooProduct.images && wooProduct.images.length > 0) {
      data.imageUrl = wooProduct.images[0].src;
      if (wooProduct.images.length > 1) {
        data.subImages = wooProduct.images.slice(1).map((img: any) => img.src);
      }
    }

    // 2. Create and map attributes from attributeMappings
    const attributesToCreate: Array<{ name: string; value: any; type: string }> = [];
    
    // Check if "map all" is enabled
    const mapAllAttributes = attributeMappings && attributeMappings['*'] === '*';
    
    // Process WooCommerce attributes -> Local attributes
    if (mapAllAttributes) {
      // Map all WooCommerce attributes automatically
      this.logger.log('Mapping all attributes from WooCommerce product');
      
      if (wooProduct.attributes && Array.isArray(wooProduct.attributes)) {
        for (const wooAttr of wooProduct.attributes) {
          if (wooAttr.options && wooAttr.options.length > 0) {
            const value = wooAttr.options.join(', ');
            const attrName = wooAttr.name || wooAttr.slug;
            
            this.logger.log(`Auto-mapping attribute ${attrName}: ${value}`);
            
            attributesToCreate.push({
              name: attrName,
              value,
              type: 'TEXT',
            });
          }
        }
      }
    } else if (attributeMappings && Object.keys(attributeMappings).length > 0) {
      // Use specific attribute mappings
      this.logger.log(`Processing attribute mappings: ${JSON.stringify(attributeMappings)}`);
      
      for (const [wooAttrKey, localAttrName] of Object.entries(attributeMappings)) {
        // Skip the special "*" marker
        if (wooAttrKey === '*') continue;
        
        // Find the attribute in WooCommerce product data
        let value: any = null;
        
        // Check in WooCommerce attributes array
        if (wooProduct.attributes && Array.isArray(wooProduct.attributes)) {
          const wooAttr = wooProduct.attributes.find((attr: any) => 
            attr.slug === wooAttrKey || attr.name === wooAttrKey
          );
          
          if (wooAttr && wooAttr.options && wooAttr.options.length > 0) {
            value = wooAttr.options.join(', '); // Join multiple options
            this.logger.log(`Found attribute ${wooAttrKey} -> ${localAttrName}: ${value}`);
          }
        }
        
        if (value) {
          attributesToCreate.push({
            name: localAttrName as string,
            value,
            type: 'TEXT', // Default type
          });
        }
      }
    }

    // 3. Process field mappings (e.g., price, salePrice)
    if (fieldMappings && Object.keys(fieldMappings).length > 0) {
      this.logger.log(`Processing field mappings: ${JSON.stringify(fieldMappings)}`);
      
      for (const [wooField, localAttrName] of Object.entries(fieldMappings)) {
        let value: any = null;
        
        // Get value from WooCommerce product
        if (wooProduct[wooField] !== undefined && wooProduct[wooField] !== null && wooProduct[wooField] !== '') {
          value = wooProduct[wooField];
          this.logger.log(`Found field ${wooField} -> ${localAttrName}: ${value}`);
          
          attributesToCreate.push({
            name: localAttrName as string,
            value: String(value),
            type: 'TEXT', // Will be determined by attribute type if it exists
          });
        }
      }
    }

    // 4. Handle category (only if "categories" is in fieldMappings)
    let categoryId: number | null = null;
    
    // Check if categories field is mapped
    const categoryFieldMapped = fieldMappings && 
      (fieldMappings['categories'] || Object.values(fieldMappings).includes('category') || Object.values(fieldMappings).includes('categories'));
    
    if (categoryFieldMapped && wooProduct.categories && Array.isArray(wooProduct.categories) && wooProduct.categories.length > 0) {
      // Filter out "Uncategorized"
      const validCategories = wooProduct.categories.filter(
        (cat: any) => cat.name && cat.name.toLowerCase() !== 'uncategorized'
      );
      
      if (validCategories.length > 0) {
        const primaryCategory = validCategories[0];
        this.logger.log(`Processing category: ${primaryCategory.name}`);
        
        // Find or create category
        categoryId = await this.findOrCreateCategory(primaryCategory.name, userId);
        data.categoryId = categoryId;
      }
    }

    // Store attributes to be created after product is created/updated
    if (attributesToCreate.length > 0) {
      data._attributesToCreate = attributesToCreate;
    }

    return data;
  }

  /**
   * Find or create category for the user
   */
  private async findOrCreateCategory(categoryName: string, userId: number): Promise<number> {
    // First try to find existing category
    let category = await this.prisma.category.findFirst({
      where: {
        name: categoryName,
        userId,
        parentCategoryId: null,
      },
    });

    if (!category) {
      this.logger.log(`Creating new category: ${categoryName}`);
      category = await this.prisma.category.create({
        data: {
          name: categoryName,
          userId,
        },
      });
    }

    return category.id;
  }

  /**
   * Find or create attribute for the user
   */
  private async findOrCreateAttribute(attributeName: string, userId: number, type: string = 'TEXT'): Promise<number> {
    // First try to find existing attribute
    let attribute = await this.prisma.attribute.findFirst({
      where: {
        name: attributeName,
        userId,
      },
    });

    if (!attribute) {
      this.logger.log(`Creating new attribute: ${attributeName}`);
      attribute = await this.prisma.attribute.create({
        data: {
          name: attributeName,
          type,
          userId,
        },
      });
    }

    return attribute.id;
  }

  /**
   * Process and attach attributes to a product
   */
  private async processProductAttributes(
    productId: number,
    userId: number,
    attributesToCreate: Array<{ name: string; value: any; type: string }>
  ): Promise<void> {
    if (!attributesToCreate || attributesToCreate.length === 0) {
      return;
    }

    this.logger.log(`Creating ${attributesToCreate.length} attributes for product ${productId}`);

    for (const attrData of attributesToCreate) {
      try {
        // Find or create the attribute definition
        const attributeId = await this.findOrCreateAttribute(attrData.name, userId, attrData.type);

        // Check if product attribute already exists
        const existingProductAttr = await this.prisma.productAttribute.findUnique({
          where: {
            productId_attributeId: {
              productId,
              attributeId,
            },
          },
        });

        if (existingProductAttr) {
          // Update existing
          await this.prisma.productAttribute.update({
            where: { id: existingProductAttr.id },
            data: { value: attrData.value },
          });
          this.logger.log(`Updated attribute ${attrData.name} for product ${productId}`);
        } else {
          // Create new
          await this.prisma.productAttribute.create({
            data: {
              productId,
              attributeId,
              value: attrData.value,
            },
          });
          this.logger.log(`Created attribute ${attrData.name} for product ${productId}`);
        }
      } catch (error) {
        this.logger.error(`Failed to create attribute ${attrData.name} for product ${productId}:`, error);
        // Continue with other attributes
      }
    }
  }

  /**
   * Ensure a category exists in WooCommerce, create if it doesn't
   * @param categoryName The category name
   * @param wooClient The WooCommerce client
   * @returns The WooCommerce category ID
   */
  private async ensureWooCommerceCategory(categoryName: string, wooClient: any): Promise<number> {
    try {
      // Search for existing category
      const response = await wooClient.get('products/categories', {
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
      const createResponse = await wooClient.post('products/categories', {
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
   * @param wooClient The WooCommerce client
   */
  private async ensureWooCommerceAttribute(attributeName: string, options: string[], wooClient: any): Promise<void> {
    try {
      // Get all attributes
      const response = await wooClient.get('products/attributes');
      const attributes = response.data;

      // Find existing attribute (case-insensitive)
      let attribute = attributes.find(
        (attr: any) => attr.name.toLowerCase() === attributeName.toLowerCase()
      );

      // Create attribute if it doesn't exist
      if (!attribute) {
        this.logger.log(`Creating new attribute: "${attributeName}"`);
        const createResponse = await wooClient.post('products/attributes', {
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
        await this.ensureWooCommerceAttributeTerms(attribute.id, options, wooClient);
      }
    } catch (error) {
      this.logger.error(`Error ensuring attribute "${attributeName}":`, error);
      // Don't throw - we'll still try to export the product
      // WooCommerce might handle it as a custom attribute
    }
  }

  /**
   * Ensure attribute terms exist in WooCommerce, create if they don't
   * @param attributeId The attribute ID
   * @param terms The terms to ensure
   * @param wooClient The WooCommerce client
   */
  private async ensureWooCommerceAttributeTerms(attributeId: number, terms: string[], wooClient: any): Promise<void> {
    try {
      // Get existing terms
      const termsResponse = await wooClient.get(`products/attributes/${attributeId}/terms`, {
        per_page: 100
      });
      const existingTerms = termsResponse.data.map((term: any) => term.name.toLowerCase());

      // Create missing terms
      for (const term of terms) {
        if (!existingTerms.includes(term.toLowerCase())) {
          this.logger.log(`Creating term "${term}" for attribute ${attributeId}`);
          await wooClient.post(`products/attributes/${attributeId}/terms`, {
            name: term
          });
        }
      }
    } catch (error) {
      this.logger.error(`Error ensuring attribute terms for attribute ${attributeId}:`, error);
      // Don't throw - continue with export
    }
  }

  /**
   * Fetch all products from WooCommerce with pagination
   */
  private async getAllWooProducts(wooClient: any): Promise<any[]> {
    const allProducts: any[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const response = await wooClient.get('products', {
        per_page: perPage,
        page,
      });

      const products = response.data;
      allProducts.push(...products);

      if (products.length < perPage) {
        break; // No more pages
      }

      page++;
    }

    return allProducts;
  }
}
