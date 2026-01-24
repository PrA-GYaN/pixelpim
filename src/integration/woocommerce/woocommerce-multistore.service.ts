import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  private readonly baseUrl: string;

  constructor(
    private prisma: PrismaService,
    private connectionService: WooCommerceConnectionService,
    private configService: ConfigService,
  ) {
    // Get base URL from environment or use default
    const port = this.configService.get<string>('PORT') || '3000';
    this.baseUrl = this.configService.get<string>('BASE_URL') || `http://localhost:${port}`;
  }

  /**
   * Simplify error messages for storage
   * Converts technical error messages into user-friendly format
   */
  private simplifyErrorMessage(errorMsg: string): string {
    if (!errorMsg) return '';

    // Extract unique constraint errors
    if (errorMsg.includes('Unique constraint failed')) {
      const match = errorMsg.match(/Unique constraint failed on the fields: \(`([^`]+)`(?:,`([^`]+)`)*\)/);
      if (match) {
        const fields = [match[1], match[2]].filter(Boolean).join(', ');
        return `Duplicate entry: ${fields} already exists`;
      }
      return 'Duplicate entry: Record already exists';
    }

    // Extract foreign key constraint errors
    if (errorMsg.includes('Foreign key constraint failed')) {
      return 'Reference error: Related record not found';
    }

    // If message is too long (likely includes stack trace), truncate to first meaningful line
    if (errorMsg.length > 200) {
      const lines = errorMsg.split('\n');
      // Find first line that's not a file path or stack trace
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('Invalid') && !trimmed.includes('.ts:') && !trimmed.includes('invocation')) {
          return trimmed.substring(0, 150);
        }
      }
      // If no good line found, take first 150 chars
      return errorMsg.substring(0, 150) + '...';
    }

    return errorMsg;
  }

  /**
   * Export products to a specific WooCommerce connection with selective fields
   * 
   * @legacy This method is now primarily used for initial product sync.
   * Once a product is synced, subsequent updates are handled automatically
   * by WooCommerceAutoSyncService when the product is updated.
   * 
   * Use this for:
   * - Initial product export to WooCommerce
   * - Bulk export operations
   * - Manual re-sync when needed
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

    // Fetch products with their attributes and variants
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
        variants: {
          include: {
            attributes: {
              include: {
                attribute: true,
              },
            },
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
        this.logger.log(`Found Existing Sync:${JSON.stringify(existingSync)}`);
        this.logger.log(`WooCommerce Data:${JSON.stringify(wooProductData)}`);
        
        // Collect current image and asset URLs for tracking
        const currentImageUrls: string[] = [];
        if (product.imageUrl) currentImageUrls.push(product.imageUrl);
        if (product.subImages && product.subImages.length > 0) {
          currentImageUrls.push(...product.subImages);
        }
        
        const currentAssetUrls = product.assets?.map((assetRelation: any) => 
          assetRelation.asset?.filePath
        ).filter(Boolean) || [];

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

          // Update sync record with image/asset tracking
          await this.prisma.wooCommerceProductSync.update({
            where: { id: existingSync.id },
            data: {
              lastExportedAt: new Date(),
              lastModifiedFields: fieldsToExport,
              lastSyncedImages: currentImageUrls,
              lastSyncedAssets: currentAssetUrls,
              syncStatus: 'synced',
              errorMessage: null,
            },
          });
        } else {
          // Create new product (or retry if previous sync had invalid wooProductId)
          this.logger.log(`Creating new WooCommerce product for local product ${product.id}`);
          this.logger.log(`WooCommerce Data:${JSON.stringify(wooProductData)}`);
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
                lastSyncedImages: currentImageUrls,
                lastSyncedAssets: currentAssetUrls,
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
                lastSyncedImages: currentImageUrls,
                lastSyncedAssets: currentAssetUrls,
                syncStatus: 'synced',
              },
            });
          }
        }

        // Export variants if enabled
        if (fieldsToExport.includes('variants') && product.variants && product.variants.length > 0) {
          this.logger.log(`Exporting ${product.variants.length} variants for product ${product.id} to WooCommerce`);
          await this.exportProductVariants(wooClient, wooProductId, product.variants, fieldMappings);
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
            errorMessage: this.simplifyErrorMessage(error.message || 'Export failed'),
          },
          create: {
            connectionId: dto.connectionId,
            productId: product.id,
            wooProductId: 0, // Placeholder
            syncStatus: 'error',
            errorMessage: this.simplifyErrorMessage(error.message || 'Export failed'),
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
      status: 'imported' | 'updated' | 'linked' | 'error';
      message?: string;
    }> = [];

    let importedCount = 0;
    let updatedCount = 0;
    let linkedCount = 0;
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

            // Check for SKU conflict with existing products
            const existingProductWithSku = await this.prisma.product.findUnique({
              where: {
                sku_userId: {
                  sku: productData.sku,
                  userId,
                },
              },
            });

            let productToLink: any;

            if (existingProductWithSku) {
              // Handle SKU conflict based on user preference
              const conflictAction = dto.onSkuConflict || 'skip';

              if (conflictAction === 'skip') {
                this.logger.log(`Skipping WooCommerce product ${wooProduct.id} - SKU ${productData.sku} already exists`);
                products.push({
                  wooProductId: wooProduct.id,
                  status: 'error',
                  message: `SKU ${productData.sku} already exists`,
                });
                failedCount++;
                continue;
              } else if (conflictAction === 'update') {
                // Update existing product with new data
                await this.prisma.product.update({
                  where: { id: existingProductWithSku.id },
                  data: productData,
                });

                // Process attributes
                if (attributesToCreate && attributesToCreate.length > 0) {
                  await this.processProductAttributes(existingProductWithSku.id, userId, attributesToCreate);
                }

                productToLink = existingProductWithSku;
                updatedCount++;
              } else if (conflictAction === 'link') {
                // Link to existing product without updating
                productToLink = existingProductWithSku;
                linkedCount++;
              }
            } else {
              // Create new product
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

              productToLink = newProduct;
              importedCount++;
            }

            // Create or update sync record
            if (existingSync) {
              // Update existing sync record with valid productId
              await this.prisma.wooCommerceProductSync.update({
                where: { id: existingSync.id },
                data: {
                  productId: productToLink.id,
                  lastImportedAt: new Date(),
                  syncStatus: 'synced',
                  errorMessage: null,
                },
              });
              this.logger.log(`Updated sync record for WooCommerce product ${wooProduct.id} with product ID ${productToLink.id}`);
            } else {
              // Create new sync record
              await this.prisma.wooCommerceProductSync.create({
                data: {
                  connectionId: dto.connectionId,
                  productId: productToLink.id,
                  wooProductId: wooProduct.id,
                  lastImportedAt: new Date(),
                  syncStatus: 'synced',
                },
              });
              this.logger.log(`Created sync record for WooCommerce product ${wooProduct.id} linked to product ID ${productToLink.id}`);
            }

            // Import variants if enabled
            if (fieldMappings['variants'] && wooProduct.id) {
              this.logger.log(`Importing variants for WooCommerce product ${wooProduct.id}`);
              await this.importProductVariants(
                wooClient,
                wooProduct.id,
                productToLink.id,
                userId,
                attributeMappings,
                fieldMappings,
              );
            }

            products.push({
              wooProductId: wooProduct.id,
              productId: productToLink.id,
              status: existingProductWithSku ? (dto.onSkuConflict === 'update' ? 'updated' : 'linked') : 'imported',
            });
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
              errorMessage: this.simplifyErrorMessage(error.message || 'Import failed'),
            },
            create: {
              connectionId: dto.connectionId,
              productId: null, // Null for failed imports
              wooProductId: wooProduct.id,
              syncStatus: 'error',
              errorMessage: this.simplifyErrorMessage(error.message || 'Import failed'),
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

    // Handle family assignment for successfully imported/updated products
    try {
      // Get all successfully imported/updated/linked product IDs
      const successfulProductIds = products
        .filter(p => p.productId && (p.status === 'imported' || p.status === 'updated' || p.status === 'linked'))
        .map(p => p.productId!);

      if (successfulProductIds.length > 0) {
        let familyIdToSet: number | null = null;

        if (dto.familyId !== undefined) {
          // Verify family exists and belongs to user
          const family = await this.prisma.family.findFirst({
            where: {
              id: dto.familyId,
              userId,
            },
          });

          if (!family) {
            this.logger.warn(`Family ${dto.familyId} not found or does not belong to user ${userId}`);
          } else {
            familyIdToSet = dto.familyId;
            this.logger.log(`Attaching imported products to family ${dto.familyId}`);
          }
        } else {
          // No family selected, clear family assignment
          this.logger.log('Clearing family assignment for imported products');
        }

        // Bulk update products to set familyId
        await this.prisma.product.updateMany({
          where: {
            id: { in: successfulProductIds },
            userId,
          },
          data: {
            familyId: familyIdToSet,
          },
        });

        this.logger.log(`Successfully updated family assignment for ${successfulProductIds.length} products`);
      }
    } catch (error: any) {
      this.logger.error(`Failed to update family assignment: ${error.message}`);
      // Don't fail the entire import if family assignment fails
    }

    return {
      success: failedCount === 0,
      importedCount,
      updatedCount,
      linkedCount,
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

    // this.logger.log(`Original Product Data:${JSON.stringify(product)}`);

    // Build partial update data
    const wooProductData = await this.buildWooProductData(
      product,
      fieldsToExport,
      fieldMappings,
      sync.lastModifiedFields as any,
      wooClient,
      sync, // Pass sync record to check for image/asset changes
    );


    this.logger.log(`Product Data In WooCommerce Format:${JSON.stringify(wooProductData)}`);
    try {
      await wooClient.put(`products/${sync.wooProductId}`, wooProductData);

      // Collect current image and asset URLs for tracking
      const currentImageUrls: string[] = [];
      if (product.imageUrl) currentImageUrls.push(product.imageUrl);
      if (product.subImages && product.subImages.length > 0) {
        currentImageUrls.push(...product.subImages);
      }
      
      const currentAssetUrls = product.assets?.map((assetRelation: any) => 
        assetRelation.asset?.filePath
      ).filter(Boolean) || [];

      // Update sync record with image/asset tracking
      await this.prisma.wooCommerceProductSync.update({
        where: { id: sync.id },
        data: {
          lastExportedAt: new Date(),
          lastModifiedFields: fieldsToExport,
          lastSyncedImages: currentImageUrls,
          lastSyncedAssets: currentAssetUrls,
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
          errorMessage: this.simplifyErrorMessage(error.message || 'Update failed'),
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
   * Get aggregated sync statistics
   */
  async getSyncStats(
    userId: number,
    connectionId: number,
  ): Promise<any> {
    // Verify connection ownership
    await this.connectionService.getConnection(userId, connectionId);

    const where: any = { connectionId };

    // Get all sync records to calculate stats
    const allSyncs = await this.prisma.wooCommerceProductSync.findMany({
      where,
      select: {
        syncStatus: true,
        errorMessage: true,
        lastExportedAt: true,
        lastImportedAt: true,
      },
    });

    const totalProducts = allSyncs.length;
    const syncedProducts = allSyncs.filter((s) => s.syncStatus === 'synced').length;
    const errorProducts = allSyncs.filter(
      (s) => s.syncStatus === 'error' || !!s.errorMessage,
    ).length;
    const pendingProducts = Math.max(
      0,
      totalProducts - syncedProducts - errorProducts,
    );

    // Get most recent sync time
    const allDates = allSyncs
      .flatMap((s) => [s.lastExportedAt, s.lastImportedAt])
      .filter((d): d is Date => d !== null && d !== undefined)
      .map((d) => new Date(d).getTime())
      .filter((t) => !Number.isNaN(t));

    const lastSyncedAt = allDates.length
      ? new Date(Math.max(...allDates)).toISOString()
      : null;

    return {
      connectionId,
      totalProducts,
      syncedProducts,
      pendingProducts,
      errorProducts,
      lastSyncedAt,
    };
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

  /**
   * Get WooCommerce product sync logs with pagination and filtering
   */
  async getSyncLogs(
    userId: number,
    options: {
      connectionId?: number;
      syncStatus?: string;
      page?: number;
      limit?: number;
      search?: string;
    } = {},
  ): Promise<{
    logs: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    // Get the user's hidden logs timestamp
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { hiddenWooSyncLogsTimestamp: true },
    });

    // Build the where clause
    const where: any = {
      connection: {
        userId,
      },
    };

    // Filter by connection if specified
    if (options.connectionId) {
      where.connectionId = options.connectionId;
    }

    // Filter by sync status if specified
    if (options.syncStatus) {
      where.syncStatus = options.syncStatus;
    }

    // Filter by search term in error messages
    if (options.search) {
      where.OR = [
        { errorMessage: { contains: options.search, mode: 'insensitive' } },
        { syncStatus: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    // Filter out logs before the hidden timestamp
    if (user?.hiddenWooSyncLogsTimestamp) {
      where.updatedAt = {
        gt: user.hiddenWooSyncLogsTimestamp,
      };
    }

    // Get total count and logs
    const [total, logs] = await Promise.all([
      this.prisma.wooCommerceProductSync.count({ where }),
      this.prisma.wooCommerceProductSync.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          connection: {
            select: {
              id: true,
              storeName: true,
              storeUrl: true,
            },
          },
        },
      }),
    ]);

    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Hide WooCommerce product sync logs by updating the user's hidden timestamp
   */
  async hideSyncLogs(userId: number): Promise<{ success: boolean; hiddenCount: number }> {
    // Get current timestamp
    const now = new Date();

    // Count logs that will be hidden
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { hiddenWooSyncLogsTimestamp: true },
    });

    const where: any = {
      connection: {
        userId,
      },
    };

    if (user?.hiddenWooSyncLogsTimestamp) {
      where.updatedAt = {
        gt: user.hiddenWooSyncLogsTimestamp,
        lte: now,
      };
    } else {
      where.updatedAt = {
        lte: now,
      };
    }

    const hiddenCount = await this.prisma.wooCommerceProductSync.count({ where });

    // Update the user's hidden timestamp
    await this.prisma.user.update({
      where: { id: userId },
      data: { hiddenWooSyncLogsTimestamp: now },
    });

    return {
      success: true,
      hiddenCount,
    };
  }

  // ===== Helper Methods =====

  /**
   * Export product variants to WooCommerce
   * Creates WooCommerce product variations for a parent product
   */
  private async exportProductVariants(
    wooClient: any,
    wooProductId: number,
    variants: any[],
    fieldMappings: Record<string, any>,
  ): Promise<void> {
    for (const variant of variants) {
      try {
        // Build variant payload from variant attributes
        const variationData = await this.buildVariantPayload(variant, wooClient, fieldMappings);
        
        this.logger.log(`Creating variation for product ${wooProductId}: ${JSON.stringify(variationData)}`);
        
        // Create variation in WooCommerce
        await wooClient.post(`products/${wooProductId}/variations`, variationData);
        
        this.logger.log(`Successfully created variation for variant ${variant.id}`);
      } catch (error: any) {
        this.logger.error(`Failed to create variation for variant ${variant.id}:`, error);
        // Continue with other variants even if one fails
      }
    }
  }

  /**
   * Build WooCommerce variation payload from variant data
   * Handles both default WooCommerce fields and custom attributes
   */
  private async buildVariantPayload(
    variant: any,
    wooClient: any,
    fieldMappings: Record<string, any>,
  ): Promise<any> {
    const payload: any = {};
    
    // Default WooCommerce variation fields
    const defaultFields = [
      'regular_price', 'sale_price', 'sku', 'weight', 'dimensions',
      'stock_quantity', 'stock_status', 'manage_stock', 'description'
    ];
    
    const customAttributes: Array<{ id: number; option: string }> = [];
    
    // Process variant attributes
    if (variant.attributes && variant.attributes.length > 0) {
      for (const attr of variant.attributes) {
        const attrName = attr.attribute.name.toLowerCase();
        const attrValue = attr.value;
        
        // Check if this is a default WooCommerce field
        const isDefaultField = defaultFields.some(field => 
          attrName.includes(field.toLowerCase().replace('_', ' ')) || 
          attrName === field
        );
        
        if (isDefaultField) {
          // Map to default field
          if (attrName.includes('regular') || attrName.includes('price') && !attrName.includes('sale')) {
            payload.regular_price = this.extractNumeric(attrValue);
          } else if (attrName.includes('sale')) {
            payload.sale_price = this.extractNumeric(attrValue);
          } else if (attrName.includes('sku')) {
            payload.sku = attrValue;
          } else if (attrName.includes('weight')) {
            payload.weight = this.extractNumeric(attrValue);
          } else if (attrName.includes('stock') && attrName.includes('quantity')) {
            payload.stock_quantity = parseInt(attrValue, 10);
            payload.manage_stock = true;
          } else if (attrName.includes('stock') && attrName.includes('status')) {
            payload.stock_status = attrValue.toLowerCase();
          } else if (attrName.includes('description')) {
            payload.description = attrValue;
          }
        } else {
          // Custom attribute - needs to be mapped to WooCommerce attribute
          const wooAttributeId = await this.getOrCreateWooCommerceAttribute(
            wooClient,
            attr.attribute.name,
            attrValue,
          );
          
          if (wooAttributeId) {
            customAttributes.push({
              id: wooAttributeId,
              option: attrValue,
            });
          }
        }
      }
    }
    
    // Add custom attributes if any
    if (customAttributes.length > 0) {
      payload.attributes = customAttributes;
    }
    
    // If variant has SKU, use it
    if (variant.sku && !payload.sku) {
      payload.sku = variant.sku;
    }
    
    return payload;
  }

  /**
   * Get or create WooCommerce attribute
   * Searches for existing attribute by name, creates if not found
   */
  private async getOrCreateWooCommerceAttribute(
    wooClient: any,
    attributeName: string,
    attributeValue: string,
  ): Promise<number | null> {
    try {
      // Search for existing attribute by name
      const searchResponse = await wooClient.get('products/attributes', {
        search: attributeName,
      });
      
      let attributeId: number | null = null;
      
      if (searchResponse.data && searchResponse.data.length > 0) {
        // Find exact match (case-insensitive)
        const exactMatch = searchResponse.data.find((attr: any) => 
          attr.name.toLowerCase() === attributeName.toLowerCase()
        );
        
        if (exactMatch) {
          attributeId = exactMatch.id;
          this.logger.log(`Found existing WooCommerce attribute "${attributeName}" with ID ${attributeId}`);
        }
      }
      
      // If not found, create new attribute
      if (!attributeId) {
        this.logger.log(`Creating new WooCommerce attribute "${attributeName}"`);
        const createResponse = await wooClient.post('products/attributes', {
          name: attributeName,
          slug: attributeName.toLowerCase().replace(/\s+/g, '-'),
          type: 'select',
          order_by: 'menu_order',
          has_archives: false,
        });
        
        attributeId = createResponse.data.id;
        this.logger.log(`Created WooCommerce attribute "${attributeName}" with ID ${attributeId}`);
      }
      
      // Now ensure the attribute term (value) exists
      if (attributeId) {
        await this.ensureAttributeTerm(wooClient, attributeId, attributeValue);
      }
      
      return attributeId;
    } catch (error: any) {
      this.logger.error(`Failed to get/create WooCommerce attribute "${attributeName}":`, error);
      return null;
    }
  }

  /**
   * Ensure attribute term exists for an attribute
   */
  private async ensureAttributeTerm(
    wooClient: any,
    attributeId: number,
    termValue: string,
  ): Promise<void> {
    try {
      // Check if term already exists
      const termsResponse = await wooClient.get(`products/attributes/${attributeId}/terms`, {
        search: termValue,
      });
      
      const exactMatch = termsResponse.data?.find((term: any) => 
        term.name.toLowerCase() === termValue.toLowerCase()
      );
      
      if (!exactMatch) {
        // Create the term
        await wooClient.post(`products/attributes/${attributeId}/terms`, {
          name: termValue,
          slug: termValue.toLowerCase().replace(/\s+/g, '-'),
        });
        
        this.logger.log(`Created attribute term "${termValue}" for attribute ${attributeId}`);
      }
    } catch (error: any) {
      this.logger.error(`Failed to ensure attribute term "${termValue}":`, error);
    }
  }

  /**
   * Import product variants from WooCommerce
   * Fetches variations and creates them as child products in the local system
   */
  private async importProductVariants(
    wooClient: any,
    wooProductId: number,
    parentProductId: number,
    userId: number,
    attributeMappings: Record<string, any>,
    fieldMappings: Record<string, any>,
  ): Promise<void> {
    try {
      // Fetch variations from WooCommerce
      const variationsResponse = await wooClient.get(`products/${wooProductId}/variations`);
      const variations = variationsResponse.data;
      
      if (!variations || variations.length === 0) {
        this.logger.log(`No variations found for WooCommerce product ${wooProductId}`);
        return;
      }
      
      this.logger.log(`Found ${variations.length} variations for product ${wooProductId}`);
      
      for (const variation of variations) {
        try {
          // Build local variant data
          const variantData = await this.buildLocalVariantData(
            variation,
            parentProductId,
            userId,
            attributeMappings,
            fieldMappings,
          );
          
          // Extract attributes to create separately
          const attributesToCreate = variantData._attributesToCreate;
          delete variantData._attributesToCreate;
          
          // Check if variant already exists by SKU
          const existingVariant = variantData.sku ? await this.prisma.product.findUnique({
            where: {
              sku_userId: {
                sku: variantData.sku,
                userId,
              },
            },
          }) : null;
          
          let variantId: number;
          
          if (existingVariant) {
            // Update existing variant
            await this.prisma.product.update({
              where: { id: existingVariant.id },
              data: variantData,
            });
            variantId = existingVariant.id;
            this.logger.log(`Updated existing variant ${variantId} for variation ${variation.id}`);
          } else {
            // Create new variant
            const newVariant = await this.prisma.product.create({
              data: variantData,
            });
            variantId = newVariant.id;
            this.logger.log(`Created new variant ${variantId} for variation ${variation.id}`);
          }
          
          // Process attributes
          if (attributesToCreate && attributesToCreate.length > 0) {
            await this.processProductAttributes(variantId, userId, attributesToCreate);
          }
          
        } catch (error: any) {
          this.logger.error(`Failed to import variation ${variation.id}:`, error);
          // Continue with other variations
        }
      }
    } catch (error: any) {
      this.logger.error(`Failed to import variants for product ${wooProductId}:`, error);
    }
  }

  /**
   * Build local variant data from WooCommerce variation
   */
  private async buildLocalVariantData(
    variation: any,
    parentProductId: number,
    userId: number,
    attributeMappings: Record<string, any>,
    fieldMappings: Record<string, any>,
  ): Promise<any> {
    const data: any = {
      name: variation.sku || `Variant ${variation.id}`,
      sku: variation.sku || `VAR-${variation.id}`,
      parentProductId,
      userId,
      status: 'complete',
    };
    
    // Handle price
    if (variation.regular_price) {
      // Price will be stored as an attribute
    }
    
    // Handle images
    if (variation.image?.src) {
      data.imageUrl = variation.image.src;
    }
    
    // Process attributes
    const attributesToCreate: Array<{ name: string; value: any; type: string }> = [];
    
    // Add price as attribute if available
    if (variation.regular_price) {
      attributesToCreate.push({
        name: 'regular_price',
        value: variation.regular_price,
        type: 'TEXT',
      });
    }
    
    if (variation.sale_price) {
      attributesToCreate.push({
        name: 'sale_price',
        value: variation.sale_price,
        type: 'TEXT',
      });
    }
    
    // Add weight as attribute if available
    if (variation.weight) {
      attributesToCreate.push({
        name: 'weight',
        value: variation.weight,
        type: 'TEXT',
      });
    }
    
    // Add stock quantity if available
    if (variation.stock_quantity !== undefined && variation.stock_quantity !== null) {
      attributesToCreate.push({
        name: 'stock_quantity',
        value: variation.stock_quantity.toString(),
        type: 'TEXT',
      });
    }
    
    // Process variation attributes
    if (variation.attributes && Array.isArray(variation.attributes)) {
      for (const attr of variation.attributes) {
        if (attr.option) {
          attributesToCreate.push({
            name: attr.name || `Attribute ${attr.id}`,
            value: attr.option,
            type: 'TEXT',
          });
        }
      }
    }
    
    data._attributesToCreate = attributesToCreate;
    
    return data;
  }

  /**
   * Build WooCommerce product data from local product
   */
  private async buildWooProductData(
    product: any,
    fieldsToExport: string[],
    fieldMappings: Record<string, any>,
    lastModifiedFields: string[] | null,
    wooClient: any,
    syncRecord?: any,
  ): Promise<any> {
    if (!product.name || !product.sku) {
      throw new BadRequestException('Product must have name and sku');
    }

    this.logger.log(`Build Data Field Mappings:${JSON.stringify(fieldMappings)}`);
    this.logger.log(`Build Data Field to Export:${fieldsToExport}`);
    this.logger.log(`Build Data Last Modified Field:${lastModifiedFields}`);

    const context = { product, fieldsToExport, fieldMappings, lastModifiedFields, wooClient, syncRecord };
    const wooProduct: any = {};

    // Required fields
    this.addFieldIfIncluded(wooProduct, 'name', product.name, context);
    this.addFieldIfIncluded(wooProduct, 'sku', product.sku, context);

    // Process all product fields
    await this.processImages(wooProduct, context);
    this.processPricing(wooProduct, context);
    this.processWeight(wooProduct, context);
    this.processDimensions(wooProduct, context);
    this.processStockStatus(wooProduct, context);
    await this.processDescription(wooProduct, context);
    await this.processCategories(wooProduct, context);
    this.processTags(wooProduct, context);
    await this.processAttributes(wooProduct, context);
    this.processStatus(wooProduct, context);
    
    // Set product type based on whether it has variants
    // Always set type regardless of field selection - it's a required WooCommerce field
    const hasVariants = product.variants && product.variants.length > 0;
    const includeVariants = fieldsToExport.includes('variants');
    const productType = (hasVariants && includeVariants) ? 'variable' : 'simple';
    wooProduct.type = productType;

    return wooProduct;
  }

  // === Helper methods for buildWooProductData ===

  private shouldIncludeField(field: string, context: any): boolean {
    const { fieldsToExport, lastModifiedFields } = context;
    if (!fieldsToExport.map(f => f.toLowerCase()).includes(field.toLowerCase())) return false;
    if (lastModifiedFields) {
      if (lastModifiedFields.map(f => f.toLowerCase()).includes(field.toLowerCase())) return true;
      if (lastModifiedFields.map(f => f.toLowerCase()).includes('attributes') && this.isAttributeField(field)) return true;
      return false;
    }
    return true;
  }

  private isAttributeField(field: string): boolean {
    const standardFields = ['name', 'sku', 'price', 'sale_price', 'weight', 'dimensions', 'stock_status', 'description', 'images', 'categories', 'tags', 'status', 'type'];
    return !standardFields.includes(field);
  }

  private getMappedField(field: string, fieldMappings: Record<string, any>): string {
    return fieldMappings[field] || field;
  }

  private sanitizeHtml(html: string): string {
    if (!html) return '';
    return html
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }

  private findAttribute(patterns: string[], product: any): any {
    return product.attributes?.find((attr: any) =>
      patterns.some(pattern => attr.attribute.name.toLowerCase().includes(pattern.toLowerCase()))
    );
  }

  private extractNumeric(value: string): string {
    if (!value) return '';
    return value.replace(/[^\d.]/g, '');
  }

  private addFieldIfIncluded(wooProduct: any, field: string, value: any, context: any): void {
    if (this.shouldIncludeField(field, context)) {
      wooProduct[this.getMappedField(field, context.fieldMappings)] = value;
    }
  }

  private async processImages(wooProduct: any, context: any): Promise<void> {
    const { product, fieldsToExport, fieldMappings, syncRecord } = context;
    
    const imageFieldNames = fieldsToExport.filter(field => 
      fieldMappings[field] === 'images' || field === 'images' || field === 'imageUrl'
    );
    
    if (imageFieldNames.length === 0 && !this.shouldIncludeField('images', context) && !this.shouldIncludeField('imageUrl', context)) {
      return;
    }

    const images: Array<{ src: string; alt: string }> = [];
    if (product.imageUrl) {
      images.push({ src: this.getAbsoluteUrl(product.imageUrl), alt: product.name });
    }
    if (product.subImages?.length > 0) {
      product.subImages.forEach((url: string, index: number) => {
        images.push({ src: this.getAbsoluteUrl(url), alt: `${product.name} - Gallery ${index + 1}` });
      });
    }

    if (images.length > 0) {
      const currentImageUrls = images.map(img => img.src);
      const lastSyncedImages = syncRecord?.lastSyncedImages as string[] | null;
      
      this.logger.log(`[Image Comparison] Product ${product.id}:`);
      this.logger.log(`  Current: ${currentImageUrls.length}, Last synced: ${lastSyncedImages?.length || 0}`);
      
      const normalizedCurrent = currentImageUrls.map(url => this.normalizeUrlForComparison(url));
      const normalizedLast = lastSyncedImages?.map(url => this.normalizeUrlForComparison(url)) || [];
      
      const imagesChanged = !lastSyncedImages || 
        normalizedLast.length !== normalizedCurrent.length ||
        !normalizedLast.every((url, index) => url === normalizedCurrent[index]);
      
      if (imagesChanged) {
        wooProduct['images'] = images;
        this.logger.log(`  ✓ Images CHANGED - including in sync`);
      } else {
        this.logger.log(`  ✗ Images UNCHANGED - skipping`);
      }
    }
  }

  private processPricing(wooProduct: any, context: any): void {
    const { product, fieldsToExport, fieldMappings } = context;
    
    // Regular price
    const regularPriceFields = fieldsToExport.filter(f => 
      fieldMappings[f] === 'regular_price' || f === 'regular_price' || f === 'price'
    );
    if (regularPriceFields.length > 0) {
      const attr = this.findAttribute([...regularPriceFields, 'regular_price', 'price', 'regular price'], product);
      if (attr) {
        const price = this.extractNumeric(attr.value);
        if (price) wooProduct['regular_price'] = price;
      }
    }

    // Sale price
    const salePriceFields = fieldsToExport.filter(f => 
      fieldMappings[f] === 'sale_price' || f === 'sale_price'
    );
    if (salePriceFields.length > 0) {
      const attr = this.findAttribute([...salePriceFields, 'sale_price', 'sale price', 'discount price'], product);
      if (attr) {
        const price = this.extractNumeric(attr.value);
        if (price) wooProduct['sale_price'] = price;
      }
    }

    // Sale dates
    if (this.shouldIncludeField('date_on_sale_from', context)) {
      const attr = this.findAttribute(['sale_start_date', 'sale start', 'discount start'], product);
      if (attr?.value) {
        wooProduct[this.getMappedField('date_on_sale_from', fieldMappings)] = attr.value;
      }
    }

    if (this.shouldIncludeField('date_on_sale_to', context)) {
      const attr = this.findAttribute(['sale_end_date', 'sale end', 'discount end'], product);
      if (attr?.value) {
        wooProduct[this.getMappedField('date_on_sale_to', fieldMappings)] = attr.value;
      }
    }
  }

  private processWeight(wooProduct: any, context: any): void {
    if (!this.shouldIncludeField('weight', context)) return;
    
    const { product, fieldMappings } = context;
    const attr = this.findAttribute(['weight'], product);
    if (attr?.value) {
      wooProduct[this.getMappedField('weight', fieldMappings)] = this.extractNumeric(attr.value);
    }
  }

  private processDimensions(wooProduct: any, context: any): void {
    if (!this.shouldIncludeField('dimensions', context)) return;
    
    const { product, fieldMappings } = context;
    const dimensions: any = {};
    
    const length = this.findAttribute(['length', 'dimension_length'], product);
    const width = this.findAttribute(['width', 'dimension_width'], product);
    const height = this.findAttribute(['height', 'dimension_height'], product);
    
    if (length?.value) dimensions.length = this.extractNumeric(length.value);
    if (width?.value) dimensions.width = this.extractNumeric(width.value);
    if (height?.value) dimensions.height = this.extractNumeric(height.value);
    
    if (Object.keys(dimensions).length > 0) {
      wooProduct[this.getMappedField('dimensions', fieldMappings)] = dimensions;
    }
  }

  private processStockStatus(wooProduct: any, context: any): void {
    if (!this.shouldIncludeField('stock_status', context)) return;
    
    const { product, fieldMappings } = context;
    const attr = this.findAttribute(['stock_status', 'stock status', 'availability'], product);
    
    let status = 'instock';
    if (attr?.value) {
      const value = attr.value.toLowerCase();
      if (value.includes('out') || value.includes('unavailable')) {
        status = 'outofstock';
      } else if (value.includes('backorder')) {
        status = 'onbackorder';
      }
    }
    wooProduct[this.getMappedField('stock_status', fieldMappings)] = status;
  }

  private async processDescription(wooProduct: any, context: any): Promise<void> {
    // this.logger.debug("Descrition Checking");
    // this.logger.log(`Description Feild:${!this.shouldIncludeField('description',context)}`)
    if (!this.shouldIncludeField('description', context)) return;
    
    const { product, fieldMappings, syncRecord } = context;
    let description = '';
    
    const attr = this.findAttribute(['description', 'desc', 'long description'], product);
    if (attr?.value) {
      description += this.sanitizeHtml(`<div class="product-description">${attr.value}</div>`);
    }
    
    // Check assets changes
    const currentAssetUrls = product.assets?.map((rel: any) => rel.asset?.filePath).filter(Boolean) || [];
    const lastSyncedAssets = syncRecord?.lastSyncedAssets as string[] | null;
    const assetsChanged = !lastSyncedAssets || 
      lastSyncedAssets.length !== currentAssetUrls.length ||
      !lastSyncedAssets.every((url, index) => url === currentAssetUrls[index]);
    
    if (product.assets?.length > 0 && (assetsChanged || !syncRecord)) {
      this.logger.log(`Assets changed for product ${product.id}, including in description`);
      description += '<h3>Additional Media:</h3><div class="product-media">';
      product.assets.forEach((rel: any) => {
        if (rel.asset) {
          const isImage = rel.asset.mimeType?.startsWith('image/');
          if (isImage && rel.asset.filePath) {
            description += this.sanitizeHtml(`<img src="${rel.asset.filePath}" alt="${rel.asset.name}" style="max-width: 100%; height: auto; margin: 10px 0;" />`);
          } else if (rel.asset.filePath) {
            description += this.sanitizeHtml(`<p><a href="${rel.asset.filePath}" download="${rel.asset.fileName}">${rel.asset.name}</a></p>`);
          }
        }
      });
      description += '</div>';
    } else if (product.assets?.length > 0) {
      this.logger.log(`Assets unchanged for product ${product.id}, skipping asset URLs in description`);
    }
    
    if (description) {
      wooProduct[this.getMappedField('description', fieldMappings)] = description;
    }
  }

  private async processCategories(wooProduct: any, context: any): Promise<void> {
    const { product, wooClient, fieldMappings } = context;
    if (this.shouldIncludeField('categories', context) && product.category) {
      const categoryId = await this.ensureWooCommerceCategory(product.category.name, wooClient);
      wooProduct[this.getMappedField('categories', fieldMappings)] = [{ id: categoryId }];
    }
  }

  private processTags(wooProduct: any, context: any): void {
    if (!this.shouldIncludeField('tags', context)) return;
    
    const { product, fieldMappings } = context;
    const attr = this.findAttribute(['tags', 'product tags'], product);
    if (!attr?.value) return;
    
    const tags = attr.value
      .split(',')
      .map((tag: string) => tag.trim())
      .filter(Boolean)
      .map((tag: string) => ({ name: tag }));
    
    if (tags.length > 0) {
      wooProduct[this.getMappedField('tags', fieldMappings)] = tags;
    }
  }

  private async processAttributes(wooProduct: any, context: any): Promise<void> {
    const { product, fieldsToExport, fieldMappings, wooClient } = context;
    
    const mappedAttributeNames = [
      'regular_price', 'price', 'regular price', 'sale_price', 'sale price', 'discount price',
      'sale_start_date', 'sale start', 'discount start', 'sale_end_date', 'sale end', 'discount end',
      'weight', 'length', 'width', 'height', 'dimension_length', 'dimension_width', 'dimension_height',
      'stock_status', 'stock status', 'availability', 'description', 'desc', 'long description',
      'tags', 'product tags', 'categories', 'category'
    ];
    
    const attributesMappedToWooFields = Object.keys(fieldMappings).filter(key => 
      fieldMappings[key] && typeof fieldMappings[key] === 'string'
    );

    const wooAttributes: Array<{ name: string; options: string[]; visible: boolean; variation: boolean }> = [];
    const variationPatterns = ['color', 'colour', 'size', 'material', 'style'];
    
    // Track attributes that are used in variants
    const variantAttributeNames = new Set<string>();
    const variantAttributeValues = new Map<string, Set<string>>();
    
    // If product has variants and variants export is enabled, collect variant attributes
    const hasVariants = product.variants && product.variants.length > 0;
    const includeVariants = fieldsToExport.includes('variants');
    
    if (hasVariants && includeVariants) {
      // Collect all attributes from variants
      for (const variant of product.variants) {
        if (variant.attributes && variant.attributes.length > 0) {
          for (const attr of variant.attributes) {
            const attrName = attr.attribute.name;
            variantAttributeNames.add(attrName);
            
            if (!variantAttributeValues.has(attrName)) {
              variantAttributeValues.set(attrName, new Set());
            }
            variantAttributeValues.get(attrName)!.add(attr.value);
          }
        }
      }
      
      // Create attributes for variants
      for (const [attrName, values] of variantAttributeValues.entries()) {
        const attrNameLower = attrName.toLowerCase();
        const isMapped = mappedAttributeNames.some(name => attrNameLower.includes(name.toLowerCase()));
        
        if (!isMapped) {
          const options = Array.from(values);
          await this.ensureWooCommerceAttribute(attrName, options, wooClient);
          
          wooAttributes.push({
            name: attrName,
            options,
            visible: true,
            variation: true, // Mark as variation attribute
          });
        }
      }
    }

    // Process parent product attributes (that are not used in variants)
    if (product.attributes?.length > 0) {
      for (const attr of product.attributes) {
        const attrName = attr.attribute.name.toLowerCase();
        const isMapped = mappedAttributeNames.some(name => attrName.includes(name.toLowerCase()));
        const isMappedViaFieldMapping = attributesMappedToWooFields.includes(attr.attribute.name);
        const isVariantAttribute = variantAttributeNames.has(attr.attribute.name);
        
        // Skip if already added as variant attribute or if mapped
        if (!isMapped && !isMappedViaFieldMapping && !isVariantAttribute && this.shouldIncludeField(attr.attribute.name, context) && attr.value) {
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
          
          const isVariation = variationPatterns.some(pattern => attrName.includes(pattern));
          await this.ensureWooCommerceAttribute(attr.attribute.name, options, wooClient);
          wooAttributes.push({
            name: attr.attribute.name,
            options,
            visible: true,
            variation: isVariation
          });
        }
      }
    }
    
    if (wooAttributes.length > 0) {
      wooProduct[this.getMappedField('attributes', fieldMappings)] = wooAttributes;
    }
  }

  private processStatus(wooProduct: any, context: any): void {
    if (!this.shouldIncludeField('status', context)) return;
    
    const { product, fieldMappings } = context;
    let status = 'draft';
    
    const attr = this.findAttribute(['status', 'publish status'], product);
    if (attr?.value) {
      status = attr.value.toLowerCase().includes('publish') ? 'publish' : 'draft';
    } else if (product.status) {
      status = product.status === 'complete' ? 'publish' : 'draft';
    }
    
    wooProduct[this.getMappedField('status', fieldMappings)] = status;
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
        // Skip 'variants' - it's handled separately by importProductVariants
        if (wooField === 'variants') {
          continue;
        }
        
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

  /**
   * Convert relative URL to absolute URL
   * If URL is already absolute, return as is
   */
  private getAbsoluteUrl(url: string): string {
    if (!url) return url;
    
    // If URL is already absolute (starts with http:// or https://), return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // If URL is relative, prepend base URL
    if (url.startsWith('/')) {
      return `${this.baseUrl}${url}`;
    }
    
    // If URL doesn't start with /, add it
    return `${this.baseUrl}/${url}`;
  }

  /**
   * Normalize URL to relative path for comparison
   * Strips the base URL if present to ensure consistent comparison
   */
  private normalizeUrlForComparison(url: string): string {
    if (!url) return '';
    
    // If URL is absolute, strip the base URL to get relative path
    if (url.startsWith('http://') || url.startsWith('https://')) {
      try {
        const urlObj = new URL(url);
        return urlObj.pathname; // Returns just the path part (e.g., /uploads/...)
      } catch {
        return url; // If parsing fails, return as is
      }
    }
    
    // Already relative
    return url;
  }
}
