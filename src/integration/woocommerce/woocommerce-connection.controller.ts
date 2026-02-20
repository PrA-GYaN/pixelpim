import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OwnershipGuard } from '../../auth/guards/ownership.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { User as GetUser } from '../../auth/decorators/user.decorator';
import { EffectiveUserId } from '../../auth/decorators/effective-user-id.decorator';
import type { User } from '@prisma/client';
import { WooCommerceConnectionService } from './woocommerce-connection.service';
import { WooCommerceMultiStoreService } from './woocommerce-multistore.service';
import {
  CreateWooCommerceConnectionDto,
  UpdateWooCommerceConnectionDto,
  TestConnectionDto,
  CreateExportMappingDto,
  UpdateExportMappingDto,
  CreateImportMappingDto,
  UpdateImportMappingDto,
  ExportProductsDto,
  ImportProductsDto,
} from './dto/woocommerce-connection.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('integration/woocommerce/connections')
@UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
export class WooCommerceConnectionController {
  private readonly logger = new Logger(WooCommerceConnectionController.name);

  constructor(
    private readonly connectionService: WooCommerceConnectionService,
    private readonly multiStoreService: WooCommerceMultiStoreService,
  ) {}

  // ===== Connection Management =====

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ resource: 'integrations', action: 'create' })
  async createConnection(
    @Body() dto: CreateWooCommerceConnectionDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(
      `User ${user.id} creating WooCommerce connection: ${dto.storeName}`,
    );
    return this.connectionService.createConnection(effectiveUserId, dto);
  }

  @Get()
  @RequirePermissions({ resource: 'integrations', action: 'read' })
  async getConnections(
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.connectionService.getConnections(effectiveUserId);
  }

  @Get('default')
  @RequirePermissions({ resource: 'integrations', action: 'read' })
  async getDefaultConnection(
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.connectionService.getDefaultConnection(effectiveUserId);
  }

  @Get(':connectionId')
  @RequirePermissions({ resource: 'integrations', action: 'read' })
  async getConnection(
    @Param('connectionId', ParseIntPipe) connectionId: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.connectionService.getConnection(effectiveUserId, connectionId);
  }

  @Put(':connectionId')
  @RequirePermissions({ resource: 'integrations', action: 'update' })
  async updateConnection(
    @Param('connectionId', ParseIntPipe) connectionId: number,
    @Body() dto: UpdateWooCommerceConnectionDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} updating connection ${connectionId}`);
    return this.connectionService.updateConnection(effectiveUserId, connectionId, dto);
  }
  
  @Delete(':connectionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions({ resource: 'integrations', action: 'delete' })
  async deleteConnection(
    @Param('connectionId', ParseIntPipe) connectionId: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} deleting connection ${connectionId}`);
    await this.connectionService.deleteConnection(effectiveUserId, connectionId);
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'integrations', action: 'read' })
  async testConnection(@Body() dto: TestConnectionDto) {
    return this.connectionService.testConnection(dto);
  }

  // ===== Export Mapping Management =====

  @Post(':connectionId/export-mappings')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ resource: 'integrations', action: 'create' })
  async createExportMapping(
    @Param('connectionId', ParseIntPipe) connectionId: number,
    @Body() dto: CreateExportMappingDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(
      `User ${user.id} creating export mapping for connection ${connectionId}`,
    );
    dto.connectionId = connectionId; // Ensure consistency
    return this.connectionService.createExportMapping(effectiveUserId, dto);
  }

  @Get(':connectionId/export-mappings')
  @RequirePermissions({ resource: 'integrations', action: 'read' })
  async getExportMappings(
    @Param('connectionId', ParseIntPipe) connectionId: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.connectionService.getExportMappings(effectiveUserId, connectionId);
  }

  @Get(':connectionId/export-mappings/active')
  @RequirePermissions({ resource: 'integrations', action: 'read' })
  async getActiveExportMapping(
    @Param('connectionId', ParseIntPipe) connectionId: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.connectionService.getActiveExportMapping(effectiveUserId, connectionId);
  }

  @Put('export-mappings/:mappingId')
  @RequirePermissions({ resource: 'integrations', action: 'update' })
  async updateExportMapping(
    @Param('mappingId', ParseIntPipe) mappingId: number,
    @Body() dto: UpdateExportMappingDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} updating export mapping ${mappingId}`);
    return this.connectionService.updateExportMapping(effectiveUserId, mappingId, dto);
  }

  @Delete('export-mappings/:mappingId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions({ resource: 'integrations', action: 'delete' })
  async deleteExportMapping(
    @Param('mappingId', ParseIntPipe) mappingId: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} deleting export mapping ${mappingId}`);
    await this.connectionService.deleteExportMapping(effectiveUserId, mappingId);
  }

  // ===== Import Mapping Management =====

  @Post(':connectionId/import-mappings')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ resource: 'integrations', action: 'create' })
  async createImportMapping(
    @Param('connectionId', ParseIntPipe) connectionId: number,
    @Body() dto: CreateImportMappingDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(
      `User ${user.id} creating import mapping for connection ${connectionId}`,
    );
    dto.connectionId = connectionId; // Ensure consistency
    return this.connectionService.createImportMapping(effectiveUserId, dto);
  }

  @Get(':connectionId/import-mappings')
  @RequirePermissions({ resource: 'integrations', action: 'read' })
  async getImportMappings(
    @Param('connectionId', ParseIntPipe) connectionId: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.connectionService.getImportMappings(effectiveUserId, connectionId);
  }

  @Get(':connectionId/import-mappings/active')
  @RequirePermissions({ resource: 'integrations', action: 'read' })
  async getActiveImportMapping(
    @Param('connectionId', ParseIntPipe) connectionId: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.connectionService.getActiveImportMapping(effectiveUserId, connectionId);
  }

  @Get(':connectionId/woocommerce-attributes')
  @RequirePermissions({ resource: 'integrations', action: 'read' })
  async getWooCommerceAttributes(
    @Param('connectionId', ParseIntPipe) connectionId: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} fetching WooCommerce attributes for connection ${connectionId}`);
    return this.connectionService.getWooCommerceAttributes(effectiveUserId, connectionId);
  }

  @Put('import-mappings/:mappingId')
  @RequirePermissions({ resource: 'integrations', action: 'update' })
  async updateImportMapping(
    @Param('mappingId', ParseIntPipe) mappingId: number,
    @Body() dto: UpdateImportMappingDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} updating import mapping ${mappingId}`);
    return this.connectionService.updateImportMapping(effectiveUserId, mappingId, dto);
  }

  @Delete('import-mappings/:mappingId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions({ resource: 'integrations', action: 'delete' })
  async deleteImportMapping(
    @Param('mappingId', ParseIntPipe) mappingId: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} deleting import mapping ${mappingId}`);
    await this.connectionService.deleteImportMapping(effectiveUserId, mappingId);
  }

  // ===== Product Sync Operations =====

  @Post('export')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'integrations', action: 'export' })
  async exportProducts(
    @Body() dto: ExportProductsDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(
      `User ${user.id} exporting ${dto.productIds.length} products to connection ${dto.connectionId}`,
    );
    return this.multiStoreService.exportProducts(effectiveUserId, dto);
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'integrations', action: 'import' })
  async importProducts(
    @Body() dto: ImportProductsDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(
      `User ${user.id} importing products from connection ${dto.connectionId}`,
    );
    return this.multiStoreService.importProducts(effectiveUserId, dto);
  }

  @Put(':connectionId/products/:productId')
  @RequirePermissions({ resource: 'integrations', action: 'update' })
  async updateProduct(
    @Param('connectionId', ParseIntPipe) connectionId: number,
    @Param('productId', ParseIntPipe) productId: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(
      `User ${user.id} updating product ${productId} in connection ${connectionId}`,
    );
    return this.multiStoreService.updateProduct(effectiveUserId, connectionId, productId);
  }

  @Delete(':connectionId/products/:productId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'integrations', action: 'delete' })
  async deleteProduct(
    @Param('connectionId', ParseIntPipe) connectionId: number,
    @Param('productId', ParseIntPipe) productId: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(
      `User ${user.id} deleting product ${productId} from connection ${connectionId}`,
    );
    return this.multiStoreService.deleteProduct(effectiveUserId, connectionId, productId);
  }

  @Get(':connectionId/sync-stats')
  @RequirePermissions({ resource: 'integrations', action: 'read' })
  async getSyncStats(
    @Param('connectionId', ParseIntPipe) connectionId: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.multiStoreService.getSyncStats(effectiveUserId, connectionId);
  }

  @Get(':connectionId/sync-status')
  @RequirePermissions({ resource: 'integrations', action: 'read' })
  async getSyncStatus(
    @Param('connectionId', ParseIntPipe) connectionId: number,
    @Query() paginationDto: PaginationDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.multiStoreService.getSyncStatus(effectiveUserId, connectionId, undefined, paginationDto);
  }

  // ===== Sync Logs Management =====

  @Get('sync-logs/list')
  @RequirePermissions({ resource: 'integrations', action: 'read' })
  async getSyncLogs(
    @Query('connectionId') connectionId: string | undefined,
    @Query('productId') productId: string | undefined,
    @Query('wooProductId') wooProductId: string | undefined,
    @Query('sku') sku: string | undefined,
    @Query('syncStatus') syncStatus: string | undefined,
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('search') search: string | undefined,
    @Query('sortBy') sortBy: string | undefined,
    @Query('sortOrder') sortOrder: string | undefined,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.multiStoreService.getSyncLogs(effectiveUserId, {
      connectionId: connectionId ? parseInt(connectionId, 10) : undefined,
      productId: productId ? parseInt(productId, 10) : undefined,
      wooProductId: wooProductId ? parseInt(wooProductId, 10) : undefined,
      sku: sku || undefined,
      syncStatus: syncStatus || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search: search || undefined,
      sortBy: sortBy || undefined,
      sortOrder: (sortOrder as 'asc' | 'desc') || undefined,
    });
  }

  @Post('sync-logs/hide')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'integrations', action: 'update' })
  async hideSyncLogs(
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} hiding WooCommerce sync logs`);
    return this.multiStoreService.hideSyncLogs(effectiveUserId);
  }

  @Delete('sync-logs')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'integrations', action: 'delete' })
  async deleteSyncLogs(
    @Query('ids') ids: string | undefined,
    @Query('connectionId') connectionId: string | undefined,
    @Query('productId') productId: string | undefined,
    @Query('syncStatus') syncStatus: string | undefined,
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} deleting WooCommerce sync logs`);
    
    // Parse comma-separated IDs if provided
    const parsedIds = ids ? ids.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id)) : undefined;
    
    return this.multiStoreService.deleteSyncLogs(effectiveUserId, {
      ids: parsedIds,
      connectionId: connectionId ? parseInt(connectionId, 10) : undefined,
      productId: productId ? parseInt(productId, 10) : undefined,
      syncStatus: syncStatus || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
  }
}
