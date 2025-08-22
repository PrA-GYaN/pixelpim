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
import {
  CategoryResponseDto,
  CategoryTreeResponseDto,
} from './dto/category-response.dto';
import { PaginatedResponse, PaginationUtils } from '../common';
import type { Category } from '../../generated/prisma';


// Assuming imports remain the same
// import {
//   Injectable,
//   NotFoundException,
//   ConflictException,
//   ForbiddenException,
//   BadRequestException,
//   Logger,
// } from '@nestjs/common';
// import { PrismaService } from '../prisma/prisma.service';
// import { CreateCategoryDto } from './dto/create-category.dto';
// import { UpdateCategoryDto } from './dto/update-category.dto';
// import {
//   CategoryResponseDto,
//   CategoryTreeResponseDto,
// } from './dto/category-response.dto';
// import { PaginatedResponse, PaginationUtils } from '../common';
// import type { Category, Product } from '@prisma/client'; // Adjust if needed

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    createDto: CreateCategoryDto,
    userId: number,
  ): Promise<CategoryResponseDto> {
    try {
      this.logger.log(`Creating category '${createDto.name}' for user ${userId}`);

      const { parentCategoryId, name, description } = createDto;

      if (parentCategoryId != undefined) {
        await this.validateParentCategory(parentCategoryId, userId);
        await this.validateNoCircularReference(parentCategoryId, userId, null);
      }

      const created = await this.prisma.category.create({
        data: {
          name,
          description: description ?? undefined,
          parentCategoryId: parentCategoryId ?? undefined,
          userId,
        },
      });

      this.logger.log(`Created category ID=${created.id}`);
      return await this.findOne(created.id, userId);
    } catch (error) {
      return this.handleDatabaseError(error, 'create');
    }
  }

  async findAll(userId: number): Promise<CategoryTreeResponseDto[]> {
    try {
      this.logger.log(`Fetching full category tree with products for user ${userId}`);

      const all = await this.prisma.category.findMany({
        where: { userId },
        include: { products: true },
        orderBy: { name: 'asc' },
      });

      const roots = all.filter((c) => !c.parentCategoryId);

      const buildTree = (
        cat: typeof all[number],
        level = 0,
        path: string[] = [],
      ): CategoryTreeResponseDto => {
        const newPath = [...path, cat.name];
        const children = all.filter((c) => c.parentCategoryId === cat.id);
        return {
          id: cat.id,
          name: cat.name,
          description: cat.description ?? undefined,
          level,
          path: newPath,
          products: cat.products.map((p) => ({
            id: p.id,
            name: p.name,
            status: (p as any).status,
            sku: p.sku,
            imageUrl: p.imageUrl ?? undefined,
          })),
          subcategories: children.map((child) =>
            buildTree(child, level + 1, newPath),
          ),
        };
      };

      return roots.map((r) => buildTree(r));
    } catch (error) {
      this.logger.error(`findAll error: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to fetch full category tree');
    }
  }

  async findOne(id: number, userId: number): Promise<CategoryResponseDto> {
    try {
      this.logger.log(`Fetching category subtree for ID=${id}, user ${userId}`);

      const all = await this.prisma.category.findMany({
        where: { userId },
        orderBy: { name: 'asc' },
      });

      const root = all.find((c) => c.id === id);
      if (!root) {
        throw new NotFoundException(`Category ID=${id} not found or unauthorized`);
      }

      return this.buildSubcategoryTree(root, all);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`findOne error: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to fetch category');
    }
  }

  async update(
    id: number,
    dto: UpdateCategoryDto,
    userId: number,
  ): Promise<CategoryResponseDto> {
    try {
      await this.findOne(id, userId);
      this.logger.log(`Updating category ID=${id}`);

      if (dto.parentCategoryId != undefined) {
        if (dto.parentCategoryId === id) {
          throw new BadRequestException('Cannot set itself as parent');
        }
        if (dto.parentCategoryId != null) {
          await this.validateParentCategory(dto.parentCategoryId, userId);
          await this.validateNoCircularReference(dto.parentCategoryId, userId, id);
        }
      }

      await this.prisma.category.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          description:
            dto.description === null
              ? undefined
              : dto.description ?? undefined,
          parentCategoryId: dto.parentCategoryId ?? undefined,
        },
      });

      return this.findOne(id, userId);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      return this.handleDatabaseError(error, 'update');
    }
  }

  async remove(id: number, userId: number): Promise<{ message: string }> {
    try {
      await this.findOne(id, userId);

      const count = await this.prisma.category.count({
        where: { parentCategoryId: id },
      });
      if (count > 0) {
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
      this.logger.log(`Fetching category tree (no products) for user ${userId}`);
      const all = await this.prisma.category.findMany({
        where: { userId },
        orderBy: { name: 'asc' },
      });

      const roots = all.filter((c) => !c.parentCategoryId);
      return roots.map((root) =>
        this.buildCategoryTree(root, 0, [], all),
      );
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

      const data = subs.map((cat) => this.transformCategoryResponse(cat));
      return PaginationUtils.createPaginatedResponse(data, total, page, limit);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`getSubcategories error: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to fetch subcategories');
    }
  }

  // ============================
  private buildSubcategoryTree(
    category: Category,
    all: Category[],
  ): CategoryResponseDto {
    const children = all.filter((c) => c.parentCategoryId === category.id);
    return {
      id: category.id,
      name: category.name,
      description: category.description ?? undefined,
      parentCategoryId: category.parentCategoryId ?? undefined,
      userId: category.userId,
      createdAt: (category as any).createdAt,
      updatedAt: (category as any).updatedAt,
      parentCategory: undefined,
      subcategories: children.map((child) =>
        this.buildSubcategoryTree(child, all),
      ),
    };
  }

  private buildCategoryTree(
    category: Category,
    level: number,
    path: string[],
    all: Category[],
  ): CategoryTreeResponseDto {
    const newPath = [...path, category.name];
    const children = all.filter((c) => c.parentCategoryId === category.id);
    return {
      id: category.id,
      name: category.name,
      description: category.description ?? undefined,
      level,
      path: newPath,
      subcategories: children.map((child) =>
        this.buildCategoryTree(child, level + 1, newPath, all),
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
    excludeId: number | null,
  ) {
    let currId: number | null = parentId;
    while (currId != null) {
      if (excludeId != null && currId === excludeId) {
        throw new BadRequestException('Circular reference detected');
      }
      const curr = await this.prisma.category.findUnique({
        where: { id: currId },
        select: { parentCategoryId: true, userId: true },
      });
      if (!curr || curr.userId !== userId) break;
      currId = curr.parentCategoryId ?? null;
    }
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
      subcategories: cat.subcategories?.map((s: any) => ({
        id: s.id,
        name: s.name,
        description: s.description ?? undefined,
        parentCategoryId: s.parentCategoryId ?? undefined,
        userId: s.userId,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        parentCategory: undefined,
        subcategories: [],
      })) ?? [],
    };
  }

  private handleDatabaseError(error: any, op: string): never {
    if (error.code === 'P2003') {
      throw new BadRequestException('Foreign key constraint failed');
    }
    if (error.code === 'P2025') {
      throw new NotFoundException('Record not found');
    }
    this.logger.error(`${op} database error: ${error.message}`, error.stack);
    throw new BadRequestException(`Failed to ${op} category`);
  }
}
