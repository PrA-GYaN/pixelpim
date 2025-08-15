import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { CreateProductVariantDto, RemoveProductVariantDto, ProductVariantResponseDto } from './dto/product-variant.dto';
import { ExportProductDto, ExportProductResponseDto, ProductAttribute, ExportFormat } from './dto/export-product.dto';
import { PaginatedResponse, PaginationUtils } from '../common';
import type { Product } from '../../generated/prisma';

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

      // Validate attribute if provided
      if (createProductDto.attributeId) {
        await this.validateAttribute(createProductDto.attributeId, userId);
      }

      // Validate attribute group if provided
      if (createProductDto.attributeGroupId) {
        await this.validateAttributeGroup(createProductDto.attributeGroupId, userId);
      }

      // Validate family if provided
      if (createProductDto.familyId) {
        await this.validateFamily(createProductDto.familyId, userId);
      }

      const result = await this.prisma.product.create({
        data: {
          name: createProductDto.name,
          sku: createProductDto.sku,
          productLink: createProductDto.productLink,
          imageUrl: createProductDto.imageUrl,
          status: createProductDto.status || 'incomplete',
          categoryId: createProductDto.categoryId,
          attributeId: createProductDto.attributeId,
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
          attribute: {
            select: {
              id: true,
              name: true,
              type: true,
              defaultValue: true,
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
            },
          },
        },
      });

      this.logger.log(`Successfully created product with ID: ${result.id}`);
      return this.transformProductForResponse(result);
    } catch (error) {
      this.handleDatabaseError(error, 'create');
    }
  }

  async findAll(
    userId: number, 
    status?: string, 
    categoryId?: number, 
    attributeId?: number, 
    attributeGroupId?: number, 
    familyId?: number,
    page: number = 1,
    limit: number = 10
  ): Promise<PaginatedResponse<ProductResponseDto>> {
    try {
      this.logger.log(`Fetching products for user: ${userId}`);

      const whereCondition: any = { userId };

      if (status) {
        whereCondition.status = status;
      }

      if (categoryId) {
        whereCondition.categoryId = categoryId;
      }

      if (attributeId) {
        whereCondition.attributeId = attributeId;
      }

      if (attributeGroupId) {
        whereCondition.attributeGroupId = attributeGroupId;
      }

      if (familyId) {
        whereCondition.familyId = familyId;
      }

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
            attribute: {
              select: {
                id: true,
                name: true,
                type: true,
                defaultValue: true,
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
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.product.count({ where: whereCondition }),
      ]);

      const productResponseDtos = products.map(product => this.transformProductForResponse(product));
      
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
          attribute: {
            select: {
              id: true,
              name: true,
              type: true,
              defaultValue: true,
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
            },
          },
        },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${id} not found or access denied`);
      }

      return this.transformProductForResponse(product);
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
          attribute: {
            select: {
              id: true,
              name: true,
              type: true,
              defaultValue: true,
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
            },
          },
        },
      });

      if (!product) {
        throw new NotFoundException(`Product with SKU ${sku} not found or access denied`);
      }

      return this.transformProductForResponse(product);
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

      // Validate category if being updated
      if (updateProductDto.categoryId !== undefined && updateProductDto.categoryId !== null) {
        await this.validateCategory(updateProductDto.categoryId, userId);
      }

      // Validate attribute if being updated
      if (updateProductDto.attributeId !== undefined && updateProductDto.attributeId !== null) {
        await this.validateAttribute(updateProductDto.attributeId, userId);
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

      if (updateProductDto.status !== undefined) {
        updateData.status = updateProductDto.status;
      }

      if (updateProductDto.categoryId !== undefined) {
        updateData.categoryId = updateProductDto.categoryId;
      }

      if (updateProductDto.attributeId !== undefined) {
        updateData.attributeId = updateProductDto.attributeId;
      }

      if (updateProductDto.attributeGroupId !== undefined) {
        updateData.attributeGroupId = updateProductDto.attributeGroupId;
      }

      if (updateProductDto.familyId !== undefined) {
        updateData.familyId = updateProductDto.familyId;
      }

      const result = await this.prisma.product.update({
        where: { id },
        data: updateData,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          attribute: {
            select: {
              id: true,
              name: true,
              type: true,
              defaultValue: true,
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
            },
          },
        },
      });

      this.logger.log(`Successfully updated product with ID: ${id}`);
      return this.transformProductForResponse(result);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.handleDatabaseError(error, 'update');
    }
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

  async getProductsByCategory(categoryId: number, userId: number, page: number = 1, limit: number = 10): Promise<PaginatedResponse<ProductResponseDto>> {
    try {
      // Verify category ownership
      await this.validateCategory(categoryId, userId);

      this.logger.log(`Fetching products for category: ${categoryId}, user: ${userId}`);

      const whereCondition = {
        categoryId,
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
            attribute: {
              select: {
                id: true,
                name: true,
                type: true,
                defaultValue: true,
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
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.product.count({ where: whereCondition }),
      ]);

      const productResponseDtos = products.map(product => this.transformProductForResponse(product));
      
      return PaginationUtils.createPaginatedResponse(productResponseDtos, total, page, limit);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to fetch products for category ${categoryId}: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to fetch products');
    }
  }

  async getProductsByAttribute(attributeId: number, userId: number, page: number = 1, limit: number = 10): Promise<PaginatedResponse<ProductResponseDto>> {
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
            attribute: {
              select: {
                id: true,
                name: true,
                type: true,
                defaultValue: true,
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
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.product.count({ where: whereCondition }),
      ]);

      const productResponseDtos = products.map(product => this.transformProductForResponse(product));
      
      return PaginationUtils.createPaginatedResponse(productResponseDtos, total, page, limit);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to fetch products for attribute ${attributeId}: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to fetch products');
    }
  }

  async getProductsByAttributeGroup(attributeGroupId: number, userId: number, page: number = 1, limit: number = 10): Promise<PaginatedResponse<ProductResponseDto>> {
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
            attribute: {
              select: {
                id: true,
                name: true,
                type: true,
                defaultValue: true,
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
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.product.count({ where: whereCondition }),
      ]);

      const productResponseDtos = products.map(product => this.transformProductForResponse(product));
      
      return PaginationUtils.createPaginatedResponse(productResponseDtos, total, page, limit);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to fetch products for attribute group ${attributeGroupId}: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to fetch products');
    }
  }

  async getProductsByFamily(familyId: number, userId: number, page: number = 1, limit: number = 10): Promise<PaginatedResponse<ProductResponseDto>> {
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
            attribute: {
              select: {
                id: true,
                name: true,
                type: true,
                defaultValue: true,
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
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.product.count({ where: whereCondition }),
      ]);

      const productResponseDtos = products.map(product => this.transformProductForResponse(product));
      
      return PaginationUtils.createPaginatedResponse(productResponseDtos, total, page, limit);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to fetch products for family ${familyId}: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to fetch products');
    }
  }

  // Helper methods
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
    const attribute = await this.prisma.attribute.findFirst({
      where: {
        id: attributeId,
        userId,
      },
    });

    if (!attribute) {
      throw new BadRequestException('Attribute not found or does not belong to you');
    }
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

  private transformProductForResponse(product: any): ProductResponseDto {
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

    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      productLink: product.productLink,
      imageUrl: product.imageUrl,
      status: product.status,
      categoryId: product.categoryId,
      attributeId: product.attributeId,
      attributeGroupId: product.attributeGroupId,
      familyId: product.familyId,
      userId: product.userId,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      category: product.category ? {
        id: product.category.id,
        name: product.category.name,
        description: product.category.description,
      } : undefined,
      attribute: product.attribute ? {
        id: product.attribute.id,
        name: product.attribute.name,
        type: product.attribute.type,
        defaultValue: product.attribute.defaultValue,
      } : undefined,
      attributeGroup: product.attributeGroup ? {
        id: product.attributeGroup.id,
        name: product.attributeGroup.name,
        description: product.attributeGroup.description,
      } : undefined,
      family: product.family ? {
        id: product.family.id,
        name: product.family.name,
      } : undefined,
      variants: variants.length > 0 ? variants.map(variant => ({
        id: variant.id,
        name: variant.name,
        sku: variant.sku,
        imageUrl: variant.imageUrl,
        status: variant.status,
      })) : undefined,
      totalVariants: variants.length,
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

  async createVariant(createVariantDto: CreateProductVariantDto, userId: number): Promise<{ message: string; created: number }> {
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

      this.logger.log(`Created ${result.count} variant relationships for product ${productId} and its variant group`);
      return { message: `Successfully added ${result.count} variant relationships to create a fully connected variant group`, created: result.count };
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

  async getProductVariants(productId: number, userId: number): Promise<ProductVariantResponseDto[]> {
    try {
      // Verify the product exists and belongs to the user
      const product = await this.prisma.product.findFirst({
        where: { id: productId, userId },
      });

      if (!product) {
        throw new BadRequestException('Product not found or does not belong to you');
      }

      // Get all variants where this product is either productA or productB
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
              imageUrl: true,
              status: true,
            },
          },
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
      });

      // Transform the response to handle null/undefined differences
      return variants.map(variant => ({
        ...variant,
        productA: {
          ...variant.productA,
          imageUrl: variant.productA.imageUrl ?? undefined,
        },
        productB: {
          ...variant.productB,
          imageUrl: variant.productB.imageUrl ?? undefined,
        },
      })) as ProductVariantResponseDto[];
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
}
