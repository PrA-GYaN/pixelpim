import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
  Put,
  Patch,
  Delete,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { MyDealConnectionService } from './mydeal-connection.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OwnershipGuard } from '../../auth/guards/ownership.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { User as GetUser } from '../../auth/decorators/user.decorator';
import { EffectiveUserId } from '../../auth/decorators/effective-user-id.decorator';
import type { User } from '@prisma/client';
import { IsString, IsOptional } from 'class-validator';
import {
  CreateMyDealExportMappingDto,
  UpdateMyDealExportMappingDto,
  CreateMyDealImportMappingDto,
  UpdateMyDealImportMappingDto,
} from './dto/mydeal-mapping.dto';

class MyDealCredentialsDto {
  @IsString()
  connectionName: string;

  @IsString()
  baseApiUrl: string;

  @IsString()
  clientId: string;

  @IsString()
  clientSecret: string;

  @IsString()
  sellerId: string;

  @IsString()
  sellerToken: string;

  @IsOptional()
  isDefault?: boolean;
}

class TestConnectionDto {
  @IsOptional()
  connectionId?: number;

  @IsString()
  @IsOptional()
  baseApiUrl?: string;

  @IsString()
  @IsOptional()
  clientId?: string;

  @IsString()
  @IsOptional()
  clientSecret?: string;

  @IsString()
  @IsOptional()
  sellerId?: string;

  @IsString()
  @IsOptional()
  sellerToken?: string;
}

@Controller('integration/mydeal/connections')
export class MyDealConnectionController {
  private readonly logger = new Logger(MyDealConnectionController.name);

