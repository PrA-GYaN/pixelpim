import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';
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
}
