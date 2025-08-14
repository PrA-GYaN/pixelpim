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
import { User as GetUser } from '../auth/decorators/user.decorator';
import { PaginatedResponse } from '../common';
import type { User } from '../../generated/prisma';

@Controller('categories')
@UseGuards(JwtAuthGuard)
export class CategoryController {
  private readonly logger = new Logger(CategoryController.name);

  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createCategoryDto: CreateCategoryDto,
    @GetUser() user: User,
  ): Promise<CategoryResponseDto> {
    this.logger.log(`User ${user.id} creating category: ${createCategoryDto.name}`);
    
    return this.categoryService.create(createCategoryDto, user.id);
  }

  @Get()
  async findAll(
    @GetUser() user: User,
    @Query('tree') tree?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<PaginatedResponse<CategoryResponseDto> | CategoryTreeResponseDto[]> {
    this.logger.log(`User ${user.id} fetching categories${tree ? ' as tree' : ''}`);
    
    const includeTree = tree === 'true';
    
    if (includeTree) {
      // Tree structure doesn't need pagination as it's a hierarchical view
      return this.categoryService.getCategoryTree(user.id);
    }
    
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    
    return this.categoryService.findAll(user.id, pageNum, limitNum);
  }

  @Get('tree')
  async getCategoryTree(@GetUser() user: User): Promise<CategoryTreeResponseDto[]> {
    this.logger.log(`User ${user.id} fetching category tree`);
    
    return this.categoryService.getCategoryTree(user.id);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
  ): Promise<CategoryResponseDto> {
    this.logger.log(`User ${user.id} fetching category: ${id}`);
    
    return this.categoryService.findOne(id, user.id);
  }

  @Get(':id/subcategories')
  async getSubcategories(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<PaginatedResponse<CategoryResponseDto>> {
    this.logger.log(`User ${user.id} fetching subcategories for category: ${id}`);
    
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    
    return this.categoryService.getSubcategories(id, user.id, pageNum, limitNum);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @GetUser() user: User,
  ): Promise<CategoryResponseDto> {
    this.logger.log(`User ${user.id} updating category: ${id}`);
    
    return this.categoryService.update(id, updateCategoryDto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
  ): Promise<{ message: string }> {
    this.logger.log(`User ${user.id} deleting category: ${id}`);
    
    return this.categoryService.remove(id, user.id);
  }
}
