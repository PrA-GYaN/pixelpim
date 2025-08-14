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
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User as GetUser } from '../auth/decorators/user.decorator';
import { PaginatedResponse } from '../common';
import type { User } from '../../generated/prisma';

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductController {
  private readonly logger = new Logger(ProductController.name);

  constructor(private readonly productService: ProductService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createProductDto: CreateProductDto,
    @GetUser() user: User,
  ): Promise<ProductResponseDto> {
    this.logger.log(`User ${user.id} creating product: ${createProductDto.name}`);
    
    return this.productService.create(createProductDto, user.id);
  }

  @Get()
  async findAll(
    @GetUser() user: User,
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
    @Query('attributeId') attributeId?: string,
    @Query('attributeGroupId') attributeGroupId?: string,
    @Query('familyId') familyId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<PaginatedResponse<ProductResponseDto>> {
    this.logger.log(`User ${user.id} fetching products`);
    
    const categoryIdInt = categoryId ? parseInt(categoryId) : undefined;
    const attributeIdInt = attributeId ? parseInt(attributeId) : undefined;
    const attributeGroupIdInt = attributeGroupId ? parseInt(attributeGroupId) : undefined;
    const familyIdInt = familyId ? parseInt(familyId) : undefined;
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    
    return this.productService.findAll(
      user.id, 
      status, 
      categoryIdInt, 
      attributeIdInt, 
      attributeGroupIdInt, 
      familyIdInt,
      pageNum,
      limitNum
    );
  }

  @Get('sku/:sku')
  async findBySku(
    @Param('sku') sku: string,
    @GetUser() user: User,
  ): Promise<ProductResponseDto> {
    this.logger.log(`User ${user.id} fetching product by SKU: ${sku}`);
    
    return this.productService.findBySku(sku, user.id);
  }

  @Get('category/:categoryId')
  async getProductsByCategory(
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @GetUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<PaginatedResponse<ProductResponseDto>> {
    this.logger.log(`User ${user.id} fetching products for category: ${categoryId}`);
    
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    
    return this.productService.getProductsByCategory(categoryId, user.id, pageNum, limitNum);
  }

  @Get('attribute/:attributeId')
  async getProductsByAttribute(
    @Param('attributeId', ParseIntPipe) attributeId: number,
    @GetUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<PaginatedResponse<ProductResponseDto>> {
    this.logger.log(`User ${user.id} fetching products for attribute: ${attributeId}`);
    
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    
    return this.productService.getProductsByAttribute(attributeId, user.id, pageNum, limitNum);
  }

  @Get('attribute-group/:attributeGroupId')
  async getProductsByAttributeGroup(
    @Param('attributeGroupId', ParseIntPipe) attributeGroupId: number,
    @GetUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<PaginatedResponse<ProductResponseDto>> {
    this.logger.log(`User ${user.id} fetching products for attribute group: ${attributeGroupId}`);
    
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    
    return this.productService.getProductsByAttributeGroup(attributeGroupId, user.id, pageNum, limitNum);
  }

  @Get('family/:familyId')
  async getProductsByFamily(
    @Param('familyId', ParseIntPipe) familyId: number,
    @GetUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<PaginatedResponse<ProductResponseDto>> {
    this.logger.log(`User ${user.id} fetching products for family: ${familyId}`);
    
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    
    return this.productService.getProductsByFamily(familyId, user.id, pageNum, limitNum);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
  ): Promise<ProductResponseDto> {
    this.logger.log(`User ${user.id} fetching product: ${id}`);
    
    return this.productService.findOne(id, user.id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProductDto: UpdateProductDto,
    @GetUser() user: User,
  ): Promise<ProductResponseDto> {
    this.logger.log(`User ${user.id} updating product: ${id}`);
    
    return this.productService.update(id, updateProductDto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
  ): Promise<{ message: string }> {
    this.logger.log(`User ${user.id} deleting product: ${id}`);
    
    return this.productService.remove(id, user.id);
  }
}
