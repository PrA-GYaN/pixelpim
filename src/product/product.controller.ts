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
  Sse,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { BulkDeleteDto } from './dto/bulk-delete.dto';
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
import { OwnershipGuard } from '../auth/guards/ownership.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { User as GetUser } from '../auth/decorators/user.decorator';
import { EffectiveUserId } from '../auth/decorators/effective-user-id.decorator';
import { PaginatedResponse } from '../common';
// import { SortingDto } from '../common';
import type { User } from '@prisma/client';
// import { MarketplaceTemplateService } from './services/marketplace-template.service';
// import { MarketplaceExportService } from './services/marketplace-export.service';
import { CsvImportService } from './services/csv-import.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadedFile } from '@nestjs/common';
import { ImportProductsDto, ImportProductsResponseDto } from './dto/import-products.dto';
// import { ImportSchedulerService } from './services/import-scheduler.service';

@Controller('products')
@UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
@UseInterceptors(ClassSerializerInterceptor)
@RequirePermissions({ resource: 'products', action: 'read' })
export class ProductController {
  private readonly logger = new Logger(ProductController.name);

  constructor(
    private readonly productService: ProductService,
    private readonly csvImportService: CsvImportService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ resource: 'products', action: 'create' })
  async create(
    @Body() createProductDto: CreateProductDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ): Promise<ProductResponseDto> {
    this.logger.log(`User ${user.id} creating product: ${createProductDto.name}`);
    
    return this.productService.create(createProductDto, effectiveUserId);
  }

  @Get()
  async findAll(
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
    @Query('attributeIds') attributeIds?: string,
    @Query('attributeGroupId') attributeGroupId?: string,
    @Query('familyId') familyId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ): Promise<PaginatedResponse<ProductResponseDto>> {
    this.logger.log(`User ${user.id} fetching products`);
    
    const categoryIdInt = categoryId === 'null' ? null : categoryId ? parseInt(categoryId) : undefined;
    
    // Parse attributeIds from comma-separated string to array of numbers
    let attributeIdsArray: number[] | undefined = undefined;
    if (attributeIds) {
      attributeIdsArray = attributeIds.split(',')
        .map(id => parseInt(id.trim()))
        .filter(id => !isNaN(id));
    }
    
    const attributeGroupIdInt = attributeGroupId === 'null' ? null : attributeGroupId ? parseInt(attributeGroupId) : undefined;
    const familyIdInt = familyId === 'null' ? null : familyId ? parseInt(familyId) : undefined;
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    const sortOrderValidated = sortOrder === 'asc' ? 'asc' : 'desc';
    
    return this.productService.findAll(
      effectiveUserId, 
      search,
      status, 
      categoryIdInt, 
      attributeIdsArray, 
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
    @EffectiveUserId() effectiveUserId: number,
  ): Promise<ProductResponseDto> {
    this.logger.log(`User ${user.id} fetching product by SKU: ${sku}`);
    
    return this.productService.findBySku(sku, effectiveUserId);
  }

  @Get('category/:categoryId')
  async getProductsByCategory(
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ): Promise<PaginatedResponse<ProductResponseDto>> {
    this.logger.log(`User ${user.id} fetching products for category: ${categoryId}`);
    
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    const sortOrderValidated = sortOrder === 'asc' ? 'asc' : 'desc';
    
    return this.productService.getProductsByCategory(categoryId, effectiveUserId, pageNum, limitNum, sortBy, sortOrderValidated);
  }

  @Get('attribute/:attributeId')
  async getProductsByAttribute(
    @Param('attributeId', ParseIntPipe) attributeId: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ): Promise<PaginatedResponse<ProductResponseDto>> {
    this.logger.log(`User ${user.id} fetching products for attribute: ${attributeId}`);
    
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    const sortOrderValidated = sortOrder === 'asc' ? 'asc' : 'desc';
    
    return this.productService.getProductsByAttribute(attributeId, effectiveUserId, pageNum, limitNum, sortBy, sortOrderValidated);
  }

  @Get('attribute-group/:attributeGroupId')
  async getProductsByAttributeGroup(
    @Param('attributeGroupId', ParseIntPipe) attributeGroupId: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ): Promise<PaginatedResponse<ProductResponseDto>> {
    this.logger.log(`User ${user.id} fetching products for attribute group: ${attributeGroupId}`);
    
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    const sortOrderValidated = sortOrder === 'asc' ? 'asc' : 'desc';
    
    return this.productService.getProductsByAttributeGroup(attributeGroupId, effectiveUserId, pageNum, limitNum, sortBy, sortOrderValidated);
  }

  @Get('family/:familyId')
  async getProductsByFamily(
    @Param('familyId', ParseIntPipe) familyId: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ): Promise<PaginatedResponse<ProductResponseDto>> {
    this.logger.log(`User ${user.id} fetching products for family: ${familyId}`);
    
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    const sortOrderValidated = sortOrder === 'asc' ? 'asc' : 'desc';
    
    return this.productService.getProductsByFamily(familyId, effectiveUserId, pageNum, limitNum, sortBy, sortOrderValidated);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ): Promise<ProductResponseDto> {
    this.logger.log(`User ${user.id} fetching product:000000000000 ${id}`);
    
    return this.productService.findOne(id, effectiveUserId);
  }

  @Patch(':id')
  @RequirePermissions({ resource: 'products', action: 'update' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProductDto: UpdateProductDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ): Promise<ProductResponseDto> {
    this.logger.log(`User ${user.id} updating product: ${id}`);
    
    return this.productService.update(id, updateProductDto, effectiveUserId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'products', action: 'delete' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ): Promise<{ message: string }> {
    this.logger.log(`User ${user.id} deleting product: ${id}`);
    
    return this.productService.remove(id, effectiveUserId);
  }

  @Post('bulk-delete')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'products', action: 'delete' })
  async bulkDelete(
    @Body() body: BulkDeleteDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ): Promise<{ message: string; deletedCount: number }> {
    this.logger.log(`User ${user.id} bulk deleting products`);

    const deletedCount = await this.productService.bulkRemove(body.ids ?? [], effectiveUserId, body.filters);

    return { message: `Deleted ${deletedCount} product(s)`, deletedCount };
  }

  // Product Variant Management Endpoints

  @Post(':parentId/variants')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ resource: 'products', action: 'update' })
  async addVariant(
    @Param('parentId', ParseIntPipe) parentId: number,
    @Body() addVariantDto: AddVariantDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ): Promise<ProductResponseDto> {
    this.logger.log(`User ${user.id} adding variant to parent product ${parentId}`);
    
    return this.productService.addVariant(parentId, addVariantDto, effectiveUserId);
  }

  @Delete(':parentId/variants/:variantId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'products', action: 'update' })
  async removeVariant(
    @Param('parentId', ParseIntPipe) parentId: number,
    @Param('variantId', ParseIntPipe) variantId: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ): Promise<{ message: string }> {
    this.logger.log(`User ${user.id} removing variant ${variantId} from parent product ${parentId}`);
    
    return this.productService.removeVariant(parentId, variantId, effectiveUserId);
  }

  @Get(':parentId/variants')
  async getVariants(
    @Param('parentId', ParseIntPipe) parentId: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
    @Query() queryDto: GetProductVariantsDto,
  ): Promise<PaginatedResponse<ProductVariantResponseDto>> {
    this.logger.log(`User ${user.id} getting variants for parent product ${parentId} with pagination: page=${queryDto.page}, limit=${queryDto.limit}`);
    
    return this.productService.getVariants(parentId, effectiveUserId, queryDto);
  }

  // Product Export Endpoint

  @Get('export/attributes')
  async getAttributesForExport(
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} fetching attributes for export selection`);
    
    return this.productService.getAttributesForExport(effectiveUserId);
  }

  @Post('export')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'products', action: 'export' })
  async exportProducts(
    @Body() exportDto: ExportProductDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ): Promise<ExportProductResponseDto> {
    this.logger.log(`User ${user.id} exporting ${exportDto.productIds.length} products with attributes: ${exportDto.attributes.join(', ')}`);
    
    return this.productService.exportProducts(exportDto, effectiveUserId);
  }

  // Product Attribute Value Management Endpoints

  @Patch(':id/attributes')
  @RequirePermissions({ resource: 'products', action: 'update' })
  async updateProductAttributeValues(
    @Param('id', ParseIntPipe) productId: number,
    @Body() updateAttributesDto: UpdateProductAttributesDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ): Promise<ProductResponseDto> {
    this.logger.log(`User ${user.id} updating attribute values for product: ${productId}`);
    
    return this.productService.updateProductAttributeValues(
      productId,
      updateAttributesDto.attributes,
      effectiveUserId
    );
  }

  @Get(':id/attributes')
  async getProductAttributeValues(
    @Param('id', ParseIntPipe) productId: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} getting attribute values for product: ${productId}`);
    
    return this.productService.getProductAttributeValues(productId, effectiveUserId);
  }

  // CSV Import Endpoints

  @Post('import-csv')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'products', action: 'import' })
  async importFromCsv(
    @Body() importDto: ImportCsvDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ): Promise<ImportCsvResponseDto> {
    this.logger.log(`User ${user.id} importing CSV from: ${importDto.csvUrl}`);
    
    return this.csvImportService.importFromCsv(importDto.csvUrl, effectiveUserId);
  }

  // Excel (XLSX) Import
  @Post('import')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'products', action: 'import' })
  @UseInterceptors(FileInterceptor('file'))
  async importFromExcel(
    @UploadedFile() file: Express.Multer.File,
    @Body() importDto: ImportProductsDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ): Promise<ImportProductsResponseDto> {
    this.logger.log(`User ${user.id} importing products from Excel`);

    return this.productService.importProductsFromExcel(file, importDto.mapping, effectiveUserId);
  }

  @Sse('import/progress/:sessionId')
  importProgress(
    @Param('sessionId') sessionId: string,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} subscribing to import progress for session ${sessionId}`);
    return this.productService.getImportProgressStream(sessionId, effectiveUserId);
  }

  @Post('import-with-progress')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @RequirePermissions({ resource: 'products', action: 'import' })
  async importFromExcelWithProgress(
    @UploadedFile() file: Express.Multer.File,
    @Body() importDto: ImportProductsDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ): Promise<{ sessionId: string }> {
    this.logger.log(`User ${user.id} importing products from Excel with progress tracking`);

    const sessionId = this.productService.generateSessionId();
    // Start import in background
    this.productService.importProductsFromExcelWithProgress(file, importDto.mapping, effectiveUserId, sessionId).catch(err => {
      this.logger.error(`Error in background import for session ${sessionId}:`, err);
    });

    return { sessionId };
  }

  // CSV Import Scheduling Endpoints

  @Post('import/schedule')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ resource: 'products', action: 'import' })
  async scheduleCsvImport(
    @Body() scheduleDto: ScheduleImportDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ): Promise<ImportJobResponseDto> {
    this.logger.log(`User ${user.id} scheduling CSV import from: ${scheduleDto.csvUrl}`);
    
    return this.productService.scheduleCsvImport(scheduleDto, effectiveUserId);
  }

  @Get('import/jobs')
  @RequirePermissions({ resource: 'products', action: 'import' })
  async getImportJobs(
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
    @Query('includeExecutions') includeExecutions?: boolean,
  ): Promise<ImportJobResponseDto[]> {
    this.logger.log(`User ${user.id} fetching import jobs`);
    
    return this.productService.getImportJobs(effectiveUserId, includeExecutions);
  }

  @Get('import/jobs/:jobId')
  @RequirePermissions({ resource: 'products', action: 'import' })
  async getImportJob(
    @Param('jobId') jobId: string,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
    @Query('includeExecutions') includeExecutions?: boolean,
  ): Promise<ImportJobResponseDto> {
    this.logger.log(`User ${user.id} fetching import job: ${jobId}`);
    
    return this.productService.getImportJob(jobId, effectiveUserId, includeExecutions);
  }

  @Patch('import/jobs/:jobId')
  @RequirePermissions({ resource: 'products', action: 'import' })
  async updateScheduledImport(
    @Param('jobId') jobId: string,
    @Body() updateDto: UpdateScheduledImportDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ): Promise<ImportJobResponseDto> {
    this.logger.log(`User ${user.id} updating scheduled import job: ${jobId}`);
    
    return this.productService.updateScheduledImport(jobId, updateDto, effectiveUserId);
  }

  @Post('import/jobs/:jobId/pause')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'products', action: 'import' })
  async pauseImportJob(
    @Param('jobId') jobId: string,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ): Promise<{ message: string }> {
    this.logger.log(`User ${user.id} pausing import job: ${jobId}`);
    
    const paused = await this.productService.pauseImportJob(jobId, effectiveUserId);
    return { message: paused ? 'Import job paused successfully' : 'Import job not found' };
  }

  @Post('import/jobs/:jobId/resume')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'products', action: 'import' })
  async resumeImportJob(
    @Param('jobId') jobId: string,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ): Promise<{ message: string }> {
    this.logger.log(`User ${user.id} resuming import job: ${jobId}`);
    
    const resumed = await this.productService.resumeImportJob(jobId, effectiveUserId);
    return { message: resumed ? 'Import job resumed successfully' : 'Import job not found' };
  }

  @Delete('import/jobs/:jobId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'products', action: 'import' })
  async cancelImportJob(
    @Param('jobId') jobId: string,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ): Promise<{ message: string }> {
    this.logger.log(`User ${user.id} cancelling import job: ${jobId}`);
    
    const cancelled = await this.productService.cancelImportJob(jobId, effectiveUserId);
    return { message: cancelled ? 'Import job cancelled successfully' : 'Import job not found' };
  }

  @Delete('import/jobs/:jobId/delete')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'products', action: 'import' })
  async deleteImportJob(
    @Param('jobId') jobId: string,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ): Promise<{ message: string }> {
    this.logger.log(`User ${user.id} deleting import job: ${jobId}`);
    
    const deleted = await this.productService.deleteImportJob(jobId, effectiveUserId);
    return { message: deleted ? 'Import job deleted successfully' : 'Import job not found' };
  }

  @Get('import/jobs/:jobId/executions')
  @RequirePermissions({ resource: 'products', action: 'import' })
  async getExecutionLogs(
    @Param('jobId') jobId: string,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
  ): Promise<{
    logs: ImportExecutionLogResponseDto[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    this.logger.log(`User ${user.id} fetching execution logs for job: ${jobId}`);
    
    return this.productService.getExecutionLogs(jobId, effectiveUserId, page, limit);
  }

  @Get('import/jobs/:jobId/stats')
  @RequirePermissions({ resource: 'products', action: 'import' })
  async getExecutionStats(
    @Param('jobId') jobId: string,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ): Promise<ImportExecutionStatsDto> {
    this.logger.log(`User ${user.id} fetching execution stats for job: ${jobId}`);
    
    return this.productService.getExecutionStats(jobId, effectiveUserId);
  }

  // Soft Delete Endpoints

  @Get('deleted')
  @RequirePermissions({ resource: 'products', action: 'delete' })
  async getSoftDeletedProducts(
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.logger.log(`User ${user.id} fetching soft-deleted products`);
    
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    
    return this.productService.getSoftDeletedProducts(effectiveUserId, pageNum, limitNum);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'products', action: 'update' })
  async restoreProduct(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
    @Query('restoreVariants') restoreVariants?: string,
  ) {
    this.logger.log(`User ${user.id} restoring soft-deleted product: ${id}`);
    
    const shouldRestoreVariants = restoreVariants === 'true';
    return this.productService.restoreProduct(id, effectiveUserId, shouldRestoreVariants);
  }

  @Delete(':id/permanent')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'products', action: 'delete' })
  async permanentlyDeleteProduct(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} permanently deleting product: ${id}`);
    
    return this.productService.permanentlyDeleteProduct(id, effectiveUserId);
  }
}
