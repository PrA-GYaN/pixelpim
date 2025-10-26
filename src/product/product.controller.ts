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
  NotFoundException,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductAttributesDto } from './dto/update-product-attribute.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { AddVariantDto, RemoveVariantDto, GetProductVariantsDto, ProductVariantResponseDto } from './dto/product-variant.dto';
import { ExportProductDto, ExportProductResponseDto } from './dto/export-product.dto';
// import { MarketplaceExportDto, MarketplaceExportResponseDto, MarketplaceType } from './dto/marketplace-export.dto';
import { 
  ScheduleImportDto, 
  UpdateScheduledImportDto,
  ImportJobResponseDto, 
  ImportExecutionLogResponseDto,
  ImportExecutionStatsDto
} from './dto/schedule-import.dto';
import { ImportCsvDto, ImportCsvResponseDto } from './dto/import-csv.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User as GetUser } from '../auth/decorators/user.decorator';
import { PaginatedResponse } from '../common';
// import { SortingDto } from '../common';
import type { User } from '../../generated/prisma';
// import { MarketplaceTemplateService } from './services/marketplace-template.service';
// import { MarketplaceExportService } from './services/marketplace-export.service';
import { CsvImportService } from './services/csv-import.service';
// import { ImportSchedulerService } from './services/import-scheduler.service';

