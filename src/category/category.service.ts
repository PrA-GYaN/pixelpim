import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
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

  async create(createDto: CreateCategoryDto, userId: number): Promise<CategoryResponseDto> {
    try {
      this.logger.log(`Creating category '${createDto.name}' for user ${userId}`);

      if (createDto.parentCategoryId) {
        await this.validateParentCategory(createDto.parentCategoryId, userId);
        await this.validateNoCircularReference(createDto.parentCategoryId, userId);
      }

      const created = await this.prisma.category.create({
        data: { ...createDto, userId },
      });

      this.logger.log(`Created category ID=${created.id}`);

      return this.findOne(created.id, userId);
    } catch (error) {
      this.handleDatabaseError(error, 'create');
    }
  }

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

  async findOne(id: number, userId: number): Promise<CategoryResponseDto> {
    try {
      this.logger.log(`Fetching full tree for category ID=${id}`);

      const allCategories = await this.prisma.category.findMany({
        where: { userId },
        orderBy: { name: 'asc' },
      });

      const rootCategory = allCategories.find((cat) => cat.id === id);
      if (!rootCategory) {
        throw new NotFoundException(`Category with ID ${id} not found or unauthorized`);
      }

      return this.buildSubcategoryTree(rootCategory, allCategories);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`findOne error: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to fetch category');
    }
  }

  async update(id: number, dto: UpdateCategoryDto, userId: number): Promise<CategoryResponseDto> {
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

      await this.prisma.category.update({
        where: { id },
        data: dto,
      });

      return this.findOne(id, userId);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.handleDatabaseError(error, 'update');
    }
  }

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

  private buildSubcategoryTree(category: Category, allCategories: Category[]): CategoryResponseDto {
    const children = allCategories.filter((c) => c.parentCategoryId === category.id);

    return {
      id: category.id,
      name: category.name,
      description: category.description ?? undefined,
      parentCategoryId: category.parentCategoryId ?? undefined,
      userId: category.userId,
      createdAt: (category as any).createdAt,
      updatedAt: (category as any).updatedAt,
      parentCategory: undefined,
      subcategories: children.map((child) => this.buildSubcategoryTree(child, allCategories)),
    };
  }

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

  private async validateParentCategory(parentId: number, userId: number) {
    const exists = await this.prisma.category.findFirst({
      where: { id: parentId, userId },
    });
    if (!exists) {
      throw new BadRequestException('Parent category not found or unauthorized');
    }
  }

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

  private transformHierarchicalResponseWithCount(cat: any, isChild = false): any {
    const base = {
      id: cat.id,
      name: cat.name,
      description: cat.description ?? undefined,
      parentCategoryId: cat.parentCategoryId ?? undefined,
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
          createdAt: cat.createdAt,
          updatedAt: cat.updatedAt,
          parentCategory: cat.parentCategory ?? undefined,
        };
  }

  private transformCategoryResponse(cat: any): CategoryResponseDto {
    return {
      id: cat.id,
      name: cat.name,
      description: cat.description ?? undefined,
      parentCategoryId: cat.parentCategoryId ?? undefined,
      userId: cat.userId,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
      parentCategory: cat.parentCategory ?? undefined,
      subcategories: cat.subcategories?.map((sc: any) => ({
        id: sc.id,
        name: sc.name,
        description: sc.description ?? undefined,
        parentCategoryId: sc.parentCategoryId ?? undefined,
        userId: sc.userId,
        createdAt: sc.createdAt,
        updatedAt: sc.updatedAt,
        parentCategory: undefined,
        subcategories: [], // only one level
      })) ?? [],
    };
  }

  private handleDatabaseError(error: any, operation: string): never {
    if (error.code === 'P2003') {
      throw new BadRequestException('Foreign key constraint failed');
    }
    if (error.code === 'P2025') {
      throw new NotFoundException('Record not found');
    }
    this.logger.error(`${operation} database error: ${error.message}`, error.stack);
    throw new BadRequestException(`Failed to ${operation} category`);
  }
}
