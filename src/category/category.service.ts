import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryResponseDto, CategoryTreeResponseDto } from './dto/category-response.dto';
import { PaginatedResponse, PaginationUtils } from '../common';
import type { Category } from '../../generated/prisma';

// import {
//   Injectable,
//   NotFoundException,
//   ConflictException,
//   BadRequestException,
//   Logger,
// } from '@nestjs/common';
// import { Category } from '@prisma/client';
// import { PrismaService } from '../prisma/prisma.service';
// import { CreateCategoryDto } from './dto/create-category.dto';
// import { UpdateCategoryDto } from './dto/update-category.dto';
// import {
//   CategoryResponseDto,
//   CategoryTreeResponseDto,
// } from './dto/category-response.dto';
// import { PaginatedResponse, PaginationUtils } from '../common';

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Create a category */
  async create(
    createDto: CreateCategoryDto,
    userId: number,
  ): Promise<CategoryResponseDto> {
    try {
      this.logger.log(`Creating category '${createDto.name}' for user ${userId}`);

      if (createDto.parentCategoryId) {
        await this.validateParentCategory(createDto.parentCategoryId, userId);
        await this.validateNoCircularReference(createDto.parentCategoryId, userId);
      }

      const result = await this.prisma.category.create({
        data: { ...createDto, userId },
        include: { parentCategory: true, subcategories: true },
      });

      this.logger.log(`Created category ID=${result.id}`);
      return this.transformCategoryResponse(result);
    } catch (error) {
      this.handleDatabaseError(error, 'create');
    }
  }

  /** Fetch root categories with pagination, including counts */
  async findAll(
    userId: number,
    page = 1,
    limit = 10,
  ): Promise<PaginatedResponse<CategoryResponseDto>> {
    try {
      this.logger.log(`Fetching root categories for user ${userId}`);

      const where = { userId, parentCategoryId: null };
      const options = PaginationUtils.createPrismaOptions(page, limit);

      const [categories, total] = await Promise.all([
        this.prisma.category.findMany({
          where,
          ...options,
          include: {
            subcategories: {
              include: {
                subcategories: {
                  include: { subcategories: true },
                },
              },
            },
            _count: { select: { products: true } },
          },
          orderBy: { name: 'asc' },
        }),
        this.prisma.category.count({ where }),
      ]);

      const data = categories.map((cat) => this.transformHierarchicalResponseWithCount(cat));
      return PaginationUtils.createPaginatedResponse(data, total, page, limit);
    } catch (error) {
      this.logger.error(`findAll error: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to fetch categories');
    }
  }

  /** Fetch full tree under specific category, plus its products */
  async findOne(
    id: number,
    userId: number,
  ): Promise<CategoryResponseDto> {
    try {
      this.logger.log(`Fetching full tree for category ID=${id}`);

      const category = await this.prisma.category.findUnique({
        where: { id, userId },
        include: {
          parentCategory: true,
          subcategories: true,
        },
      });
      if (!category) {
        throw new NotFoundException(`Category with ID ${id} not found or unauthorized`);
      }
      return this.transformCategoryResponse(category);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`findOne error: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to fetch category');
    }
  }

  /** Update category metadata or parent */
  async update(
    id: number,
    dto: UpdateCategoryDto,
    userId: number,
  ): Promise<CategoryResponseDto> {
    try {
      await this.findOne(id, userId);
      this.logger.log(`Updating category ID=${id}`);

      if (dto.parentCategoryId !== undefined) {
        if (dto.parentCategoryId === id) {
          throw new BadRequestException('Cannot set category as its own parent');
        }
        if (dto.parentCategoryId) {
          await this.validateParentCategory(dto.parentCategoryId, userId);
          await this.validateNoCircularReference(dto.parentCategoryId, userId, id);
        }
      }

      const updated = await this.prisma.category.update({
        where: { id },
        data: dto,
        include: { parentCategory: true, subcategories: true },
      });

      this.logger.log(`Updated category ID=${id}`);
      return this.transformCategoryResponse(updated);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.handleDatabaseError(error, 'update');
    }
  }

  /** Delete category if it has no subcategories */
  async remove(id: number, userId: number): Promise<{ message: string }> {
    try {
      await this.findOne(id, userId);

      const childCount = await this.prisma.category.count({
        where: { parentCategoryId: id },
      });

      if (childCount > 0) {
        throw new BadRequestException('Cannot delete category with subcategories');
      }

      await this.prisma.category.delete({ where: { id } });
      this.logger.log(`Deleted category ID=${id}`);
      return { message: 'Category successfully deleted' };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`remove error: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to delete category');
    }
  }

  /** Get full nested tree of all user categories */
  async getCategoryTree(userId: number): Promise<CategoryTreeResponseDto[]> {
    try {
      this.logger.log(`Fetching full category tree for user ${userId}`);

      const allCategories = await this.prisma.category.findMany({
        where: { userId },
        orderBy: { name: 'asc' },
      });

      const roots = allCategories.filter((c) => !c.parentCategoryId);
      return roots.map((root) => this.buildCategoryTree(root, 0, [], allCategories));
    } catch (error) {
      this.logger.error(`getCategoryTree error: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to fetch category tree');
    }
  }

  /** Get subcategories under specific category (paginated) */
  async getSubcategories(
    id: number,
    userId: number,
    page = 1,
    limit = 10,
  ): Promise<PaginatedResponse<CategoryResponseDto>> {
    try {
      await this.findOne(id, userId);

      const where = { parentCategoryId: id, userId };
      const options = PaginationUtils.createPrismaOptions(page, limit);

      const [subs, total] = await Promise.all([
        this.prisma.category.findMany({
          where,
          ...options,
          include: { parentCategory: true, subcategories: true },
          orderBy: { name: 'asc' },
        }),
        this.prisma.category.count({ where }),
      ]);

      const data = subs.map((sub) => this.transformCategoryResponse(sub));
      return PaginationUtils.createPaginatedResponse(data, total, page, limit);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`getSubcategories error: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to fetch subcategories');
    }
  }

  /** Recursive helper to build tree in-memory */
  private buildCategoryTree(
    category: Category,
    level: number,
    path: string[],
    all: Category[],
  ): CategoryTreeResponseDto {
    const currentPath = [...path, category.name];
    const children = all.filter((c) => c.parentCategoryId === category.id);

    return {
      id: category.id,
      name: category.name,
      description: category.description ?? undefined,
      level,
      path: currentPath,
      subcategories: children.map((child) =>
        this.buildCategoryTree(child, level + 1, currentPath, all),
      ),
    };
  }

  /** Ensure parent category exists and belongs to user */
  private async validateParentCategory(parentId: number, userId: number) {
    const exists = await this.prisma.category.findFirst({
      where: { id: parentId, userId },
    });
    if (!exists) {
      throw new BadRequestException('Parent category not found or unauthorized');
    }
  }

  /** Prevent cycles when assigning parent */
  private async validateNoCircularReference(
    parentId: number,
    userId: number,
    excludeId?: number,
  ) {
    const visited = new Set<number>();
    const queue = [parentId];

    while (queue.length) {
      const current = queue.shift()!;
      const children = await this.prisma.category.findMany({
        where: { parentCategoryId: current, userId },
        select: { id: true },
      });
      for (const child of children) {
        if (excludeId !== undefined && child.id === excludeId) {
          throw new BadRequestException('Circular reference detected');
        }
        if (!visited.has(child.id)) {
          visited.add(child.id);
          queue.push(child.id);
        }
      }
    }
  }

  /** Convert a flat category (with relations) into response DTO */
  private transformCategoryResponse(cat: any): CategoryResponseDto {
    return {
      id: cat.id,
      name: cat.name,
      description: cat.description ?? null,
      parentCategoryId: cat.parentCategoryId,
      userId: cat.userId,
      createdAt: (cat as any).createdAt,
      updatedAt: (cat as any).updatedAt,
      parentCategory: cat.parentCategory
        ? {
            id: cat.parentCategory.id,
            name: cat.parentCategory.name,
            description: cat.parentCategory.description ?? null,
            parentCategoryId: cat.parentCategory.parentCategoryId,
            userId: cat.parentCategory.userId,
            createdAt: (cat.parentCategory as any).createdAt,
            updatedAt: (cat.parentCategory as any).updatedAt,
          }
        : undefined,
      subcategories: cat.subcategories?.map((sub: any) => ({
        id: sub.id,
        name: sub.name,
        description: sub.description ?? null,
        parentCategoryId: sub.parentCategoryId,
        userId: sub.userId,
        createdAt: (sub as any).createdAt,
        updatedAt: (sub as any).updatedAt,
      })) ?? [],
    };
  }

  /** Transform flat category with product counts into hierarchical DTO with counts */
  private transformHierarchicalResponseWithCount(cat: any, isChild = false): any {
    const base = {
      id: cat.id,
      name: cat.name,
      description: cat.description ?? null,
      parentCategoryId: cat.parentCategoryId,
      productCount: cat._count?.products ?? 0,
      subcategories: cat.subcategories?.map((s: any) =>
        this.transformHierarchicalResponseWithCount(s, true),
      ) ?? [],
    };
    return isChild
      ? base
      : {
          ...base,
          userId: cat.userId,
          createdAt: (cat as any).createdAt,
          updatedAt: (cat as any).updatedAt,
        };
  }

  /** Handle Prisma errors */
  private handleDatabaseError(error: any, operation: string): never {
    this.logger.error(`DB error during '${operation}': ${error.message}`, error.stack);
    if (error.code === 'P2002') {
      throw new ConflictException('Duplicate category name');
    }
    if (error.code === 'P2000') {
      throw new BadRequestException('Value too long');
    }
    if (error.code === 'P2025') {
      throw new NotFoundException('Category not found');
    }
    if (error.status) {
      throw error;
    }
    throw new BadRequestException(`Failed to ${operation} category`);
  }
}

