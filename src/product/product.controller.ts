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
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductAttributesDto } from './dto/update-product-attribute.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { CreateProductVariantDto, RemoveProductVariantDto, GetProductVariantsDto, ProductVariantResponseDto } from './dto/product-variant.dto';
import { ExportProductDto, ExportProductResponseDto } from './dto/export-product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User as GetUser } from '../auth/decorators/user.decorator';
import { PaginatedResponse } from '../common';
import { SortingDto } from '../common';
import type { User } from '../../generated/prisma';

@Controller('products')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
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
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
    @Query('attributeId') attributeId?: string,
    @Query('attributeGroupId') attributeGroupId?: string,
    @Query('familyId') familyId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ): Promise<PaginatedResponse<ProductResponseDto>> {
    this.logger.log(`User ${user.id} fetching products`);
    
    const categoryIdInt = categoryId === 'null' ? null : categoryId ? parseInt(categoryId) : undefined;
    const attributeIdInt = attributeId ? parseInt(attributeId) : undefined;
    const attributeGroupIdInt = attributeGroupId === 'null' ? null : attributeGroupId ? parseInt(attributeGroupId) : undefined;
    const familyIdInt = familyId === 'null' ? null : familyId ? parseInt(familyId) : undefined;
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    const sortOrderValidated = sortOrder === 'asc' ? 'asc' : 'desc';
    
    return this.productService.findAll(
      user.id, 
      search,
      status, 
      categoryIdInt, 
      attributeIdInt, 
      attributeGroupIdInt, 
      familyIdInt,
      pageNum,
      limitNum,
      sortBy,
      sortOrderValidated
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
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ): Promise<PaginatedResponse<ProductResponseDto>> {
    this.logger.log(`User ${user.id} fetching products for category: ${categoryId}`);
    
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    const sortOrderValidated = sortOrder === 'asc' ? 'asc' : 'desc';
    
    return this.productService.getProductsByCategory(categoryId, user.id, pageNum, limitNum, sortBy, sortOrderValidated);
  }

  @Get('attribute/:attributeId')
  async getProductsByAttribute(
    @Param('attributeId', ParseIntPipe) attributeId: number,
    @GetUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ): Promise<PaginatedResponse<ProductResponseDto>> {
    this.logger.log(`User ${user.id} fetching products for attribute: ${attributeId}`);
    
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    const sortOrderValidated = sortOrder === 'asc' ? 'asc' : 'desc';
    
    return this.productService.getProductsByAttribute(attributeId, user.id, pageNum, limitNum, sortBy, sortOrderValidated);
  }

  @Get('attribute-group/:attributeGroupId')
  async getProductsByAttributeGroup(
    @Param('attributeGroupId', ParseIntPipe) attributeGroupId: number,
    @GetUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ): Promise<PaginatedResponse<ProductResponseDto>> {
    this.logger.log(`User ${user.id} fetching products for attribute group: ${attributeGroupId}`);
    
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    const sortOrderValidated = sortOrder === 'asc' ? 'asc' : 'desc';
    
    return this.productService.getProductsByAttributeGroup(attributeGroupId, user.id, pageNum, limitNum, sortBy, sortOrderValidated);
  }

  @Get('family/:familyId')
  async getProductsByFamily(
    @Param('familyId', ParseIntPipe) familyId: number,
    @GetUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ): Promise<PaginatedResponse<ProductResponseDto>> {
    this.logger.log(`User ${user.id} fetching products for family: ${familyId}`);
    
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    const sortOrderValidated = sortOrder === 'asc' ? 'asc' : 'desc';
    
    return this.productService.getProductsByFamily(familyId, user.id, pageNum, limitNum, sortBy, sortOrderValidated);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
  ): Promise<ProductResponseDto> {
    this.logger.log(`User ${user.id} fetching product:000000000000 ${id}`);
    
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

  // Product Variant Management Endpoints

  @Get('variants')
  async getAllProductVariants(
    @GetUser() user: User,
    @Query() queryDto: GetProductVariantsDto,
  ): Promise<PaginatedResponse<ProductVariantResponseDto>> {
    this.logger.log(`User ${user.id} getting all product variants with pagination: page=${queryDto.page}, limit=${queryDto.limit}, sortBy=${queryDto.sortBy}, sortOrder=${queryDto.sortOrder}, search=${queryDto.search}, status=${queryDto.status}`);
    
    return this.productService.getAllProductVariants(user.id, queryDto);
  }

  @Post('variants')
  @HttpCode(HttpStatus.CREATED)
  async createVariant(
    @Body() createVariantDto: CreateProductVariantDto,
    @GetUser() user: User,
  ) {
    this.logger.log(`User ${user.id} creating product variant relationships`);
    
    return this.productService.createVariant(createVariantDto, user.id);
  }

  @Delete('variants/:productId/:variantProductId')
  @HttpCode(HttpStatus.OK)
  async removeVariant(
    @Param('productId', ParseIntPipe) productId: number,
    @Param('variantProductId', ParseIntPipe) variantProductId: number,
    @GetUser() user: User,
  ) {
    this.logger.log(`User ${user.id} removing product variant relationship`);
    this.logger.log(`Removing variant relationship: productId=${productId}, variantProductId=${variantProductId}`);
    
    const removeVariantDto = { productId, variantProductId };
    return this.productService.removeVariant(removeVariantDto, user.id);
  }

  @Get(':id/variants')
  async getProductVariants(
    @Param('id', ParseIntPipe) productId: number,
    @GetUser() user: User,
    @Query() queryDto: GetProductVariantsDto,
  ): Promise<PaginatedResponse<ProductVariantResponseDto>> {
    this.logger.log(`User ${user.id} getting variants for product: ${productId} with pagination: page=${queryDto.page}, limit=${queryDto.limit}, sortBy=${queryDto.sortBy}, sortOrder=${queryDto.sortOrder}, search=${queryDto.search}, status=${queryDto.status}`);
    
    return this.productService.getProductVariants(productId, user.id, queryDto);
  }

  // Product Export Endpoint

  @Post('export')
  @HttpCode(HttpStatus.OK)
  async exportProducts(
    @Body() exportDto: ExportProductDto,
    @GetUser() user: User,
  ): Promise<ExportProductResponseDto> {
    this.logger.log(`User ${user.id} exporting ${exportDto.productIds.length} products with attributes: ${exportDto.attributes.join(', ')}`);
    
    return this.productService.exportProducts(exportDto, user.id);
  }

  // Product Attribute Value Management Endpoints

  @Patch(':id/attributes')
  async updateProductAttributeValues(
    @Param('id', ParseIntPipe) productId: number,
    @Body() updateAttributesDto: UpdateProductAttributesDto,
    @GetUser() user: User,
  ): Promise<ProductResponseDto> {
    this.logger.log(`User ${user.id} updating attribute values for product: ${productId}`);
    
    return this.productService.updateProductAttributeValues(
      productId,
      updateAttributesDto.attributes,
      user.id
    );
  }

  @Get(':id/attributes')
  async getProductAttributeValues(
    @Param('id', ParseIntPipe) productId: number,
    @GetUser() user: User,
  ) {
    this.logger.log(`User ${user.id} getting attribute values for product: ${productId}`);
    
    return this.productService.getProductAttributeValues(productId, user.id);
  }
}
