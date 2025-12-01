import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryResponseDto, CategoryTreeResponseDto } from './dto/category-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OwnershipGuard } from '../auth/guards/ownership.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { User as GetUser } from '../auth/decorators/user.decorator';
import { EffectiveUserId } from '../auth/decorators/effective-user-id.decorator';
import { PaginatedResponse } from '../common';
import type { User } from '@prisma/client';

@Controller('categories')
@UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
export class CategoryController {
  private readonly logger = new Logger(CategoryController.name);

  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ resource: 'categories', action: 'create' })
  async create(
    @Body() createCategoryDto: CreateCategoryDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ): Promise<CategoryResponseDto> {
    this.logger.log(`User ${user.id} creating category: ${createCategoryDto.name}`);
    
    return this.categoryService.create(createCategoryDto, effectiveUserId);
  }

  @Get()
  @RequirePermissions({ resource: 'categories', action: 'read' })
  async findAll(
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
    @Query('tree') tree?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<PaginatedResponse<CategoryResponseDto> | CategoryTreeResponseDto[]> {
    this.logger.log(`User ${user.id} fetching categories${tree ? ' as tree' : ''}`);
    
    const includeTree = tree === 'true';
    
    if (includeTree) {
      // Tree structure doesn't need pagination as it's a hierarchical view
      return this.categoryService.getCategoryTree(effectiveUserId);
    }
    
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    
    return this.categoryService.findAll(effectiveUserId, pageNum, limitNum);
  }

  @Get('tree')
  @RequirePermissions({ resource: 'categories', action: 'read' })
  async getCategoryTree(
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ): Promise<CategoryTreeResponseDto[]> {
    this.logger.log(`User ${user.id} fetching category tree`);
    
    return this.categoryService.getCategoryTree(effectiveUserId);
  }

  @Get(':id')
  @RequirePermissions({ resource: 'categories', action: 'read' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
    @Query('productPage') productPage?: string,
    @Query('productLimit') productLimit?: string,
  ): Promise<CategoryResponseDto> {
    this.logger.log(`User ${user.id} fetching category: ${id}`);
    
    const pPage = productPage ? parseInt(productPage) : undefined;
    const pLimit = productLimit ? parseInt(productLimit) : undefined;
    
    return this.categoryService.findOne(id, effectiveUserId, pPage, pLimit);
  }

  @Get(':id/subcategories')
  @RequirePermissions({ resource: 'categories', action: 'read' })
  async getSubcategories(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<PaginatedResponse<CategoryResponseDto>> {
    this.logger.log(`User ${user.id} fetching subcategories for category: ${id}`);
    
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    
    return this.categoryService.getSubcategories(id, effectiveUserId, pageNum, limitNum);
  }

  @Patch(':id')
  @RequirePermissions({ resource: 'categories', action: 'update' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ): Promise<CategoryResponseDto> {
    this.logger.log(`User ${user.id} updating category: ${id}`);
    
    return this.categoryService.update(id, updateCategoryDto, effectiveUserId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'categories', action: 'delete' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ): Promise<{ message: string }> {
    this.logger.log(`User ${user.id} deleting category: ${id}`);
    
    return this.categoryService.remove(id, effectiveUserId);
  }
}
