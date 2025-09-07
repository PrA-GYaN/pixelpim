import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { CreateProductVariantDto, RemoveProductVariantDto, ProductVariantResponseDto, GetProductVariantsDto } from './dto/product-variant.dto';
import { ExportProductDto, ExportProductResponseDto, ProductAttribute, ExportFormat } from './dto/export-product.dto';
import { PaginatedResponse, PaginationUtils } from '../common';
import type { Product } from '../../generated/prisma';
import { getUserFriendlyType } from '../types/user-attribute-type.enum';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(createProductDto: CreateProductDto, userId: number): Promise<ProductResponseDto> {
    try {
      this.logger.log(`Creating product: ${createProductDto.name} for user: ${userId}`);

      // Validate category if provided
      if (createProductDto.categoryId) {
        await this.validateCategory(createProductDto.categoryId, userId);
      }

      // Validate attribute group if provided
      if (createProductDto.attributeGroupId) {
        await this.validateAttributeGroup(createProductDto.attributeGroupId, userId);
      }

      // Validate family if provided
      if (createProductDto.familyId) {
        await this.validateFamily(createProductDto.familyId, userId);
      }

      // Filter out attributes that are already in the family
      let filteredAttributes = createProductDto.attributes;
      let removedAttributeNames: string[] = [];
      if (createProductDto.familyId && createProductDto.attributes && createProductDto.attributes.length > 0) {
        const familyAttributeIds = await this.getFamilyAttributeIds(createProductDto.familyId);
        const { filteredAttributes: newFilteredAttributes, removedAttributes } = this.filterDuplicateAttributes(createProductDto.attributes, familyAttributeIds);

        if (removedAttributes.length > 0) {
          removedAttributeNames = await this.getAttributeNames(removedAttributes);
          this.logger.warn(`Removed duplicate attributes from product creation: ${removedAttributeNames.join(', ')} (already present in family)`);
        }

        filteredAttributes = newFilteredAttributes;
      }

      // Create product without status first
      const product = await this.prisma.product.create({
        data: {
          name: createProductDto.name,
          sku: createProductDto.sku,
          productLink: createProductDto.productLink,
          imageUrl: createProductDto.imageUrl,
          subImages: createProductDto.subImages || [],
          categoryId: createProductDto.categoryId,
          attributeGroupId: createProductDto.attributeGroupId,
          familyId: createProductDto.familyId,
          userId,
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          attributeGroup: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          family: {
            select: {
              id: true,
              name: true,
              familyAttributes: {
                include: {
                  attribute: true,
                },
              },
            },
          },
          attributes: {
            select: {
              attributeId: true,
            },
          },
          assets: {
            select: {
              assetId: true,
            },
          },
        },
      });

      // Add filtered attributes to the product
      if (filteredAttributes && filteredAttributes.length > 0) {
        await this.prisma.productAttribute.createMany({
          data: filteredAttributes.map(attributeId => ({ productId: product.id, attributeId })),
          skipDuplicates: true,
        });
      }

      // Calculate status
      const status = await this.calculateProductStatus(product.id);
      await this.prisma.product.update({ where: { id: product.id }, data: { status } });
      this.logger.log(`Product ${product.id} created with initial status: ${status}`);

      // Fetch updated product with status
      const result = await this.findOne(product.id, userId);
      this.logger.log(`Successfully created product with ID: ${result.id}`);
      return {
        ...result,
        removedAttributesMessage: removedAttributeNames.length > 0
          ? `Removed duplicate attributes: ${removedAttributeNames.join(', ')} (already present in family)`
          : undefined,
      };
    } catch (error) {
      this.handleDatabaseError(error, 'create');
    }
  }

  async findAll(
    userId: number, 
    search?: string,
    status?: string, 
    categoryId?: number | null, 
    attributeId?: number, 
    attributeGroupId?: number | null, 
    familyId?: number | null,
    page: number = 1,
    limit: number = 10,
    sortBy?: string,
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<PaginatedResponse<ProductResponseDto>> {
    try {
      this.logger.log(`Fetching products for user: ${userId}`);

      const whereCondition: any = { userId };

      if (search) {
        whereCondition.OR = [
          {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            sku: {
              contains: search,
              mode: 'insensitive',
            },
          },
        ];
      }

      if (status) {
        whereCondition.status = status;
      }

      if (categoryId !== undefined) {
        whereCondition.categoryId = categoryId;
      }

      if (attributeId) {
        whereCondition.attributeId = attributeId;
      }

      if (attributeGroupId !== undefined) {
        whereCondition.attributeGroupId = attributeGroupId;
      }

      if (familyId !== undefined) {
        whereCondition.familyId = familyId;
      }

      const paginationOptions = PaginationUtils.createPrismaOptions(page, limit);

      // Build orderBy object based on sortBy parameter
      const orderBy = this.buildOrderBy(sortBy, sortOrder);

      const [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where: whereCondition,
          ...paginationOptions,
          include: {
            category: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
            attributeGroup: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
            family: {
              select: {
                id: true,
                name: true,
                familyAttributes: {
                  include: {
                    attribute: {
                      select: {
                        id: true,
                        name: true,
                        type: true,
                        defaultValue: true,
                      },
                    },
                  },
                },
              },
            },
            attributes: {
              select: {
                attributeId: true,
              },
            },
            variantLinksA: {
              include: {
                productB: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                    imageUrl: true,
                    status: true,
                  },
                },
              },
            },
            variantLinksB: {
              include: {
                productA: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                    imageUrl: true,
                    status: true,
                  },
                },
              },
            },
          },
          orderBy,
        }),
        this.prisma.product.count({ where: whereCondition }),
      ]);

      const productResponseDtos = await Promise.all(products.map(async product => {
        const attributeIds = product.attributes?.map((attr: any) => attr.attributeId) || [];
        const response = await this.transformProductForResponse(product);
        return {
          ...response,
          attributes: attributeIds,
        };
      }));
      console.log('Product Response DTOs:', productResponseDtos);
      return PaginationUtils.createPaginatedResponse(productResponseDtos, total, page, limit);
    } catch (error) {
      this.logger.error(`Failed to fetch products for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findOne(id: number, userId: number): Promise<ProductResponseDto> {
    try {
      this.logger.log(`Fetching product: ${id} for user: ${userId}`);

      const product = await this.prisma.product.findFirst({
        where: {
          id,
          userId, // Ensure user owns the product
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          attributeGroup: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          family: {
            select: {
              id: true,
              name: true,
              familyAttributes: {
                include: {
                  attribute: {
                    select: {
                      id: true,
                      name: true,
                      type: true,
                      defaultValue: true,
                    },
                  },
                },
              },
            },
          },
          attributes: {
            include: {
              attribute: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                  defaultValue: true,
                },
              },
            },
          },
          variantLinksA: {
            include: {
              productB: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  imageUrl: true,
                  status: true,
                },
              },
            },
          },
          variantLinksB: {
            include: {
              productA: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  imageUrl: true,
                  status: true,
                },
              },
            },
          },
          assets: {
            include: {
              asset: true,
            },
          },
        },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${id} not found or access denied`);
      }
      this.logger.log(`Product with ID ${id} found:`, product);
      return await this.transformProductForResponse(product);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to fetch product ${id}: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to fetch product');
    }
  }

  async findBySku(sku: string, userId: number): Promise<ProductResponseDto> {
    try {
      this.logger.log(`Fetching product by SKU: ${sku} for user: ${userId}`);

      const product = await this.prisma.product.findFirst({
        where: {
          sku,
          userId,
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          attributeGroup: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          family: {
            select: {
              id: true,
              name: true,
              familyAttributes: true,
            },
          },
          attributes: {
            select: {
              attributeId: true,
            },
          },
          variantLinksA: {
            include: {
              productB: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  imageUrl: true,
                  status: true,
                },
              },
            },
          },
          variantLinksB: {
            include: {
              productA: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  imageUrl: true,
                  status: true,
                },
              },
            },
          },
        },
      });

      if (!product) {
        throw new NotFoundException(`Product with SKU ${sku} not found or access denied`);
      }

      this.logger.log(`Product with SKU ${sku} found: ID ${product}`);

      return await this.transformProductForResponse(product);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to fetch product by SKU ${sku}: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to fetch product');
    }
  }

  async update(id: number, updateProductDto: UpdateProductDto, userId: number): Promise<ProductResponseDto> {
    try {
      // Verify ownership first
      await this.findOne(id, userId);

      this.logger.log(`Updating product: ${id} for user: ${userId}`);
      this.logger.debug(`Update data: ${JSON.stringify(updateProductDto)}`);
      // Validate category if being updated
      if (updateProductDto.categoryId !== undefined && updateProductDto.categoryId !== null) {
        await this.validateCategory(updateProductDto.categoryId, userId);
      }

  // Validate attribute group if being updated
      if (updateProductDto.attributeGroupId !== undefined && updateProductDto.attributeGroupId !== null) {
        await this.validateAttributeGroup(updateProductDto.attributeGroupId, userId);
      }

      // Validate family if being updated
      if (updateProductDto.familyId !== undefined && updateProductDto.familyId !== null) {
        await this.validateFamily(updateProductDto.familyId, userId);
      }

      // Prepare update data
      const updateData: any = {};

      if (updateProductDto.name !== undefined) {
        updateData.name = updateProductDto.name;
      }

      if (updateProductDto.sku !== undefined) {
        updateData.sku = updateProductDto.sku;
      }

      if (updateProductDto.productLink !== undefined) {
        updateData.productLink = updateProductDto.productLink;
      }

      if (updateProductDto.imageUrl !== undefined) {
        updateData.imageUrl = updateProductDto.imageUrl;
      }

      if (updateProductDto.subImages !== undefined) {
        updateData.subImages = updateProductDto.subImages;
      }

  // Status will be set automatically below

      if (updateProductDto.categoryId !== undefined) {
        updateData.categoryId = updateProductDto.categoryId;
      }

  if (updateProductDto.attributeGroupId !== undefined) {
        updateData.attributeGroupId = updateProductDto.attributeGroupId;
      }

      if (updateProductDto.familyId !== undefined) {
        updateData.familyId = updateProductDto.familyId;
      }

      // Update product main fields
      await this.prisma.product.update({
        where: { id },
        data: updateData,
      });

      // After updating attributes/assets, recalculate status

      // Update attributes if provided
      let removedAttributeNames: string[] = [];
      if (updateProductDto.attributes !== undefined) {
        // Filter out attributes that are already in the family
        let filteredAttributes = updateProductDto.attributes;
        let familyIdToCheck = updateProductDto.familyId;

        // If familyId is not being updated, get it from the existing product
        if (familyIdToCheck === undefined) {
          const existingProduct = await this.prisma.product.findUnique({
            where: { id },
            select: { familyId: true },
          });
          familyIdToCheck = existingProduct?.familyId ?? undefined;
        }

        if (familyIdToCheck && updateProductDto.attributes.length > 0) {
          const familyAttributeIds = await this.getFamilyAttributeIds(familyIdToCheck);
          const { filteredAttributes: newFilteredAttributes, removedAttributes } = this.filterDuplicateAttributes(updateProductDto.attributes, familyAttributeIds);

          if (removedAttributes.length > 0) {
            removedAttributeNames = await this.getAttributeNames(removedAttributes);
            this.logger.warn(`Removed duplicate attributes from product update: ${removedAttributeNames.join(', ')} (already present in family)`);
          }

          filteredAttributes = newFilteredAttributes;
        }

        await this.prisma.productAttribute.deleteMany({ where: { productId: id } });
        if (filteredAttributes.length > 0) {
          await this.prisma.productAttribute.createMany({
            data: filteredAttributes.map(attributeId => ({ productId: id, attributeId })),
            skipDuplicates: true,
          });
        }
      }
      // Update assets if provided
      if (updateProductDto.assets !== undefined) {
        await this.prisma.productAsset.deleteMany({ where: { productId: id } });
        if (updateProductDto.assets.length > 0) {
          await this.prisma.productAsset.createMany({
            data: updateProductDto.assets.map(assetId => ({ productId: id, assetId })),
            skipDuplicates: true,
          });
        }
      }

  // Recalculate status
  const newStatus = await this.calculateProductStatus(id);
  await this.prisma.product.update({ where: { id }, data: { status: newStatus } });
  this.logger.log(`Product ${id} status updated to: ${newStatus}`);

      // Fetch and return the updated product with relations
      const result = await this.findOne(id, userId);
      this.logger.log(`Successfully updated product with ID: ${id}`);
      return {
        ...result,
        removedAttributesMessage: removedAttributeNames.length > 0
          ? `Removed duplicate attributes: ${removedAttributeNames.join(', ')} (already present in family)`
          : undefined,
      };
  } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to update product ${id}: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to update product');
    }
  }

  private async calculateProductStatus(productId: number): Promise<string> {
    this.logger.log(`[calculateProductStatus] Called for productId: ${productId}`);
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        family: {
          include: {
            familyAttributes: {
              where: { isRequired: true },
              include: {
                attribute: {
                  select: { id: true, name: true, defaultValue: true }
                }
              }
            }
          }
        },
        attributes: {
          include: { attribute: true }
        }
      }
    });

    if (!product) {
      this.logger.error(`[calculateProductStatus] Product not found for productId: ${productId}`);
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    const hasFamily = !!product.family;
    const productAttributes = product.attributes || [];
    const hasAttributeIds = productAttributes.length > 0;

    let status = 'complete';
    let reason = '';

    if (hasFamily) {
      // Check all required family attributes for default values
      const requiredAttributes = product.family?.familyAttributes || [];
      const allRequiredHaveDefault = requiredAttributes.every((fa: any) => fa.attribute?.defaultValue !== null && fa.attribute?.defaultValue !== '');
      if (!allRequiredHaveDefault) {
        status = 'incomplete';
        reason = 'Family exists but not all required attributes have default values.';
      } else {
        reason = 'Family exists and all required attributes have default values.';
      }
    } else if (hasAttributeIds) {
      // Check all product attributes for default values
      this.logger.log('[calculateProductStatus] Product attribute default values:', productAttributes.map((attr: any) => attr.attribute?.defaultValue));
      const allAttributesHaveDefault = productAttributes.every((attr: any) => attr.attribute?.defaultValue !== null && attr.attribute?.defaultValue !== '');
      if (!allAttributesHaveDefault) {
        status = 'incomplete';
        reason = 'Product has attribute IDs but not all have default values.';
      } else {
        reason = 'Product has attribute IDs and all have default values.';
      }
    } else {
      // No family and no attribute ids, status is complete
      status = 'complete';
      reason = 'Product has neither family nor attribute IDs.';
    }

    this.logger.log(`[calculateProductStatus] Saved status '${status}' for productId ${productId}. Reason: ${reason}`);
    return status;
  }

  async remove(id: number, userId: number): Promise<{ message: string }> {
    try {
      // Verify ownership first
      await this.findOne(id, userId);

      this.logger.log(`Deleting product: ${id} for user: ${userId}`);

      await this.prisma.product.delete({
        where: { id },
      });

      this.logger.log(`Successfully deleted product with ID: ${id}`);
      return { message: 'Product successfully deleted' };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to delete product ${id}: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to delete product');
    }
  }

  async getProductsByCategory(categoryId: number, userId: number, page: number = 1, limit: number = 10, sortBy?: string, sortOrder: 'asc' | 'desc' = 'desc'): Promise<PaginatedResponse<ProductResponseDto>> {
    try {
      // Verify category ownership
      await this.validateCategory(categoryId, userId);

      this.logger.log(`Fetching products for category: ${categoryId}, user: ${userId}`);

      const whereCondition = {
        categoryId,
        userId,
      };

      const paginationOptions = PaginationUtils.createPrismaOptions(page, limit);

      // Build orderBy object based on sortBy parameter
      const orderBy = this.buildOrderBy(sortBy, sortOrder);

      const [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where: whereCondition,
          ...paginationOptions,
          include: {
            category: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
            attributes: {
              select: {
                attributeId: true,
              },
            },
            attributeGroup: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
            family: {
              select: {
                id: true,
                name: true,
                familyAttributes: {
                  include: {
                  },
                },
              },
            },
            variantLinksA: {
              include: {
                productB: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                    imageUrl: true,
                    status: true,
                  },
                },
              },
            },
            variantLinksB: {
              include: {
                productA: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                    imageUrl: true,
                    status: true,
                  },
                },
              },
            },
          },
          orderBy,
        }),
        this.prisma.product.count({ where: whereCondition }),
      ]);

      const productResponseDtos = await Promise.all(products.map(product => this.transformProductForResponse(product)));
      
      return PaginationUtils.createPaginatedResponse(productResponseDtos, total, page, limit);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to fetch products for category ${categoryId}: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to fetch products');
    }
  }

  async getProductsByAttribute(attributeId: number, userId: number, page: number = 1, limit: number = 10, sortBy?: string, sortOrder: 'asc' | 'desc' = 'desc'): Promise<PaginatedResponse<ProductResponseDto>> {
    try {
      // Verify attribute ownership
      await this.validateAttribute(attributeId, userId);

      this.logger.log(`Fetching products for attribute: ${attributeId}, user: ${userId}`);

      const whereCondition = {
        attributeId,
        userId,
      };

      const paginationOptions = PaginationUtils.createPrismaOptions(page, limit);

      const [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where: whereCondition,
          ...paginationOptions,
          include: {
            category: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
            attributes: {
              select: {
                attributeId: true,
              },
            },
            attributeGroup: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
            family: {
              select: {
                id: true,
                name: true,
                familyAttributes: {
                  include: {
                    attribute: {
                      select: {
                        id: true,
                        name: true,
                        type: true,
                        defaultValue: true,
                      },
                    },
                  },
                },
              },
            },
            variantLinksA: {
              include: {
                productB: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                    imageUrl: true,
                    status: true,
                  },
                },
              },
            },
            variantLinksB: {
              include: {
                productA: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                    imageUrl: true,
                    status: true,
                  },
                },
              },
            },
          },
          orderBy: this.buildOrderBy(sortBy, sortOrder),
        }),
        this.prisma.product.count({ where: whereCondition }),
      ]);

      const productResponseDtos = await Promise.all(products.map(product => this.transformProductForResponse(product)));
      
      return PaginationUtils.createPaginatedResponse(productResponseDtos, total, page, limit);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to fetch products for attribute ${attributeId}: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to fetch products');
    }
  }

  async getProductsByAttributeGroup(attributeGroupId: number, userId: number, page: number = 1, limit: number = 10, sortBy?: string, sortOrder: 'asc' | 'desc' = 'desc'): Promise<PaginatedResponse<ProductResponseDto>> {
    try {
      // Verify attribute group ownership
      await this.validateAttributeGroup(attributeGroupId, userId);

      this.logger.log(`Fetching products for attribute group: ${attributeGroupId}, user: ${userId}`);

      const whereCondition = {
        attributeGroupId,
        userId,
      };

      const paginationOptions = PaginationUtils.createPrismaOptions(page, limit);

      const [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where: whereCondition,
          ...paginationOptions,
          include: {
            category: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
            attributes: {
              select: {
                attributeId: true,
              },
            },
            attributeGroup: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
            family: {
              select: {
                id: true,
                name: true,
                familyAttributes: {
                  include: {
                    attribute: {
                      select: {
                        id: true,
                        name: true,
                        type: true,
                        defaultValue: true,
                      },
                    },
                  },
                },
              },
            },
            variantLinksA: {
              include: {
                productB: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                    imageUrl: true,
                    status: true,
                  },
                },
              },
            },
            variantLinksB: {
              include: {
                productA: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                    imageUrl: true,
                    status: true,
                  },
                },
              },
            },
          },
          orderBy: this.buildOrderBy(sortBy, sortOrder),
        }),
        this.prisma.product.count({ where: whereCondition }),
      ]);

      const productResponseDtos = await Promise.all(products.map(product => this.transformProductForResponse(product)));
      
      return PaginationUtils.createPaginatedResponse(productResponseDtos, total, page, limit);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to fetch products for attribute group ${attributeGroupId}: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to fetch products');
    }
  }

  async getProductsByFamily(familyId: number, userId: number, page: number = 1, limit: number = 10, sortBy?: string, sortOrder: 'asc' | 'desc' = 'desc'): Promise<PaginatedResponse<ProductResponseDto>> {
    try {
      // Verify family ownership
      await this.validateFamily(familyId, userId);

      this.logger.log(`Fetching products for family: ${familyId}, user: ${userId}`);

      const whereCondition = {
        familyId,
        userId,
      };

      const paginationOptions = PaginationUtils.createPrismaOptions(page, limit);

      const [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where: whereCondition,
          ...paginationOptions,
          include: {
            category: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
            attributes: {
              select: {
                attributeId: true,
              },
            },
            attributeGroup: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
            family: {
              select: {
                id: true,
                name: true,
                familyAttributes: {
                  include: {
                    attribute: {
                      select: {
                        id: true,
                        name: true,
                        type: true,
                        defaultValue: true,
                      },
                    },
                  },
                },
              },
            },
            variantLinksA: {
              include: {
                productB: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                    imageUrl: true,
                    status: true,
                  },
                },
              },
            },
            variantLinksB: {
              include: {
                productA: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                    imageUrl: true,
                    status: true,
                  },
                },
              },
            },
          },
          orderBy: this.buildOrderBy(sortBy, sortOrder),
        }),
        this.prisma.product.count({ where: whereCondition }),
      ]);

      const productResponseDtos = await Promise.all(products.map(product => this.transformProductForResponse(product)));
      
      return PaginationUtils.createPaginatedResponse(productResponseDtos, total, page, limit);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to fetch products for family ${familyId}: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to fetch products');
    }
  }

  private async validateCategory(categoryId: number, userId: number): Promise<void> {
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        userId,
      },
    });

    if (!category) {
      throw new BadRequestException('Category not found or does not belong to you');
    }
  }

  private async validateAttribute(attributeId: number, userId: number): Promise<void> {
  // No longer needed: attributes are managed via join table
  }

  private async validateAttributeGroup(attributeGroupId: number, userId: number): Promise<void> {
    const attributeGroup = await this.prisma.attributeGroup.findFirst({
      where: {
        id: attributeGroupId,
        userId,
      },
    });

    if (!attributeGroup) {
      throw new BadRequestException('Attribute group not found or does not belong to you');
    }
  }

  private async validateFamily(familyId: number, userId: number): Promise<void> {
    const family = await this.prisma.family.findFirst({
      where: {
        id: familyId,
        userId,
      },
    });

    if (!family) {
      throw new BadRequestException('Family not found or does not belong to you');
    }
  }

  private async transformProductForResponse(product: any): Promise<ProductResponseDto> {
    // Extract variants from the product data
    const variants: any[] = [];
    
    if (product.variantLinksA) {
      // When this product is productA, add all productB variants
      variants.push(...product.variantLinksA.map((link: any) => link.productB));
    }
    
    if (product.variantLinksB) {
      // When this product is productB, add all productA variants
      variants.push(...product.variantLinksB.map((link: any) => link.productA));
    }

    // Attributes details
    let attributes: any = undefined;
    if (product.attributes) {
      if (product.attributes.length > 0 && product.attributes[0].attribute) {
        attributes = product.attributes.map((attr: any) => ({
          id: attr.attribute.id,
          name: attr.attribute.name,
          type: attr.attribute.type,
            userFriendlyType: attr.attribute.userFriendlyType ?? getUserFriendlyType(attr.attribute.type),
          defaultValue: attr.attribute.defaultValue,
        }));
      } else {
        attributes = product.attributes.map((attr: any) => attr.attributeId);
      }
    }

    // Assets details
    let assets: any = undefined;
    if (product.assets) {
      assets = product.assets.map((pa: any) => pa.asset ? {
        id: pa.asset.id,
        name: pa.asset.name,
        fileName: pa.asset.fileName,
        filePath: pa.asset.filePath,
        mimeType: pa.asset.mimeType,
        uploadDate: pa.asset.uploadDate,
        size: pa.asset.size !== undefined && pa.asset.size !== null ? pa.asset.size.toString() : null,
      } : pa.assetId);
    }

    // Format dates to YYYY-MM-DD format
    const formatDate = (date: Date) => {
      return date.toISOString().split('T')[0];
    };

    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      productLink: product.productLink,
      imageUrl: product.imageUrl,
      subImages: product.subImages || [],
      status: product.status,
      categoryId: product.categoryId,
      attributeGroupId: product.attributeGroupId,
      familyId: product.familyId,
      userId: product.userId,
      createdAt: formatDate(product.createdAt),
      updatedAt: formatDate(product.updatedAt),
      category: product.category ? {
        id: product.category.id,
        name: product.category.name,
        description: product.category.description,
      } : undefined,
      attributeGroup: product.attributeGroup ? {
        id: product.attributeGroup.id,
        name: product.attributeGroup.name,
        description: product.attributeGroup.description,
      } : undefined,
      family: product.family ? {
        id: product.family.id,
        name: product.family.name,
        requiredAttributes: product.family.familyAttributes
          ?.filter((fa: any) => fa.isRequired)
          ?.map((fa: any) => ({
            id: fa.attribute.id,
            name: fa.attribute.name,
            type: fa.attribute.type,
            defaultValue: fa.attribute.defaultValue,
              userFriendlyType: fa.attribute.userFriendlyType ?? getUserFriendlyType(fa.attribute.type),
          })) || [],
        optionalAttributes: product.family.familyAttributes
          ?.filter((fa: any) => !fa.isRequired)
          ?.map((fa: any) => ({
            id: fa.attribute.id,
            name: fa.attribute.name,
            type: fa.attribute.type,
            defaultValue: fa.attribute.defaultValue,
              userFriendlyType: fa.attribute.userFriendlyType ?? getUserFriendlyType(fa.attribute.type),
          })) || [],
      } : undefined,
      variants: variants.length > 0 ? variants.map(variant => ({
        id: variant.id,
        name: variant.name,
        sku: variant.sku,
        imageUrl: variant.imageUrl,
        status: variant.status,
      })) : undefined,
      totalVariants: variants.length,
      attributes,
      assets,
    };
  }

  private handleDatabaseError(error: any, operation: string): never {
    this.logger.error(`Failed to ${operation} product: ${error.message}`, error.stack);

    // Handle Prisma-specific errors
    if (error.code === 'P2002') {
      if (error.meta?.target?.includes('sku')) {
        throw new ConflictException('A product with this SKU already exists');
      }
      if (error.meta?.target?.includes('name')) {
        throw new ConflictException('A product with this name already exists');
      }
      throw new ConflictException('A product with these details already exists');
    }

    if (error.code === 'P2000') {
      throw new BadRequestException('The provided value is too long');
    }

    if (error.code === 'P2025') {
      throw new NotFoundException('Product not found');
    }

    // Re-throw known HTTP exceptions
    if (error.status) {
      throw error;
    }

    // Default error
    throw new BadRequestException(`Failed to ${operation} product`);
  }

  // Product Variant Management Methods

  async createVariant(createVariantDto: CreateProductVariantDto, userId: number): Promise<{ message: string; created: number; variants: ProductVariantResponseDto[] }> {
    try {
      const { productId, variantProductIds } = createVariantDto;

      // Verify the main product exists and belongs to the user
      const mainProduct = await this.prisma.product.findFirst({
        where: { id: productId, userId },
      });

      if (!mainProduct) {
        throw new BadRequestException('Main product not found or does not belong to you');
      }

      // Verify all variant products exist and belong to the user
      const variantProducts = await this.prisma.product.findMany({
        where: {
          id: { in: variantProductIds },
          userId,
        },
      });

      if (variantProducts.length !== variantProductIds.length) {
        throw new BadRequestException('One or more variant products not found or do not belong to you');
      }

      // Create all possible combinations between all products in the variant group
      // This creates a fully connected graph where every product is connected to every other product
      const allProductIds = [productId, ...variantProductIds];
      const variantData: { productAId: number; productBId: number }[] = [];

      // Generate all unique pairs
      for (let i = 0; i < allProductIds.length; i++) {
        for (let j = i + 1; j < allProductIds.length; j++) {
          const [smallerId, largerId] = allProductIds[i] < allProductIds[j] 
            ? [allProductIds[i], allProductIds[j]] 
            : [allProductIds[j], allProductIds[i]];
          variantData.push({ productAId: smallerId, productBId: largerId });
        }
      }

      // Create variants using createMany (will ignore duplicates)
      const result = await this.prisma.productVariant.createMany({
        data: variantData,
        skipDuplicates: true,
      });

      // Fetch the created variants with product details
      const createdVariants = await this.prisma.productVariant.findMany({
        where: {
          OR: variantData.map(v => ({
            productAId: v.productAId,
            productBId: v.productBId,
          })),
        },
        include: {
          productA: {
            select: {
              id: true,
              name: true,
              sku: true,
              imageUrl: true,
              status: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          productB: {
            select: {
              id: true,
              name: true,
              sku: true,
              imageUrl: true,
              status: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });

      // Transform the variants
      const transformedVariants = createdVariants.map(variant => ({
        ...variant,
        productA: {
          ...variant.productA,
          imageUrl: variant.productA.imageUrl ?? undefined,
          createdAt: variant.productA.createdAt.toISOString().split('T')[0],
          updatedAt: variant.productA.updatedAt.toISOString().split('T')[0],
        },
        productB: {
          ...variant.productB,
          imageUrl: variant.productB.imageUrl ?? undefined,
          createdAt: variant.productB.createdAt.toISOString().split('T')[0],
          updatedAt: variant.productB.updatedAt.toISOString().split('T')[0],
        },
      })) as ProductVariantResponseDto[];

      this.logger.log(`Created ${result.count} variant relationships for product ${productId} and its variant group`);
      return { message: `Successfully added ${result.count} variant relationships to create a fully connected variant group`, created: result.count, variants: transformedVariants };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to create product variants: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to create product variants');
    }
  }

  async removeVariant(removeVariantDto: RemoveProductVariantDto, userId: number): Promise<{ message: string }> {
    try {
      this.logger.log(`RemoveVariant called with DTO: ${JSON.stringify(removeVariantDto)}, userId: ${userId}`);
      
      const { productId, variantProductId } = removeVariantDto;
      
      // Validate that we have proper numbers
      if (!Number.isInteger(productId) || !Number.isInteger(variantProductId)) {
        throw new BadRequestException('Product IDs must be valid integers');
      }
      
      if (productId <= 0 || variantProductId <= 0) {
        throw new BadRequestException('Product IDs must be positive integers');
      }
      
      if (productId === variantProductId) {
        throw new BadRequestException('Cannot remove variant relationship with the same product');
      }

      this.logger.log(`Removing variant relationship between ${productId} and ${variantProductId}`);

      // Ensure proper ordering
      const [smallerId, largerId] = productId < variantProductId ? [productId, variantProductId] : [variantProductId, productId];

      // Verify both products belong to the user
      const products = await this.prisma.product.findMany({
        where: {
          id: { in: [smallerId, largerId] },
          userId,
        },
      });

      if (products.length !== 2) {
        throw new BadRequestException('One or both products not found or do not belong to you');
      }

      // Find the specific variant relationship to remove
      const variant = await this.prisma.productVariant.findUnique({
        where: {
          productAId_productBId: {
            productAId: smallerId,
            productBId: largerId,
          },
        },
      });

      if (!variant) {
        throw new NotFoundException('Variant relationship not found');
      }

      // Get all current variants for both products to understand the full graph
      const allVariantsForBothProducts = await this.prisma.productVariant.findMany({
        where: {
          OR: [
            { productAId: { in: [smallerId, largerId] } },
            { productBId: { in: [smallerId, largerId] } },
          ],
        },
      });

      // Find all products connected to the larger ID (the one we want to remove from all relationships)
      const connectedToLargerProduct = new Set<number>();
      
      allVariantsForBothProducts.forEach(v => {
        if (v.productAId === largerId) {
          connectedToLargerProduct.add(v.productBId);
        }
        if (v.productBId === largerId) {
          connectedToLargerProduct.add(v.productAId);
        }
      });

      // Remove the smaller product from the connected set since we want to keep its relationship with others
      connectedToLargerProduct.delete(smallerId);

      // Use a transaction to ensure atomicity
      await this.prisma.$transaction(async (tx) => {
        // First, delete the specific relationship requested
        await tx.productVariant.delete({
          where: {
            productAId_productBId: {
              productAId: smallerId,
              productBId: largerId,
            },
          },
        });

        // Then, remove the larger product from all its other relationships
        if (connectedToLargerProduct.size > 0) {
          await tx.productVariant.deleteMany({
            where: {
              OR: [
                {
                  productAId: largerId,
                  productBId: { in: Array.from(connectedToLargerProduct) },
                },
                {
                  productAId: { in: Array.from(connectedToLargerProduct) },
                  productBId: largerId,
                },
              ],
            },
          });
        }
      });

      const removedRelationships = 1 + connectedToLargerProduct.size;
      this.logger.log(`Removed ${removedRelationships} variant relationships involving product ${largerId}`);
      
      return { 
        message: `Successfully removed ${removedRelationships} variant relationships. Product ${largerId} has been disconnected from the variant group, while other relationships remain intact.` 
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to remove product variant: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to remove product variant');
    }
  }

  async getAllProductVariants(
    userId: number, 
    queryDto: GetProductVariantsDto
  ): Promise<PaginatedResponse<ProductVariantResponseDto>> {
    try {
      const { page = 1, limit = 10, sortBy = 'name', sortOrder = 'asc', search, status } = queryDto;
      const skip = (page - 1) * limit;

      // Build where clause for filtering
      const whereClause: any = {
        OR: [
          { productA: { userId } },
          { productB: { userId } },
        ],
      };

      // Add search filtering
      if (search) {
        whereClause.OR = [
          {
            productA: {
              userId,
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
          {
            productB: {
              userId,
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        ];
      }

      // Add status filtering
      if (status) {
        const statusCondition = { status };
        if (search) {
          // If both search and status filters are applied
          whereClause.OR = [
            {
              productA: {
                userId,
                ...statusCondition,
                OR: [
                  { name: { contains: search, mode: 'insensitive' } },
                  { sku: { contains: search, mode: 'insensitive' } },
                ],
              },
            },
            {
              productB: {
                userId,
                ...statusCondition,
                OR: [
                  { name: { contains: search, mode: 'insensitive' } },
                  { sku: { contains: search, mode: 'insensitive' } },
                ],
              },
            },
          ];
        } else {
          // Only status filter
          whereClause.OR = [
            {
              productA: {
                userId,
                ...statusCondition,
              },
            },
            {
              productB: {
                userId,
                ...statusCondition,
              },
            },
          ];
        }
      }

      // Get total count for user's products variants
      const total = await this.prisma.productVariant.count({
        where: whereClause,
      });

      // Get paginated variants for user's products
      const variants = await this.prisma.productVariant.findMany({
        where: whereClause,
        include: {
          productA: {
            select: {
              id: true,
              name: true,
              sku: true,
              imageUrl: true,
              status: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          productB: {
            select: {
              id: true,
              name: true,
              sku: true,
              imageUrl: true,
              status: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: [
          {
            productA: {
              [sortBy]: sortOrder,
            },
          },
          {
            productB: {
              [sortBy]: sortOrder,
            },
          },
        ],
      });

      // Transform the response to handle null/undefined differences
      const transformedVariants = variants.map(variant => ({
        ...variant,
        productA: {
          ...variant.productA,
          imageUrl: variant.productA.imageUrl ?? undefined,
          createdAt: variant.productA.createdAt.toISOString().split('T')[0],
          updatedAt: variant.productA.updatedAt.toISOString().split('T')[0],
        },
        productB: {
          ...variant.productB,
          imageUrl: variant.productB.imageUrl ?? undefined,
          createdAt: variant.productB.createdAt.toISOString().split('T')[0],
          updatedAt: variant.productB.updatedAt.toISOString().split('T')[0],
        },
      })) as ProductVariantResponseDto[];

      const totalPages = Math.ceil(total / limit);
      
      return {
        data: transformedVariants,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get all product variants: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to get all product variants');
    }
  }

  async getProductVariants(
    productId: number, 
    userId: number, 
    queryDto: GetProductVariantsDto
  ): Promise<PaginatedResponse<ProductVariantResponseDto>> {
    try {
      // Verify the product exists and belongs to the user
      const product = await this.prisma.product.findFirst({
        where: { id: productId, userId },
      });

      if (!product) {
        throw new BadRequestException('Product not found or does not belong to you');
      }

      const { page = 1, limit = 10, sortBy = 'name', sortOrder = 'asc', search, status } = queryDto;
      const skip = (page - 1) * limit;

      // Build base where clause for variants of this specific product
      let whereClause: any = {
        OR: [
          { productAId: productId },
          { productBId: productId },
        ],
      };

      // Add search and status filtering if provided
      if (search || status) {
        const productFilters: any = {};
        
        if (search) {
          productFilters.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { sku: { contains: search, mode: 'insensitive' } },
          ];
        }
        
        if (status) {
          productFilters.status = status;
        }

        // Apply filters to both productA and productB
        whereClause = {
          OR: [
            {
              productAId: productId,
              productB: productFilters,
            },
            {
              productBId: productId,
              productA: productFilters,
            },
          ],
        };
      }

      // Get total count
      const total = await this.prisma.productVariant.count({
        where: whereClause,
      });

      // Get paginated variants where this product is either productA or productB
      const variants = await this.prisma.productVariant.findMany({
        where: whereClause,
        include: {
          productA: {
            select: {
              id: true,
              name: true,
              sku: true,
              imageUrl: true,
              status: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          productB: {
            select: {
              id: true,
              name: true,
              sku: true,
              imageUrl: true,
              status: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: [
          {
            productA: {
              [sortBy]: sortOrder,
            },
          },
          {
            productB: {
              [sortBy]: sortOrder,
            },
          },
        ],
      });

      // Transform the response to handle null/undefined differences
      const transformedVariants = variants.map(variant => ({
        ...variant,
        productA: {
          ...variant.productA,
          imageUrl: variant.productA.imageUrl ?? undefined,
          createdAt: variant.productA.createdAt.toISOString().split('T')[0],
          updatedAt: variant.productA.updatedAt.toISOString().split('T')[0],
        },
        productB: {
          ...variant.productB,
          imageUrl: variant.productB.imageUrl ?? undefined,
          createdAt: variant.productB.createdAt.toISOString().split('T')[0],
          updatedAt: variant.productB.updatedAt.toISOString().split('T')[0],
        },
      })) as ProductVariantResponseDto[];

      const totalPages = Math.ceil(total / limit);
      
      return {
        data: transformedVariants,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to get product variants: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to get product variants');
    }
  }

  /**
   * Export products with user-selected attributes
   * @param exportDto - Export configuration with product IDs and selected attributes
   * @param userId - The ID of the user
   * @returns Promise<ExportProductResponseDto>
   */
  async exportProducts(exportDto: ExportProductDto, userId: number): Promise<ExportProductResponseDto> {
    try {
      this.logger.log(`Exporting ${exportDto.productIds.length} products for user: ${userId}`);

      // Determine what data to include based on selected attributes
      const includeRelations = this.determineIncludeRelations(exportDto.attributes);

      // Fetch products with required relations
      const products = await this.prisma.product.findMany({
        where: {
          id: { in: exportDto.productIds },
          userId,
        },
        include: includeRelations,
        orderBy: { id: 'asc' },
      });

      if (products.length === 0) {
        throw new NotFoundException('No products found with the provided IDs or access denied');
      }

      // Get variant data for products that need it
      const variantData = new Map<number, any[]>();
      if (this.needsVariantData(exportDto.attributes)) {
        for (const product of products) {
          const variants = await this.getProductVariantsForExport(product.id);
          variantData.set(product.id, variants);
        }
      }

      // Transform products to export format based on selected attributes
      const exportData = products.map(product => {
        const transformedProduct = this.transformProductForExport(product, exportDto.attributes, variantData.get(product.id) || []);
        return transformedProduct;
      });

      const filename = exportDto.filename || `products_export_${new Date().toISOString().split('T')[0]}.${exportDto.format || ExportFormat.JSON}`;

      this.logger.log(`Successfully exported ${exportData.length} products`);

      return {
        data: exportData,
        format: exportDto.format || ExportFormat.JSON,
        filename,
        totalRecords: exportData.length,
        selectedAttributes: exportDto.attributes,
        exportedAt: new Date(),
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to export products: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to export products');
    }
  }

  /**
   * Determine which relations to include based on selected attributes
   */
  private determineIncludeRelations(attributes: ProductAttribute[]): any {
    const includeRelations: any = {};

    // Check if we need category data
    if (attributes.some(attr => ['categoryName', 'categoryDescription'].includes(attr))) {
      includeRelations.category = {
        select: {
          id: true,
          name: true,
          description: true,
        },
      };
    }

    // Check if we need attribute data
    if (attributes.some(attr => ['attributeName', 'attributeType', 'attributeDefaultValue'].includes(attr))) {
      includeRelations.attribute = {
        select: {
          id: true,
          name: true,
          type: true,
          defaultValue: true,
        },
      };
    }

    // Check if we need attribute group data
    if (attributes.some(attr => ['attributeGroupName', 'attributeGroupDescription'].includes(attr))) {
      includeRelations.attributeGroup = {
        select: {
          id: true,
          name: true,
          description: true,
        },
      };
    }

    // Check if we need family data
    if (attributes.some(attr => ['familyName'].includes(attr))) {
      includeRelations.family = {
        select: {
          id: true,
          name: true,
          familyAttributes: {
            include: {
              attribute: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                  defaultValue: true,
                },
              },
            },
          },
        },
      };
    }

    return includeRelations;
  }

  /**
   * Check if variant data is needed
   */
  private needsVariantData(attributes: ProductAttribute[]): boolean {
    return attributes.some(attr => ['variantCount', 'variantNames', 'variantSkus'].includes(attr));
  }

  /**
   * Get variants for a product for export purposes
   */
  private async getProductVariantsForExport(productId: number): Promise<any[]> {
    try {
      const variants = await this.prisma.productVariant.findMany({
        where: {
          OR: [
            { productAId: productId },
            { productBId: productId },
          ],
        },
        include: {
          productA: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
          productB: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
        },
      });

      // Collect variants (excluding the current product)
      const variantProducts: any[] = [];
      variants.forEach(variant => {
        if (variant.productAId === productId) {
          variantProducts.push(variant.productB);
        } else {
          variantProducts.push(variant.productA);
        }
      });

      return variantProducts;
    } catch (error) {
      this.logger.error(`Failed to fetch variants for product ${productId}: ${error.message}`);
      return [];
    }
  }

  /**
   * Transform product data for export based on selected attributes
   */
  private transformProductForExport(product: any, selectedAttributes: ProductAttribute[], variants: any[]): any {
    const exportRecord: any = {};

    selectedAttributes.forEach(attr => {
      switch (attr) {
        case ProductAttribute.ID:
          exportRecord.id = product.id;
          break;
        case ProductAttribute.NAME:
          exportRecord.name = product.name;
          break;
        case ProductAttribute.SKU:
          exportRecord.sku = product.sku;
          break;
        case ProductAttribute.STATUS:
          exportRecord.status = product.status;
          break;
        case ProductAttribute.PRODUCT_LINK:
          exportRecord.productLink = product.productLink || '';
          break;
        case ProductAttribute.IMAGE_URL:
          exportRecord.imageUrl = product.imageUrl || '';
          break;
        case ProductAttribute.CATEGORY_ID:
          exportRecord.categoryId = product.categoryId || '';
          break;
        case ProductAttribute.CATEGORY_NAME:
          exportRecord.categoryName = product.category?.name || '';
          break;
        case ProductAttribute.CATEGORY_DESCRIPTION:
          exportRecord.categoryDescription = product.category?.description || '';
          break;
        case ProductAttribute.ATTRIBUTE_ID:
          exportRecord.attributeId = product.attributeId || '';
          break;
        case ProductAttribute.ATTRIBUTE_NAME:
          exportRecord.attributeName = product.attribute?.name || '';
          break;
        case ProductAttribute.ATTRIBUTE_TYPE:
          exportRecord.attributeType = product.attribute?.type || '';
          break;
        case ProductAttribute.ATTRIBUTE_DEFAULT_VALUE:
          exportRecord.attributeDefaultValue = product.attribute?.defaultValue || '';
          break;
        case ProductAttribute.ATTRIBUTE_GROUP_ID:
          exportRecord.attributeGroupId = product.attributeGroupId || '';
          break;
        case ProductAttribute.ATTRIBUTE_GROUP_NAME:
          exportRecord.attributeGroupName = product.attributeGroup?.name || '';
          break;
        case ProductAttribute.ATTRIBUTE_GROUP_DESCRIPTION:
          exportRecord.attributeGroupDescription = product.attributeGroup?.description || '';
          break;
        case ProductAttribute.FAMILY_ID:
          exportRecord.familyId = product.familyId || '';
          break;
        case ProductAttribute.FAMILY_NAME:
          exportRecord.familyName = product.family?.name || '';
          break;
        case ProductAttribute.VARIANT_COUNT:
          exportRecord.variantCount = variants.length;
          break;
        case ProductAttribute.VARIANT_NAMES:
          exportRecord.variantNames = variants.map(v => v.name).join(', ');
          break;
        case ProductAttribute.VARIANT_SKUS:
          exportRecord.variantSkus = variants.map(v => v.sku).join(', ');
          break;
        case ProductAttribute.USER_ID:
          exportRecord.userId = product.userId;
          break;
        case ProductAttribute.CREATED_AT:
          exportRecord.createdAt = product.createdAt.toISOString();
          break;
        case ProductAttribute.UPDATED_AT:
          exportRecord.updatedAt = product.updatedAt.toISOString();
          break;
        default:
          // Handle any unknown attributes gracefully
          this.logger.warn(`Unknown attribute: ${attr}`);
          break;
      }
    });

    return exportRecord;
  }

  /**
   * Get all attribute IDs from a family (both required and optional)
   */
  private async getFamilyAttributeIds(familyId: number): Promise<number[]> {
    const familyAttributes = await this.prisma.familyAttribute.findMany({
      where: { familyId },
      select: { attributeId: true },
    });

    return familyAttributes.map(fa => fa.attributeId);
  }

  /**
   * Filter out attributes that are already present in the family
   */
  private filterDuplicateAttributes(attributes: number[], familyAttributeIds: number[]): { filteredAttributes: number[], removedAttributes: number[] } {
    const filteredAttributes: number[] = [];
    const removedAttributes: number[] = [];

    attributes.forEach(attributeId => {
      if (familyAttributeIds.includes(attributeId)) {
        removedAttributes.push(attributeId);
      } else {
        filteredAttributes.push(attributeId);
      }
    });

    return { filteredAttributes, removedAttributes };
  }

  /**
   * Get attribute names for logging purposes
   */
  private async getAttributeNames(attributeIds: number[]): Promise<string[]> {
    if (attributeIds.length === 0) return [];

    const attributes = await this.prisma.attribute.findMany({
      where: { id: { in: attributeIds } },
      select: { id: true, name: true },
    });

    return attributes.map(attr => attr.name);
  }

  /**
   * Build orderBy object based on sortBy parameter
   */
  private buildOrderBy(sortBy?: string, sortOrder: 'asc' | 'desc' = 'desc'): any {
    if (!sortBy) {
      return { createdAt: 'desc' };
    }

    const validSortFields = [
      'id', 'name', 'sku', 'productLink', 'imageUrl', 'status', 
      'categoryId', 'attributeGroupId', 'familyId', 'userId', 
      'createdAt', 'updatedAt'
    ];
    
    if (validSortFields.includes(sortBy)) {
      return { [sortBy]: sortOrder };
    }
    
    // Handle related field sorting
    switch (sortBy) {
      case 'categoryName':
        return {
          category: {
            name: sortOrder
          }
        };
      case 'attributeGroupName':
        return {
          attributeGroup: {
            name: sortOrder
          }
        };
      case 'familyName':
        return {
          family: {
            name: sortOrder
          }
        };
      default:
        return { createdAt: 'desc' };
    }
  }
}
