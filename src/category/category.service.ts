import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryResponseDto, CategoryTreeResponseDto } from './dto/category-response.dto';
import { PaginatedResponse, PaginationUtils } from '../common';
import type { Category } from '../../generated/prisma';

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(createCategoryDto: CreateCategoryDto, userId: number): Promise<CategoryResponseDto> {
    try {
      this.logger.log(`Creating category: ${createCategoryDto.name} for user: ${userId}`);

      // Validate parent category if provided
      if (createCategoryDto.parentCategoryId) {
        await this.validateParentCategory(createCategoryDto.parentCategoryId, userId);
        
        // Check for circular reference
        await this.validateNoCircularReference(createCategoryDto.parentCategoryId, userId);
      }

      const result = await this.prisma.category.create({
        data: {
          name: createCategoryDto.name,
          description: createCategoryDto.description,
          parentCategoryId: createCategoryDto.parentCategoryId,
          userId,
        },
        include: {
          parentCategory: true,
          subcategories: true,
        },
      });

      this.logger.log(`Successfully created category with ID: ${result.id}`);
      return this.transformCategoryForResponse(result);
    } catch (error) {
      this.handleDatabaseError(error, 'create');
    }
  }

  async findAll(userId: number, page: number = 1, limit: number = 10): Promise<PaginatedResponse<CategoryResponseDto>> {
    try {
      this.logger.log(`Fetching categories for user: ${userId}`);

      const whereCondition = { 
        userId,
        parentCategoryId: null // Only fetch root categories
      };

      const paginationOptions = PaginationUtils.createPrismaOptions(page, limit);

      const [categories, total] = await Promise.all([
        this.prisma.category.findMany({
          where: whereCondition,
          ...paginationOptions,
          include: {
            subcategories: {
              include: {
                subcategories: {
                  include: {
                    subcategories: {
                      include: {
                        subcategories: {
                          include: {
                            _count: {
                              select: {
                                products: true,
                              },
                            },
                          },
                        },
                        _count: {
                          select: {
                            products: true,
                          },
                        },
                      },
                    },
                    _count: {
                      select: {
                        products: true,
                      },
                    },
                  }
                },
                _count: {
                  select: {
                    products: true,
                  },
                },
              }
            },
            _count: {
              select: {
                products: true,
              },
            },
          },
          orderBy: { name: 'asc' },
        }),
        this.prisma.category.count({ where: whereCondition }),
      ]);

      const categoryResponseDtos = categories.map(category => this.transformCategoryForHierarchicalResponseWithCount(category));
      
      return PaginationUtils.createPaginatedResponse(categoryResponseDtos, total, page, limit);
    } catch (error) {
      this.logger.error(`Failed to fetch categories for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findOne(id: number, userId: number): Promise<CategoryResponseDto> {
  try {
    this.logger.log(`Fetching category: ${id} for user: ${userId}`);

    // Fetch all categories for this user (for recursive subcategories)
    const allCategories = await this.prisma.category.findMany({
      where: { userId },
      include: {
        products: {
          select: {
            id: true,
            name: true,
            sku: true,
            status: true,
            imageUrl: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });


    // Fetch the main category
    const category = await this.prisma.category.findFirst({
      where: { id, userId },
      include: {
        parentCategory: true,
        products: {
          select: {
            id: true,
            name: true,
            sku: true,
            status: true,
            imageUrl: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found or access denied`);
    }

    // Build recursive subcategory tree
    const buildSubcategoriesRecursively = (parentId: number): CategoryResponseDto[] => {
        return allCategories
          .filter(cat => cat.parentCategoryId === parentId)
          .map(sub => ({
            id: sub.id,
            name: sub.name,
            description: sub.description ?? undefined,
            parentCategoryId: sub.parentCategoryId ?? undefined,
            userId: sub.userId,
            createdAt: sub.createdAt,
            updatedAt: sub.updatedAt,
            subcategories: buildSubcategoriesRecursively(sub.id),
            products: sub.products?.map(product => ({
              id: product.id,
              name: product.name,
              sku: product.sku,
              status: product.status,
              imageUrl: product.imageUrl,
            })) || [],
          }));
      };


    // Return full category response
    return {
      id: category.id,
      name: category.name,
      description: category.description ?? undefined,
      parentCategoryId: category.parentCategoryId ?? undefined,
      userId: category.userId,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      parentCategory: category.parentCategory
        ? {
            id: category.parentCategory.id,
            name: category.parentCategory.name,
            description: category.parentCategory.description ?? undefined,
            parentCategoryId: category.parentCategory.parentCategoryId ?? undefined,
            userId: category.parentCategory.userId,
            createdAt: category.parentCategory.createdAt,
            updatedAt: category.parentCategory.updatedAt,
          }
        : undefined,
      subcategories: buildSubcategoriesRecursively(category.id),
      products: category.products.map(product => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        status: product.status,
        imageUrl: product.imageUrl,
      })),
    };
  } catch (error) {
    if (error instanceof NotFoundException) {
      throw error;
    }

    this.logger.error(`Failed to fetch category ${id}: ${error.message}`, error.stack);
    throw new BadRequestException('Failed to fetch category');
  }
}



  async update(id: number, updateCategoryDto: UpdateCategoryDto, userId: number): Promise<CategoryResponseDto> {
    try {
      // Verify ownership first
      await this.findOne(id, userId);

      this.logger.log(`Updating category: ${id} for user: ${userId}`);

      // Validate parent category if being updated
      if (updateCategoryDto.parentCategoryId !== undefined) {
        if (updateCategoryDto.parentCategoryId === id) {
          throw new BadRequestException('Category cannot be its own parent');
        }

        if (updateCategoryDto.parentCategoryId) {
          await this.validateParentCategory(updateCategoryDto.parentCategoryId, userId);
          
          // Check for circular reference
          await this.validateNoCircularReference(updateCategoryDto.parentCategoryId, userId, id);
        }
      }

      // Prepare update data
      const updateData: any = {};

      if (updateCategoryDto.name !== undefined) {
        updateData.name = updateCategoryDto.name;
      }

      if (updateCategoryDto.description !== undefined) {
        updateData.description = updateCategoryDto.description;
      }

      if (updateCategoryDto.parentCategoryId !== undefined) {
        updateData.parentCategoryId = updateCategoryDto.parentCategoryId;
      }

      const result = await this.prisma.category.update({
        where: { id },
        data: updateData,
        include: {
          parentCategory: true,
          subcategories: true,
        },
      });

      this.logger.log(`Successfully updated category with ID: ${id}`);
      return this.transformCategoryForResponse(result);
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

      // Check if category has subcategories
      const subcategoriesCount = await this.prisma.category.count({
        where: {
          parentCategoryId: id,
        },
      });

      if (subcategoriesCount > 0) {
        throw new BadRequestException('Cannot delete category that has subcategories. Please delete or move subcategories first.');
      }

      this.logger.log(`Deleting category: ${id} for user: ${userId}`);

      await this.prisma.category.delete({
        where: { id },
      });

      this.logger.log(`Successfully deleted category with ID: ${id}`);
      return { message: 'Category successfully deleted' };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to delete category ${id}: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to delete category');
    }
  }

  async getCategoryTree(userId: number): Promise<CategoryTreeResponseDto[]> {
    try {
      const categories = await this.prisma.category.findMany({
        where: { userId },
        include: {
          subcategories: {
            include: {
              subcategories: {
                include: {
                  subcategories: true, // Support up to 3 levels deep
                },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      // Get root categories (no parent)
      const rootCategories = categories.filter(cat => !cat.parentCategoryId);

      return rootCategories.map(category => this.buildCategoryTree(category, 0, []));
    } catch (error) {
      this.logger.error(`Failed to build category tree for user ${userId}: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to fetch category tree');
    }
  }

  async getSubcategories(id: number, userId: number, page: number = 1, limit: number = 10): Promise<PaginatedResponse<CategoryResponseDto>> {
    try {
      // Verify ownership of parent category
      await this.findOne(id, userId);

      const whereCondition = {
        parentCategoryId: id,
        userId,
      };

      const paginationOptions = PaginationUtils.createPrismaOptions(page, limit);

      const [subcategories, total] = await Promise.all([
        this.prisma.category.findMany({
          where: whereCondition,
          ...paginationOptions,
          include: {
            parentCategory: true,
            subcategories: true,
          },
          orderBy: { name: 'asc' },
        }),
        this.prisma.category.count({ where: whereCondition }),
      ]);

      const categoryResponseDtos = subcategories.map(category => this.transformCategoryForResponse(category));
      
      return PaginationUtils.createPaginatedResponse(categoryResponseDtos, total, page, limit);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to fetch subcategories for category ${id}: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to fetch subcategories');
    }
  }

  // Helper methods
  private sortCategoriesHierarchically(categories: any[]): any[] {
    const categoryMap = new Map();
    const rootCategories: any[] = [];
    const result: any[] = [];

    // Create a map for quick lookup
    categories.forEach(cat => categoryMap.set(cat.id, cat));

    // Find root categories (no parent)
    categories.forEach(cat => {
      if (!cat.parentCategoryId) {
        rootCategories.push(cat);
      }
    });

    // Sort root categories by name
    rootCategories.sort((a, b) => a.name.localeCompare(b.name));

    // Recursively add categories in hierarchical order
    const addCategoryAndChildren = (category: any, level = 0) => {
      result.push({ ...category, level });

      // Find and sort children
      const children = categories
        .filter(cat => cat.parentCategoryId === category.id)
        .sort((a, b) => a.name.localeCompare(b.name));

      children.forEach(child => addCategoryAndChildren(child, level + 1));
    };

    // Add all root categories and their children
    rootCategories.forEach(rootCat => addCategoryAndChildren(rootCat));

    return result;
  }

  private async validateParentCategory(parentId: number, userId: number): Promise<void> {
    const parentCategory = await this.prisma.category.findFirst({
      where: {
        id: parentId,
        userId,
      },
    });

    if (!parentCategory) {
      throw new BadRequestException('Parent category not found or does not belong to you');
    }
  }

  private async validateNoCircularReference(parentId: number, userId: number, excludeId?: number): Promise<void> {
    // Get all descendants of the potential parent
    const descendants = await this.getAllDescendants(parentId, userId);
    
    if (excludeId && descendants.some(desc => desc.id === excludeId)) {
      throw new BadRequestException('Cannot create circular reference in category hierarchy');
    }
  }

  private async getAllDescendants(categoryId: number, userId: number): Promise<Category[]> {
    const descendants: Category[] = [];
    const toProcess = [categoryId];

    while (toProcess.length > 0) {
      const currentId = toProcess.shift()!;
      const children = await this.prisma.category.findMany({
        where: {
          parentCategoryId: currentId,
          userId,
        },
      });

      descendants.push(...children);
      toProcess.push(...children.map(child => child.id));
    }

    return descendants;
  }

  private buildCategoryTree(category: any, level: number, path: string[]): CategoryTreeResponseDto {
    const currentPath = [...path, category.name];

    return {
      id: category.id,
      name: category.name,
      description: category.description,
      level,
      path: currentPath,
      subcategories: category.subcategories?.map((sub: any) => 
        this.buildCategoryTree(sub, level + 1, currentPath)
      ) || [],
    };
  }

  private transformCategoryForHierarchicalResponseWithCount(category: any, isSubcategory = false): any {
    const baseResponse = {
      id: category.id,
      name: category.name,
      description: category.description,
      parentCategoryId: category.parentCategoryId,
      productCount: category._count?.products || 0, // Include product count for all levels
      subcategories: category.subcategories?.map((sub: any) => 
        this.transformCategoryForHierarchicalResponseWithCount(sub, true)
      ) || [],
    };

    // Only include userId, createdAt, updatedAt for root categories
    if (!isSubcategory) {
      return {
        ...baseResponse,
        userId: category.userId,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      };
    }

    return baseResponse;
  }

  private transformCategoryForHierarchicalResponse(category: any, isSubcategory = false): any {
    const baseResponse = {
      id: category.id,
      name: category.name,
      description: category.description,
      parentCategoryId: category.parentCategoryId,
      subcategories: category.subcategories?.map((sub: any) => 
        this.transformCategoryForHierarchicalResponse(sub, true)
      ) || [],
    };

    // Only include userId, createdAt, updatedAt for root categories
    if (!isSubcategory) {
      return {
        ...baseResponse,
        userId: category.userId,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      };
    }

    return baseResponse;
  }

  private transformCategoryForResponseWithProducts(category: any): CategoryResponseDto {
    return {
      id: category.id,
      name: category.name,
      description: category.description,
      parentCategoryId: category.parentCategoryId,
      userId: category.userId,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      parentCategory: category.parentCategory ? {
        id: category.parentCategory.id,
        name: category.parentCategory.name,
        description: category.parentCategory.description,
        parentCategoryId: category.parentCategory.parentCategoryId,
        userId: category.parentCategory.userId,
        createdAt: category.parentCategory.createdAt,
        updatedAt: category.parentCategory.updatedAt,
      } : undefined,
      subcategories: category.subcategories?.map((sub: any) => ({
        id: sub.id,
        name: sub.name,
        description: sub.description,
        parentCategoryId: sub.parentCategoryId,
        userId: sub.userId,
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt,
        productCount: sub._count?.products || 0,
        subcategories: sub.subcategories?.map((subSub: any) => ({
          id: subSub.id,
          name: subSub.name,
          description: subSub.description,
          parentCategoryId: subSub.parentCategoryId,
          userId: subSub.userId,
          createdAt: subSub.createdAt,
          updatedAt: subSub.updatedAt,
          productCount: subSub._count?.products || 0,
        })) || [],
      })) || [],
      products: category.products?.map((product: any) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        status: product.status,
        imageUrl: product.imageUrl,
      })) || [],
    };
  }

  private transformCategoryForResponse(category: any): CategoryResponseDto {
    return {
      id: category.id,
      name: category.name,
      description: category.description,
      parentCategoryId: category.parentCategoryId,
      userId: category.userId,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      parentCategory: category.parentCategory ? {
        id: category.parentCategory.id,
        name: category.parentCategory.name,
        description: category.parentCategory.description,
        parentCategoryId: category.parentCategory.parentCategoryId,
        userId: category.parentCategory.userId,
        createdAt: category.parentCategory.createdAt,
        updatedAt: category.parentCategory.updatedAt,
      } : undefined,
      subcategories: category.subcategories?.map((sub: any) => ({
        id: sub.id,
        name: sub.name,
        description: sub.description,
        parentCategoryId: sub.parentCategoryId,
        userId: sub.userId,
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt,
      })) || [],
    };
  }

  private handleDatabaseError(error: any, operation: string): never {
    this.logger.error(`Failed to ${operation} category: ${error.message}`, error.stack);

    // Handle Prisma-specific errors
    if (error.code === 'P2002') {
      throw new ConflictException('A category with this name already exists');
    }

    if (error.code === 'P2000') {
      throw new BadRequestException('The provided value is too long');
    }

    if (error.code === 'P2025') {
      throw new NotFoundException('Category not found');
    }

    // Re-throw known HTTP exceptions
    if (error.status) {
      throw error;
    }

    // Default error
    throw new BadRequestException(`Failed to ${operation} category`);
  }
}