@Controller('products')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class ProductController {
  private readonly logger = new Logger(ProductController.name);

  constructor(
    private readonly productService: ProductService,
    private readonly csvImportService: CsvImportService,
  ) {}

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

  @Post(':parentId/variants')
  @HttpCode(HttpStatus.CREATED)
  async addVariant(
    @Param('parentId', ParseIntPipe) parentId: number,
    @Body() addVariantDto: AddVariantDto,
    @GetUser() user: User,
  ): Promise<ProductResponseDto> {
    this.logger.log(`User ${user.id} adding variant to parent product ${parentId}`);
    
    return this.productService.addVariant(parentId, addVariantDto, user.id);
  }

  @Delete(':parentId/variants/:variantId')
  @HttpCode(HttpStatus.OK)
  async removeVariant(
    @Param('parentId', ParseIntPipe) parentId: number,
    @Param('variantId', ParseIntPipe) variantId: number,
    @GetUser() user: User,
  ): Promise<{ message: string }> {
    this.logger.log(`User ${user.id} removing variant ${variantId} from parent product ${parentId}`);
    
    return this.productService.removeVariant(parentId, variantId, user.id);
  }

  @Get(':parentId/variants')
  async getVariants(
    @Param('parentId', ParseIntPipe) parentId: number,
    @GetUser() user: User,
    @Query() queryDto: GetProductVariantsDto,
  ): Promise<PaginatedResponse<ProductVariantResponseDto>> {
    this.logger.log(`User ${user.id} getting variants for parent product ${parentId} with pagination: page=${queryDto.page}, limit=${queryDto.limit}`);
    
    return this.productService.getVariants(parentId, user.id, queryDto);
  }

  // Product Export Endpoint

  @Get('export/attributes')
  async getAttributesForExport(
    @GetUser() user: User,
  ) {
    this.logger.log(`User ${user.id} fetching attributes for export selection`);
    
    return this.productService.getAttributesForExport(user.id);
  }

  @Post('export')
  @HttpCode(HttpStatus.OK)
  async exportProducts(
    @Body() exportDto: ExportProductDto,
    @GetUser() user: User,
  ): Promise<ExportProductResponseDto> {
    this.logger.log(`User ${user.id} exporting ${exportDto.productIds.length} products with attributes: ${exportDto.attributes.join(', ')}`);
    
    return this.productService.exportProducts(exportDto, user.id);
  }

  // // Marketplace Export Endpoints

  // @Get('marketplace/templates')
  // async getMarketplaceTemplates(
  //   @GetUser() user: User,
  // ) {
  //   this.logger.log(`User ${user.id} fetching marketplace templates`);
    
  //   return this.productService.getMarketplaceTemplates();
  // }

  // @Get('marketplace/templates/:marketplaceType')
  // async getMarketplaceTemplate(
  //   @Param('marketplaceType') marketplaceType: string,
  //   @GetUser() user: User,
  // ) {
  //   this.logger.log(`User ${user.id} fetching template for marketplace: ${marketplaceType}`);
    
  //   return this.productService.getMarketplaceTemplate(marketplaceType as any);
  // }

  // @Post('marketplace/export')
  // @HttpCode(HttpStatus.OK)
  // async exportToMarketplace(
  //   @Body() exportDto: MarketplaceExportDto,
  //   @GetUser() user: User,
  // ): Promise<MarketplaceExportResponseDto> {
  //   this.logger.log(`User ${user.id} exporting ${exportDto.productIds?.length || 0} products to ${exportDto.marketplaceType}`);
    
  //   return this.productService.exportToMarketplace(exportDto, user.id);
  // }

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

  // CSV Import Endpoints

  @Post('import-csv')
  @HttpCode(HttpStatus.OK)
  async importFromCsv(
    @Body() importDto: ImportCsvDto,
    @GetUser() user: User,
  ): Promise<ImportCsvResponseDto> {
    this.logger.log(`User ${user.id} importing CSV from: ${importDto.csvUrl}`);
    
    return this.csvImportService.importFromCsv(importDto.csvUrl, user.id);
  }

  // CSV Import Scheduling Endpoints

  @Post('import/schedule')
  @HttpCode(HttpStatus.CREATED)
  async scheduleCsvImport(
    @Body() scheduleDto: ScheduleImportDto,
    @GetUser() user: User,
  ): Promise<ImportJobResponseDto> {
    this.logger.log(`User ${user.id} scheduling CSV import from: ${scheduleDto.csvUrl}`);
    
    return this.productService.scheduleCsvImport(scheduleDto, user.id);
  }

  @Get('import/jobs')
  async getImportJobs(
    @GetUser() user: User,
    @Query('includeExecutions') includeExecutions?: boolean,
  ): Promise<ImportJobResponseDto[]> {
    this.logger.log(`User ${user.id} fetching import jobs`);
    
    return this.productService.getImportJobs(user.id, includeExecutions);
  }

  @Get('import/jobs/:jobId')
  async getImportJob(
    @Param('jobId') jobId: string,
    @GetUser() user: User,
    @Query('includeExecutions') includeExecutions?: boolean,
  ): Promise<ImportJobResponseDto> {
    this.logger.log(`User ${user.id} fetching import job: ${jobId}`);
    
    return this.productService.getImportJob(jobId, user.id, includeExecutions);
  }

  @Patch('import/jobs/:jobId')
  async updateScheduledImport(
    @Param('jobId') jobId: string,
    @Body() updateDto: UpdateScheduledImportDto,
    @GetUser() user: User,
  ): Promise<ImportJobResponseDto> {
    this.logger.log(`User ${user.id} updating scheduled import job: ${jobId}`);
    
    return this.productService.updateScheduledImport(jobId, updateDto, user.id);
  }

  @Post('import/jobs/:jobId/pause')
  @HttpCode(HttpStatus.OK)
  async pauseImportJob(
    @Param('jobId') jobId: string,
    @GetUser() user: User,
  ): Promise<{ message: string }> {
    this.logger.log(`User ${user.id} pausing import job: ${jobId}`);
    
    const paused = await this.productService.pauseImportJob(jobId, user.id);
    return { message: paused ? 'Import job paused successfully' : 'Import job not found' };
  }

  @Post('import/jobs/:jobId/resume')
  @HttpCode(HttpStatus.OK)
  async resumeImportJob(
    @Param('jobId') jobId: string,
    @GetUser() user: User,
  ): Promise<{ message: string }> {
    this.logger.log(`User ${user.id} resuming import job: ${jobId}`);
    
    const resumed = await this.productService.resumeImportJob(jobId, user.id);
    return { message: resumed ? 'Import job resumed successfully' : 'Import job not found' };
  }

  @Delete('import/jobs/:jobId')
  @HttpCode(HttpStatus.OK)
  async cancelImportJob(
    @Param('jobId') jobId: string,
    @GetUser() user: User,
  ): Promise<{ message: string }> {
    this.logger.log(`User ${user.id} cancelling import job: ${jobId}`);
    
    const cancelled = await this.productService.cancelImportJob(jobId, user.id);
    return { message: cancelled ? 'Import job cancelled successfully' : 'Import job not found' };
  }

  @Delete('import/jobs/:jobId/delete')
  @HttpCode(HttpStatus.OK)
  async deleteImportJob(
    @Param('jobId') jobId: string,
    @GetUser() user: User,
  ): Promise<{ message: string }> {
    this.logger.log(`User ${user.id} deleting import job: ${jobId}`);
    
    const deleted = await this.productService.deleteImportJob(jobId, user.id);
    return { message: deleted ? 'Import job deleted successfully' : 'Import job not found' };
  }

  @Get('import/jobs/:jobId/executions')
  async getExecutionLogs(
    @Param('jobId') jobId: string,
    @GetUser() user: User,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
  ): Promise<{
    logs: ImportExecutionLogResponseDto[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    this.logger.log(`User ${user.id} fetching execution logs for job: ${jobId}`);
    
    return this.productService.getExecutionLogs(jobId, user.id, page, limit);
  }

  @Get('import/jobs/:jobId/stats')
  async getExecutionStats(
    @Param('jobId') jobId: string,
    @GetUser() user: User,
  ): Promise<ImportExecutionStatsDto> {
    this.logger.log(`User ${user.id} fetching execution stats for job: ${jobId}`);
    
    return this.productService.getExecutionStats(jobId, user.id);
  }
}