  constructor(
    private readonly connectionService: MyDealConnectionService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ resource: 'integration', action: 'create' })
  async createConnection(
    @Body() credentialsDto: MyDealCredentialsDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} creating MyDeal connection`);

    const connection = await this.connectionService.saveCredentials(
      effectiveUserId,
      credentialsDto,
    );

    return {
      success: true,
      connection,
    };
  }

  @Put()
  @UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'integration', action: 'update' })
  async updateConnection(
    @Body() credentialsDto: MyDealCredentialsDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} updating MyDeal connection`);

    const connection = await this.connectionService.updateCredentials(
      effectiveUserId,
      credentialsDto,
    );

    return {
      success: true,
      connection,
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'integration', action: 'read' })
  async getConnections(
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} fetching MyDeal connections`);

    const result = await this.connectionService.getCredentials(effectiveUserId);

    return result.connections;
  }

  @Get(':connectionId')
  @UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'integration', action: 'read' })
  async getConnection(
    @Param('connectionId', ParseIntPipe) connectionId: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} fetching MyDeal connection ${connectionId}`);

    const connection = await this.connectionService.getConnectionById(effectiveUserId, connectionId);

    return connection;
  }

  @Delete(':connectionId')
  @UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'integration', action: 'delete' })
  async deleteConnection(
    @Param('connectionId', ParseIntPipe) connectionId: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} deleting MyDeal connection ${connectionId}`);

    await this.connectionService.deleteCredentials(effectiveUserId, connectionId);

    return {
      success: true,
      message: 'MyDeal connection deleted successfully',
    };
  }

  @Patch(':connectionId/set-default')
  @UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'integration', action: 'update' })
  async setConnectionAsDefault(
    @Param('connectionId', ParseIntPipe) connectionId: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} setting MyDeal connection ${connectionId} as default`);

    const connection = await this.connectionService.setConnectionAsDefault(
      effectiveUserId,
      connectionId,
    );

    return {
      success: true,
      connection,
    };
  }

  @Post('test')
  @UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'integration', action: 'read' })
  async testConnection(
    @Body() testDto: TestConnectionDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} testing MyDeal connection`);

    const result = await this.connectionService.testConnection(
      effectiveUserId,
      testDto,
    );

    return result;
  }

  // ===== Export Mapping Management =====

  @Post(':connectionId/export-mappings')
  @UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ resource: 'integration', action: 'create' })
  async createExportMapping(
    @Param('connectionId', ParseIntPipe) connectionId: number,
    @Body() dto: CreateMyDealExportMappingDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} creating export mapping for MyDeal connection ${connectionId}`);
    dto.connectionId = connectionId;
    return this.connectionService.createExportMapping(effectiveUserId, dto);
  }

  @Get(':connectionId/export-mappings')
  @UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
  @RequirePermissions({ resource: 'integration', action: 'read' })
  async getExportMappings(
    @Param('connectionId', ParseIntPipe) connectionId: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.connectionService.getExportMappings(effectiveUserId, connectionId);
  }

  @Get(':connectionId/export-mappings/active')
  @UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
  @RequirePermissions({ resource: 'integration', action: 'read' })
  async getActiveExportMapping(
    @Param('connectionId', ParseIntPipe) connectionId: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.connectionService.getActiveExportMapping(effectiveUserId, connectionId);
  }

  @Put('export-mappings/:mappingId')
  @UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
  @RequirePermissions({ resource: 'integration', action: 'update' })
  async updateExportMapping(
    @Param('mappingId', ParseIntPipe) mappingId: number,
    @Body() dto: UpdateMyDealExportMappingDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} updating MyDeal export mapping ${mappingId}`);
    return this.connectionService.updateExportMapping(effectiveUserId, mappingId, dto);
  }

  @Delete('export-mappings/:mappingId')
  @UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions({ resource: 'integration', action: 'delete' })
  async deleteExportMapping(
    @Param('mappingId', ParseIntPipe) mappingId: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} deleting MyDeal export mapping ${mappingId}`);
    await this.connectionService.deleteExportMapping(effectiveUserId, mappingId);
  }

  // ===== Import Mapping Management =====

  @Post(':connectionId/import-mappings')
  @UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ resource: 'integration', action: 'create' })
  async createImportMapping(
    @Param('connectionId', ParseIntPipe) connectionId: number,
    @Body() dto: CreateMyDealImportMappingDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} creating import mapping for MyDeal connection ${connectionId}`);
    dto.connectionId = connectionId;
    return this.connectionService.createImportMapping(effectiveUserId, dto);
  }

  @Get(':connectionId/import-mappings')
  @UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
  @RequirePermissions({ resource: 'integration', action: 'read' })
  async getImportMappings(
    @Param('connectionId', ParseIntPipe) connectionId: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.connectionService.getImportMappings(effectiveUserId, connectionId);
  }

  @Get(':connectionId/import-mappings/active')
  @UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
  @RequirePermissions({ resource: 'integration', action: 'read' })
  async getActiveImportMapping(
    @Param('connectionId', ParseIntPipe) connectionId: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.connectionService.getActiveImportMapping(effectiveUserId, connectionId);
  }

  @Put('import-mappings/:mappingId')
  @UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
  @RequirePermissions({ resource: 'integration', action: 'update' })
  async updateImportMapping(
    @Param('mappingId', ParseIntPipe) mappingId: number,
    @Body() dto: UpdateMyDealImportMappingDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} updating MyDeal import mapping ${mappingId}`);
    return this.connectionService.updateImportMapping(effectiveUserId, mappingId, dto);
  }

  @Delete('import-mappings/:mappingId')
  @UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions({ resource: 'integration', action: 'delete' })
  async deleteImportMapping(
    @Param('mappingId', ParseIntPipe) mappingId: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} deleting MyDeal import mapping ${mappingId}`);
    await this.connectionService.deleteImportMapping(effectiveUserId, mappingId);
  }

  // ===== Sync Logs Management =====

  @Get('sync-logs/list')
  @UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
  @RequirePermissions({ resource: 'integration', action: 'read' })
  async getSyncLogs(
    @Query('connectionId', ParseIntPipe) connectionId: number,
    @Query('operation') operation: string | undefined,
    @Query('status') status: string | undefined,
    @Query('productId') productId: string | undefined,
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} fetching MyDeal sync logs for connection ${connectionId}`);
    return this.connectionService.getSyncLogs(effectiveUserId, {
      connectionId,
      operation: operation || undefined,
      status: status || undefined,
      productId: productId ? parseInt(productId, 10) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post('sync-logs/hide')
  @UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'integration', action: 'update' })
  async hideSyncLogs(
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} hiding MyDeal sync logs`);
    return this.connectionService.hideSyncLogs(effectiveUserId);
  }
}
