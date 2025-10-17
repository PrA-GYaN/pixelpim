import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductAttributesDto } from './dto/update-product-attribute.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { CreateProductVariantDto, RemoveProductVariantDto, ProductVariantResponseDto, GetProductVariantsDto } from './dto/product-variant.dto';
import { ExportProductDto, ExportProductResponseDto, ProductAttribute, ExportFormat, AttributeSelectionDto } from './dto/export-product.dto';
import { MarketplaceExportDto, MarketplaceExportResponseDto, MarketplaceType } from './dto/marketplace-export.dto';
import { ScheduleImportDto, UpdateScheduledImportDto, ImportJobResponseDto } from './dto/schedule-import.dto';
import { CsvImportService } from './services/csv-import.service';
import { ImportSchedulerService } from './services/import-scheduler.service';
import { MarketplaceTemplateService } from './services/marketplace-template.service';
import { MarketplaceExportService } from './services/marketplace-export.service';
import { PaginatedResponse, PaginationUtils } from '../common';
import type { Product } from '../../generated/prisma';
import { getUserFriendlyType } from '../types/user-attribute-type.enum';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly marketplaceTemplateService: MarketplaceTemplateService,
    private readonly marketplaceExportService: MarketplaceExportService,
    @Inject(forwardRef(() => CsvImportService))
    private readonly csvImportService: CsvImportService,
    @Inject(forwardRef(() => ImportSchedulerService))
    private readonly importSchedulerService: ImportSchedulerService,
  ) {}

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

      // Add attributes with values if provided
      if (createProductDto.attributesWithValues && createProductDto.attributesWithValues.length > 0) {
        // Validate that all attributes belong to the user
        const attributeIds = createProductDto.attributesWithValues.map(av => av.attributeId);
        const existingAttributes = await this.prisma.attribute.findMany({
          where: {
            id: { in: attributeIds },
            userId,
          },
        });

        if (existingAttributes.length !== attributeIds.length) {
          throw new BadRequestException('One or more attributes do not exist or do not belong to you');
        }

        // Filter out attributes that are already in the family
        let filteredAttributesWithValues = createProductDto.attributesWithValues;
        if (createProductDto.familyId) {
          const familyAttributeIds = await this.getFamilyAttributeIds(createProductDto.familyId);
          filteredAttributesWithValues = createProductDto.attributesWithValues.filter(
            av => !familyAttributeIds.includes(av.attributeId)
          );
        }

        // Create ProductAttribute entries with values using upsert
        for (const { attributeId, value } of filteredAttributesWithValues) {
          await this.prisma.productAttribute.upsert({
            where: {
              productId_attributeId: {
                productId: product.id,
                attributeId,
              },
            },
            update: {
              value: value || null,
            },
            create: {
              productId: product.id,
              attributeId,
              value: value || null,
            },
          });
        }
      }

      // Handle family attributes with values if provided
      if (createProductDto.familyAttributesWithValues && createProductDto.familyAttributesWithValues.length > 0) {
        if (!createProductDto.familyId) {
          throw new BadRequestException('Cannot set family attribute values without a family assigned');
        }

        // Get family attributes to validate and get familyAttributeId mapping
        const familyAttributes = await this.prisma.familyAttribute.findMany({
          where: { familyId: createProductDto.familyId },
          include: { attribute: true },
        });

        const familyAttributeMap = new Map(
          familyAttributes.map(fa => [fa.attribute.id, fa.id])
        );

        // Validate that all provided attributes belong to the family
        for (const { attributeId } of createProductDto.familyAttributesWithValues) {
          if (!familyAttributeMap.has(attributeId)) {
            throw new BadRequestException(`Attribute ${attributeId} is not part of the selected family`);
          }
        }

        // Create ProductAttribute entries for family attributes with values
        for (const { attributeId, value } of createProductDto.familyAttributesWithValues) {
          const familyAttributeId = familyAttributeMap.get(attributeId);
          
          await this.prisma.productAttribute.upsert({
            where: {
              productId_attributeId: {
                productId: product.id,
                attributeId,
              },
            },
            update: {
              value: value || null,
              familyAttributeId,
            },
            create: {
              productId: product.id,
              attributeId,
              familyAttributeId,
              value: value || null,
            },
          });
        }
      }

      // Calculate status
      const status = await this.calculateProductStatus(product.id);
      await this.prisma.product.update({ where: { id: product.id }, data: { status } });
      this.logger.log(`Product ${product.id} created with initial status: ${status}`);

      // Fetch updated product with status
      const result = await this.findOne(product.id, userId);
      this.logger.log(`Successfully created product with ID: ${result.id}`);
      
      // Log notification
      await this.notificationService.logProductCreation(userId, result.name, result.id);
      
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

  async upsertProductFromCsv(createProductDto: CreateProductDto, userId: number): Promise<ProductResponseDto> {
    try {
      this.logger.log(`Upserting product: ${createProductDto.name} for user: ${userId}`);

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
          this.logger.warn(`Removed duplicate attributes from product upsert: ${removedAttributeNames.join(', ')} (already present in family)`);
        }

        filteredAttributes = newFilteredAttributes;
      }

      // Use Prisma upsert for the product
      const product = await this.prisma.product.upsert({
        where: {
          sku_userId: {
            sku: createProductDto.sku,
            userId,
          },
        },
        update: {
          name: createProductDto.name,
          productLink: createProductDto.productLink,
          imageUrl: createProductDto.imageUrl,
          subImages: createProductDto.subImages || [],
          categoryId: createProductDto.categoryId,
          attributeGroupId: createProductDto.attributeGroupId,
          familyId: createProductDto.familyId,
        },
        create: {
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

      // Handle attributes - for upsert, we need to manage ProductAttribute entries
      if (filteredAttributes && filteredAttributes.length > 0) {
        // First, get existing ProductAttribute entries for this product
        const existingProductAttributes = await this.prisma.productAttribute.findMany({
          where: { productId: product.id },
          select: { attributeId: true },
        });
        const existingAttributeIds = existingProductAttributes.map(pa => pa.attributeId);

        // Determine which attributes to add and which to remove
        const attributesToAdd = filteredAttributes.filter(attrId => !existingAttributeIds.includes(attrId));
        const attributesToRemove = existingAttributeIds.filter(attrId => !filteredAttributes.includes(attrId));

        // Remove attributes that are no longer in the list
        if (attributesToRemove.length > 0) {
          await this.prisma.productAttribute.deleteMany({
            where: {
              productId: product.id,
              attributeId: { in: attributesToRemove },
            },
          });
        }

        // Add new attributes
        if (attributesToAdd.length > 0) {
          await this.prisma.productAttribute.createMany({
            data: attributesToAdd.map(attributeId => ({ productId: product.id, attributeId })),
            skipDuplicates: true,
          });
        }
      } else {
        // If no attributes provided, remove all existing ProductAttribute entries
        await this.prisma.productAttribute.deleteMany({ where: { productId: product.id } });
      }

      // Handle attributes with values if provided
      if (createProductDto.attributesWithValues && createProductDto.attributesWithValues.length > 0) {
        // Validate that all attributes belong to the user
        const attributeIds = createProductDto.attributesWithValues.map(av => av.attributeId);
        const existingAttributes = await this.prisma.attribute.findMany({
          where: {
            id: { in: attributeIds },
            userId,
          },
        });

        if (existingAttributes.length !== attributeIds.length) {
          throw new BadRequestException('One or more attributes do not exist or do not belong to you');
        }

        // Filter out attributes that are already in the family
        let filteredAttributesWithValues = createProductDto.attributesWithValues;
        if (createProductDto.familyId) {
          const familyAttributeIds = await this.getFamilyAttributeIds(createProductDto.familyId);
          filteredAttributesWithValues = createProductDto.attributesWithValues.filter(
            av => !familyAttributeIds.includes(av.attributeId)
          );
        }

        // Upsert ProductAttribute entries with values
        for (const { attributeId, value } of filteredAttributesWithValues) {
          await this.prisma.productAttribute.upsert({
            where: {
              productId_attributeId: {
                productId: product.id,
                attributeId,
              },
            },
            update: {
              value: value || null,
            },
            create: {
              productId: product.id,
              attributeId,
              value: value || null,
            },
          });
        }
      }

      // Handle family attributes with values if provided
      if (createProductDto.familyAttributesWithValues && createProductDto.familyAttributesWithValues.length > 0) {
        if (!createProductDto.familyId) {
          throw new BadRequestException('Cannot set family attribute values without a family assigned');
        }

        // Get family attributes to validate and get familyAttributeId mapping
        const familyAttributes = await this.prisma.familyAttribute.findMany({
          where: { familyId: createProductDto.familyId },
          include: { attribute: true },
        });

        const familyAttributeMap = new Map(
          familyAttributes.map(fa => [fa.attribute.id, fa.id])
        );

        // Validate that all provided attributes belong to the family
        for (const { attributeId } of createProductDto.familyAttributesWithValues) {
          if (!familyAttributeMap.has(attributeId)) {
            throw new BadRequestException(`Attribute ${attributeId} is not part of the selected family`);
          }
        }

        // Upsert ProductAttribute entries for family attributes with values
        for (const { attributeId, value } of createProductDto.familyAttributesWithValues) {
          const familyAttributeId = familyAttributeMap.get(attributeId);
          
          await this.prisma.productAttribute.upsert({
            where: {
              productId_attributeId: {
                productId: product.id,
                attributeId,
              },
            },
            update: {
              value: value || null,
              familyAttributeId,
            },
            create: {
              productId: product.id,
              attributeId,
              familyAttributeId,
              value: value || null,
            },
          });
        }
      }

      // Calculate status
      const status = await this.calculateProductStatus(product.id);
      await this.prisma.product.update({ where: { id: product.id }, data: { status } });
      this.logger.log(`Product ${product.id} upserted with status: ${status}`);

      // Fetch updated product with status
      const result = await this.findOne(product.id, userId);
      this.logger.log(`Successfully upserted product with ID: ${result.id}`);
      
      // Log notification - check if it was created or updated
      const wasCreated = !product.createdAt; // If createdAt is not set, it was created
      if (wasCreated) {
        await this.notificationService.logProductCreation(userId, result.name, result.id);
      } else {
        await this.notificationService.logProductUpdate(userId, result.name, result.id);
      }
      
      return {
        ...result,
        removedAttributesMessage: removedAttributeNames.length > 0
          ? `Removed duplicate attributes: ${removedAttributeNames.join(', ')} (already present in family)`
          : undefined,
      };
    } catch (error) {
      this.handleDatabaseError(error, 'upsert');
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
                value: true,
                familyAttributeId: true,
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
          },
          orderBy,
        }),
        this.prisma.product.count({ where: whereCondition }),
      ]);

      const productResponseDtos = await Promise.all(products.map(async product => {
        const response = await this.transformProductForResponse(product);
        return response;
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
            select: {
              value: true,
              familyAttributeId: true,
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
              value: true,
              familyAttributeId: true,
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

      // Update attributes with values if provided
      if (updateProductDto.attributesWithValues !== undefined) {
        // Validate that all attributes belong to the user
        const attributeIds = updateProductDto.attributesWithValues.map(av => av.attributeId);
        if (attributeIds.length > 0) {
          const existingAttributes = await this.prisma.attribute.findMany({
            where: {
              id: { in: attributeIds },
              userId,
            },
          });

          if (existingAttributes.length !== attributeIds.length) {
            throw new BadRequestException('One or more attributes do not exist or do not belong to you');
          }

          // Filter out attributes that are already in the family (if family is being updated)
          let filteredAttributesWithValues = updateProductDto.attributesWithValues;
          let familyIdToCheck = updateProductDto.familyId;
          
          // If familyId is not being updated, get it from the existing product
          if (familyIdToCheck === undefined) {
            const existingProduct = await this.prisma.product.findUnique({
              where: { id },
              select: { familyId: true },
            });
            familyIdToCheck = existingProduct?.familyId ?? undefined;
          }

          if (familyIdToCheck) {
            const familyAttributeIds = await this.getFamilyAttributeIds(familyIdToCheck);
            filteredAttributesWithValues = updateProductDto.attributesWithValues.filter(
              av => !familyAttributeIds.includes(av.attributeId)
            );
          }

          // First, delete existing ProductAttribute entries that aren't in the new list
          const currentProductAttributes = await this.prisma.productAttribute.findMany({
            where: { productId: id },
            select: { attributeId: true },
          });
          
          const newAttributeIds = filteredAttributesWithValues.map(av => av.attributeId);
          const attributesToDelete = currentProductAttributes
            .filter(pa => !newAttributeIds.includes(pa.attributeId))
            .map(pa => pa.attributeId);

          if (attributesToDelete.length > 0) {
            await this.prisma.productAttribute.deleteMany({
              where: {
                productId: id,
                attributeId: { in: attributesToDelete },
              },
            });
          }

          // Create or update ProductAttribute entries with values using upsert
          for (const { attributeId, value } of filteredAttributesWithValues) {
            await this.prisma.productAttribute.upsert({
              where: {
                productId_attributeId: {
                  productId: id,
                  attributeId,
                },
              },
              update: {
                value: value || null,
              },
              create: {
                productId: id,
                attributeId,
                value: value || null,
              },
            });
          }
        } else {
          // If empty array provided, delete all ProductAttribute entries
          await this.prisma.productAttribute.deleteMany({ where: { productId: id } });
        }
      }

      // Handle family attributes with values if provided
      if (updateProductDto.familyAttributesWithValues !== undefined) {
        let familyIdToCheck = updateProductDto.familyId;
        
        // If familyId is not being updated, get it from the existing product
        if (familyIdToCheck === undefined) {
          const existingProduct = await this.prisma.product.findUnique({
            where: { id },
            select: { familyId: true },
          });
          familyIdToCheck = existingProduct?.familyId ?? undefined;
        }

        if (updateProductDto.familyAttributesWithValues.length > 0) {
          if (!familyIdToCheck) {
            throw new BadRequestException('Cannot set family attribute values without a family assigned');
          }

          // Get family attributes to validate and get familyAttributeId mapping
          const familyAttributes = await this.prisma.familyAttribute.findMany({
            where: { familyId: familyIdToCheck },
            include: { attribute: true },
          });

          const familyAttributeMap = new Map(
            familyAttributes.map(fa => [fa.attribute.id, fa.id])
          );

          // Validate that all provided attributes belong to the family
          for (const { attributeId } of updateProductDto.familyAttributesWithValues) {
            if (!familyAttributeMap.has(attributeId)) {
              throw new BadRequestException(`Attribute ${attributeId} is not part of the product's family`);
            }
          }

          // First, delete existing family ProductAttribute entries that aren't in the new list
          const currentFamilyAttributes = await this.prisma.productAttribute.findMany({
            where: { 
              productId: id,
              familyAttributeId: { not: null }
            },
            select: { attributeId: true, familyAttributeId: true },
          });
          
          const newFamilyAttributeIds = updateProductDto.familyAttributesWithValues.map(av => av.attributeId);
          const familyAttributesToDelete = currentFamilyAttributes
            .filter(pa => !newFamilyAttributeIds.includes(pa.attributeId))
            .map(pa => pa.attributeId);

          if (familyAttributesToDelete.length > 0) {
            await this.prisma.productAttribute.deleteMany({
              where: {
                productId: id,
                attributeId: { in: familyAttributesToDelete },
                familyAttributeId: { not: null }
              },
            });
          }

          // Create or update ProductAttribute entries for family attributes with values
          for (const { attributeId, value } of updateProductDto.familyAttributesWithValues) {
            const familyAttributeId = familyAttributeMap.get(attributeId);
            
            await this.prisma.productAttribute.upsert({
              where: {
                productId_attributeId: {
                  productId: id,
                  attributeId,
                },
              },
              update: {
                value: value || null,
                familyAttributeId,
              },
              create: {
                productId: id,
                attributeId,
                familyAttributeId,
                value: value || null,
              },
            });
          }
        } else {
          // If empty array provided, delete all family ProductAttribute entries
          await this.prisma.productAttribute.deleteMany({ 
            where: { 
              productId: id,
              familyAttributeId: { not: null }
            } 
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
      
      // Log notification
      await this.notificationService.logProductUpdate(userId, result.name, result.id);
      
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
          select: {
            value: true,
            attribute: {
              select: { id: true, name: true, defaultValue: true }
            }
          }
        }
      }
    });

    if (!product) {
      this.logger.error(`[calculateProductStatus] Product not found for productId: ${productId}`);
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    const hasFamily = !!product.family;
    const productAttributes = product.attributes || [];
    const hasCustomAttributes = productAttributes.length > 0;

    let status = 'incomplete';
    let reason = '';

    // Rule 1: Product is complete ONLY if it has a family AND all required attributes have values
    if (hasFamily) {
      const requiredAttributes = product.family?.familyAttributes || [];

      if (requiredAttributes.length > 0) {
        // Check if all required family attributes have product-attribute values (not default values)
        const requiredAttributeIds = requiredAttributes.map((fa: any) => fa.attribute.id);
        const familyAttributeValues = productAttributes.filter((pa: any) =>
          requiredAttributeIds.includes(pa.attribute.id)
        );

        const allRequiredHaveProductValues = requiredAttributes.every((fa: any) => {
          const productAttr = familyAttributeValues.find((pa: any) => pa.attribute.id === fa.attribute.id);
          // Only consider product-attribute values, not default values
          const hasProductValue = productAttr && productAttr.value !== null && productAttr.value !== '';
          return hasProductValue;
        });

        if (allRequiredHaveProductValues) {
          status = 'complete';
          reason = 'Family exists and all required attributes have product-attribute values.';
        } else {
          status = 'incomplete';
          reason = 'Family exists but not all required attributes have product-attribute values.';
        }
      } else {
        // Family exists but has no required attributes - still incomplete
        status = 'incomplete';
        reason = 'Family exists but has no required attributes.';
      }
    } else {
      // No family - incomplete
      status = 'incomplete';
      reason = 'Product does not have a family assigned.';
    }

    // Note: Custom attributes are no longer considered for status calculation
    // Only family and required attributes matter

    this.logger.log(`[calculateProductStatus] Calculated status '${status}' for productId ${productId}. Reason: ${reason}`);
    return status;
  }

  async remove(id: number, userId: number): Promise<{ message: string }> {
    try {
      // Verify ownership first and get the product name for notification
      const product = await this.findOne(id, userId);

      this.logger.log(`Deleting product: ${id} for user: ${userId}`);

      await this.prisma.product.delete({
        where: { id },
      });

      this.logger.log(`Successfully deleted product with ID: ${id}`);
      
      // Log notification
      await this.notificationService.logProductDeletion(userId, product.name);
      
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
                value: true,
                familyAttributeId: true,
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
                value: true,
                familyAttributeId: true,
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
                value: true,
                familyAttributeId: true,
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
                value: true,
                familyAttributeId: true,
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
          value: attr.value, // Include the actual value from ProductAttribute
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

    // Helper function to get attribute value from product attributes
    const getAttributeValue = (attributeId: number, familyAttributeId?: number) => {
      // First, try to find by familyAttributeId if provided
      if (familyAttributeId) {
        const familyProductAttribute = product.attributes?.find((pa: any) => pa.familyAttributeId === familyAttributeId);
        if (familyProductAttribute) {
          return familyProductAttribute.value;
        }
      }
      
      // Fall back to finding by attributeId
      const productAttribute = product.attributes?.find((pa: any) => pa.attributeId === attributeId);
      return productAttribute?.value || null;
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
            value: getAttributeValue(fa.attribute.id, fa.id), // Pass familyAttributeId as well
          })) || [],
        optionalAttributes: product.family.familyAttributes
          ?.filter((fa: any) => !fa.isRequired)
          ?.map((fa: any) => ({
            id: fa.attribute.id,
            name: fa.attribute.name,
            type: fa.attribute.type,
            defaultValue: fa.attribute.defaultValue,
            userFriendlyType: fa.attribute.userFriendlyType ?? getUserFriendlyType(fa.attribute.type),
            value: getAttributeValue(fa.attribute.id, fa.id), // Pass familyAttributeId as well
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

      // Create only direct relationships between productId and each variantProductId
      // This creates a star pattern where productId is linked to each variantProductId individually
      const variantData: { productAId: number; productBId: number }[] = [];

      // Create direct pairs only (productId ↔ each variantProductId)
      for (const variantProductId of variantProductIds) {
        const [smallerId, largerId] = productId < variantProductId 
          ? [productId, variantProductId] 
          : [variantProductId, productId];
        variantData.push({ productAId: smallerId, productBId: largerId });
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

      this.logger.log(`Created ${result.count} direct variant relationships for product ${productId}`);
      return { message: `Successfully created ${result.count} direct variant relationships. Each selected product is now linked directly to product ${productId}.`, created: result.count, variants: transformedVariants };
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

      // Simply remove only the specific relationship requested
      await this.prisma.productVariant.delete({
        where: {
          productAId_productBId: {
            productAId: smallerId,
            productBId: largerId,
          },
        },
      });

      this.logger.log(`Removed variant relationship between product ${smallerId} and ${largerId}`);
      
      return { 
        message: `Successfully removed variant relationship between products ${productId} and ${variantProductId}.` 
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
   * Get all user's attributes for export selection
   */
  async getAttributesForExport(userId: number): Promise<any[]> {
    try {
      this.logger.log(`Fetching attributes for export for user: ${userId}`);

      const attributes = await this.prisma.attribute.findMany({
        where: {
          userId,
        },
        select: {
          id: true,
          name: true,
          type: true,
          defaultValue: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      return attributes;
    } catch (error) {
      this.logger.error(`Failed to fetch attributes for export: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to fetch attributes for export');
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
      const includeRelations = this.determineIncludeRelations(exportDto.attributes, exportDto.selectedAttributes);

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
        const transformedProduct = this.transformProductForExport(
          product, 
          exportDto.attributes, 
          variantData.get(product.id) || [],
          exportDto.selectedAttributes
        );
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
        customAttributes: exportDto.selectedAttributes,
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
  private determineIncludeRelations(attributes: ProductAttribute[], selectedAttributes?: AttributeSelectionDto[]): any {
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

    // Note: Product doesn't have a direct 'attribute' relation.
    // Attributes are accessed through the 'attributes' relation (ProductAttribute model).
    // This section is removed as it was causing the Prisma error.

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

    // Always include product attributes if we have custom attributes, customAttributes flag, or any attribute-related fields
    if ((selectedAttributes && selectedAttributes.length > 0) || 
        attributes.includes(ProductAttribute.CUSTOM_ATTRIBUTES) ||
        attributes.some(attr => ['attributeName', 'attributeType', 'attributeDefaultValue'].includes(attr))) {
      includeRelations.attributes = {
        select: {
          value: true,
          familyAttributeId: true,
          attribute: {
            select: {
              id: true,
              name: true,
              type: true,
              defaultValue: true,
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
  private transformProductForExport(
    product: any, 
    selectedAttributes: ProductAttribute[], 
    variants: any[], 
    customAttributes?: AttributeSelectionDto[]
  ): any {
    const exportRecord: any = {};

    (selectedAttributes || []).forEach(attr => {
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
        case ProductAttribute.CUSTOM_ATTRIBUTES:
          // Handle custom attributes - add individual attribute values
          if ((customAttributes && customAttributes.length > 0) && product.attributes) {
            (customAttributes || []).forEach(customAttr => {
              const productAttribute = product.attributes.find((pa: any) => 
                pa.attribute.id === customAttr.attributeId
              );
              const columnName = customAttr.columnName || customAttr.attributeName;
              const value = productAttribute?.value || productAttribute?.attribute?.defaultValue || '';
              const attributeType = productAttribute?.attribute?.type || '';
              
              // Format the value with type information
              const formattedValue = attributeType ? `${value}(${attributeType})` : value;
              exportRecord[columnName] = formattedValue;
            });
          }
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

  /**
   * Update attribute values for a specific product
   */
  async updateProductAttributeValues(
    productId: number,
    attributeValues: { attributeId: number; value?: string }[],
    userId: number
  ): Promise<ProductResponseDto> {
    try {
      this.logger.log(`Updating attribute values for product: ${productId} by user: ${userId}`);

      // Verify product ownership
      const product = await this.prisma.product.findFirst({
        where: { id: productId, userId },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${productId} not found`);
      }

      // Verify all attributes belong to the user
      const attributeIds = attributeValues.map(av => av.attributeId);
      const existingAttributes = await this.prisma.attribute.findMany({
        where: {
          id: { in: attributeIds },
          userId,
        },
      });

      if (existingAttributes.length !== attributeIds.length) {
        throw new BadRequestException('One or more attributes do not exist or do not belong to you');
      }

      // Update each attribute value using upsert
      for (const { attributeId, value } of attributeValues) {
        await this.prisma.productAttribute.upsert({
          where: {
            productId_attributeId: {
              productId,
              attributeId,
            },
          },
          update: {
            value: value || null,
          },
          create: {
            productId,
            attributeId,
            value: value || null,
          },
        });
      }

      // Recalculate product status after updating attribute values
      const status = await this.calculateProductStatus(productId);
      await this.prisma.product.update({ 
        where: { id: productId }, 
        data: { status } 
      });

      // Return updated product
      return this.findOne(productId, userId);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.handleDatabaseError(error, 'updateProductAttributeValues');
    }
  }

  /**
   * Get product attribute values
   */
  async getProductAttributeValues(
    productId: number,
    userId: number
  ): Promise<{ attributeId: number; attributeName: string; attributeType: string; value: string | null; defaultValue: string | null }[]> {
    try {
      this.logger.log(`Getting attribute values for product: ${productId} by user: ${userId}`);

      // Verify product ownership
      const product = await this.prisma.product.findFirst({
        where: { id: productId, userId },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${productId} not found`);
      }

      // Get all product attributes with their values
      const productAttributes = await this.prisma.productAttribute.findMany({
        where: { productId },
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
      });

      return productAttributes.map(pa => ({
        attributeId: pa.attributeId,
        attributeName: pa.attribute.name,
        attributeType: pa.attribute.type,
        value: pa.value,
        defaultValue: pa.attribute.defaultValue,
      }));
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.handleDatabaseError(error, 'getProductAttributeValues');
    }
  }

  /**
   * Update family attribute values for a specific product
   * Family attributes are attributes that belong to a product's family and need
   * to be stored with a reference to the familyAttributeId
   */
  async updateProductFamilyAttributeValues(
    productId: number,
    familyAttributeValues: { attributeId: number; value?: string }[],
    userId: number
  ): Promise<ProductResponseDto> {
    try {
      this.logger.log(`Updating family attribute values for product: ${productId} by user: ${userId}`);

      // Verify product ownership and get product with family info
      const product = await this.prisma.product.findFirst({
        where: { id: productId, userId },
        include: {
          family: {
            include: {
              familyAttributes: {
                include: {
                  attribute: true,
                },
              },
            },
          },
        },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${productId} not found`);
      }

      if (!product.family) {
        throw new BadRequestException('Product does not have a family assigned');
      }

      // Validate that all provided attributes belong to the product's family
      const familyAttributeMap = new Map(
        product.family.familyAttributes.map(fa => [fa.attribute.id, fa.id])
      );

      for (const { attributeId } of familyAttributeValues) {
        if (!familyAttributeMap.has(attributeId)) {
          throw new BadRequestException(`Attribute ${attributeId} is not part of the product's family`);
        }
      }

      // Update each family attribute value using upsert
      for (const { attributeId, value } of familyAttributeValues) {
        const familyAttributeId = familyAttributeMap.get(attributeId);
        
        await this.prisma.productAttribute.upsert({
          where: {
            productId_attributeId: {
              productId,
              attributeId,
            },
          },
          update: {
            value: value || null,
            familyAttributeId,
          },
          create: {
            productId,
            attributeId,
            familyAttributeId,
            value: value || null,
          },
        });
      }

      // Recalculate product status after updating family attribute values
      const status = await this.calculateProductStatus(productId);
      await this.prisma.product.update({ 
        where: { id: productId }, 
        data: { status } 
      });

      // Return updated product
      return this.findOne(productId, userId);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.handleDatabaseError(error, 'updateProductFamilyAttributeValues');
    }
  }

  /**
   * Get family attribute values for a specific product
   * Returns only the attributes that belong to the product's family
   */
  async getProductFamilyAttributeValues(
    productId: number,
    userId: number
  ): Promise<{ 
    familyAttributeId: number; 
    attributeId: number; 
    attributeName: string; 
    attributeType: string; 
    isRequired: boolean;
    value: string | null; 
    defaultValue: string | null;
  }[]> {
    try {
      this.logger.log(`Getting family attribute values for product: ${productId} by user: ${userId}`);

      // Verify product ownership and get product with family info
      const product = await this.prisma.product.findFirst({
        where: { id: productId, userId },
        include: {
          family: {
            include: {
              familyAttributes: {
                include: {
                  attribute: true,
                },
              },
            },
          },
          attributes: {
            where: {
              familyAttributeId: { not: null },
            },
            include: {
              attribute: true,
            },
          },
        },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${productId} not found`);
      }

      if (!product.family) {
        throw new BadRequestException('Product does not have a family assigned');
      }

      // Create a map of family attribute values
      const productAttributeValues = new Map(
        product.attributes.map(pa => [pa.familyAttributeId, pa.value])
      );

      // Return family attributes with their current values
      return product.family.familyAttributes.map(fa => ({
        familyAttributeId: fa.id,
        attributeId: fa.attribute.id,
        attributeName: fa.attribute.name,
        attributeType: fa.attribute.type,
        isRequired: fa.isRequired,
        value: productAttributeValues.get(fa.id) || null,
        defaultValue: fa.attribute.defaultValue,
      }));
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.handleDatabaseError(error, 'getProductFamilyAttributeValues');
    }
  }

  /**
   * Get available marketplace templates
   */
  async getMarketplaceTemplates() {
    try {
      const marketplaces = this.marketplaceTemplateService.getAvailableMarketplaces();
      return marketplaces.map(marketplace => ({
        marketplaceType: marketplace,
        displayName: this.getMarketplaceDisplayName(marketplace),
        template: this.marketplaceTemplateService.getMarketplaceTemplate(marketplace)
      }));
    } catch (error) {
      this.logger.error(`Failed to get marketplace templates: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to get marketplace templates');
    }
  }

  /**
   * Get template for specific marketplace
   */
  async getMarketplaceTemplate(marketplaceType: MarketplaceType) {
    try {
      const template = this.marketplaceTemplateService.getMarketplaceTemplate(marketplaceType);
      return {
        ...template,
        displayName: this.getMarketplaceDisplayName(marketplaceType),
        requiredFields: this.marketplaceTemplateService.getMarketplaceFields(marketplaceType),
        availableFields: Object.values(template.fieldMappings.map(f => ({
          field: f.ecommerceField,
          displayName: this.marketplaceTemplateService.getFieldDisplayName(f.ecommerceField),
          sourceField: f.sourceField,
          defaultValue: f.defaultValue
        })))
      };
    } catch (error) {
      this.logger.error(`Failed to get template for ${marketplaceType}: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to get template for ${marketplaceType}`);
    }
  }

  /**
   * Export products to marketplace format
   */
  async exportToMarketplace(exportDto: MarketplaceExportDto, userId: number): Promise<MarketplaceExportResponseDto> {
    try {
      return this.marketplaceExportService.exportToMarketplace(exportDto, userId);
    } catch (error) {
      this.logger.error(`Failed to export to marketplace: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get human-readable marketplace display names
   */
  private getMarketplaceDisplayName(marketplaceType: MarketplaceType): string {
    const displayNames: Record<MarketplaceType, string> = {
      [MarketplaceType.AMAZON]: 'Amazon Marketplace',
      [MarketplaceType.ALIEXPRESS]: 'AliExpress',
      [MarketplaceType.EBAY]: 'eBay',
      [MarketplaceType.ETSY]: 'Etsy',
      [MarketplaceType.SHOPIFY]: 'Shopify',
      [MarketplaceType.WALMART]: 'Walmart Marketplace',
      [MarketplaceType.FACEBOOK_MARKETPLACE]: 'Facebook Marketplace',
      [MarketplaceType.GOOGLE_SHOPPING]: 'Google Shopping',
      [MarketplaceType.CUSTOM]: 'Custom Template'
    };
    
    return displayNames[marketplaceType] || marketplaceType;
  }

  // CSV Import Scheduling Methods

  async scheduleCsvImport(scheduleDto: ScheduleImportDto, userId: number) {
    return this.importSchedulerService.scheduleImport(scheduleDto, userId);
  }

  async getImportJobs(userId: number, includeExecutions: boolean = true) {
    return this.importSchedulerService.getAllJobs(userId, includeExecutions);
  }

  async getImportJob(jobId: string, userId: number, includeExecutions: boolean = true): Promise<ImportJobResponseDto> {
    const job = await this.importSchedulerService.getJob(jobId, userId, includeExecutions);
    if (!job) {
      throw new NotFoundException(`Import job with ID ${jobId} not found`);
    }
    return job;
  }

  async updateScheduledImport(jobId: string, updateDto: UpdateScheduledImportDto, userId: number) {
    return this.importSchedulerService.updateScheduledImport(jobId, updateDto, userId);
  }

  async pauseImportJob(jobId: string, userId: number): Promise<boolean> {
    return this.importSchedulerService.pauseJob(jobId, userId);
  }

  async resumeImportJob(jobId: string, userId: number): Promise<boolean> {
    return this.importSchedulerService.resumeJob(jobId, userId);
  }

  async cancelImportJob(jobId: string, userId: number): Promise<boolean> {
    return this.importSchedulerService.cancelJob(jobId, userId);
  }

  async deleteImportJob(jobId: string, userId: number): Promise<boolean> {
    return this.importSchedulerService.deleteJob(jobId, userId);
  }

  async getExecutionLogs(jobId: string, userId: number, page: number = 1, limit: number = 20) {
    return this.importSchedulerService.getExecutionLogs(jobId, userId, page, limit);
  }

  async getExecutionStats(jobId: string, userId: number) {
    return this.importSchedulerService.getExecutionStats(jobId, userId);
  }
}
