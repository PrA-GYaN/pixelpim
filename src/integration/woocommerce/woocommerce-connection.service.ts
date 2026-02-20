import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api';
import {
  CreateWooCommerceConnectionDto,
  UpdateWooCommerceConnectionDto,
  WooCommerceConnectionResponseDto,
  TestConnectionDto,
  TestConnectionResponseDto,
  CreateExportMappingDto,
  UpdateExportMappingDto,
  ExportMappingResponseDto,
  CreateImportMappingDto,
  UpdateImportMappingDto,
  ImportMappingResponseDto,
} from './dto/woocommerce-connection.dto';

@Injectable()
export class WooCommerceConnectionService {
  private readonly logger = new Logger(WooCommerceConnectionService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new WooCommerce connection for a user
   */
  async createConnection(
    userId: number,
    dto: CreateWooCommerceConnectionDto,
  ): Promise<WooCommerceConnectionResponseDto> {
    // Check if connection with same URL already exists for this user
    const existing = await this.prisma.wooCommerceConnection.findFirst({
      where: {
        userId,
        storeUrl: dto.storeUrl,
      },
    });

    if (existing) {
      throw new ConflictException('A connection with this store URL already exists');
    }

    // If this is set as default, unset other defaults
    if (dto.isDefault) {
      await this.prisma.wooCommerceConnection.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const connection = await this.prisma.wooCommerceConnection.create({
      data: {
        userId,
        storeName: dto.storeName,
        storeUrl: dto.storeUrl,
        consumerKey: dto.consumerKey,
        consumerSecret: dto.consumerSecret,
        webhookSecret: dto.webhookSecret,
        isDefault: dto.isDefault ?? false,
      },
    });

    return this.toResponseDto(connection);
  }

  /**
   * Get all connections for a user
   */
  async getConnections(userId: number): Promise<WooCommerceConnectionResponseDto[]> {
    const connections = await this.prisma.wooCommerceConnection.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return connections.map((conn) => this.toResponseDto(conn));
  }

  /**
   * Get a specific connection by ID
   */
  async getConnection(
    userId: number,
    connectionId: number,
  ): Promise<WooCommerceConnectionResponseDto> {
    const connection = await this.prisma.wooCommerceConnection.findFirst({
      where: { id: connectionId, userId },
    });

    if (!connection) {
      throw new NotFoundException('Connection not found');
    }

    return this.toResponseDto(connection);
  }

  /**
   * Get default connection for a user
   */
  async getDefaultConnection(userId: number): Promise<WooCommerceConnectionResponseDto> {
    const connection = await this.prisma.wooCommerceConnection.findFirst({
      where: { userId, isDefault: true, isActive: true },
    });

    if (!connection) {
      // If no default, return the first active connection
      const firstConnection = await this.prisma.wooCommerceConnection.findFirst({
        where: { userId, isActive: true },
        orderBy: { createdAt: 'desc' },
      });

      if (!firstConnection) {
        throw new NotFoundException('No active WooCommerce connections found');
      }

      return this.toResponseDto(firstConnection);
    }

    return this.toResponseDto(connection);
  }

  /**
   * Update a WooCommerce connection
   */
  async updateConnection(
    userId: number,
    connectionId: number,
    dto: UpdateWooCommerceConnectionDto,
  ): Promise<WooCommerceConnectionResponseDto> {
    const connection = await this.prisma.wooCommerceConnection.findFirst({
      where: { id: connectionId, userId },
    });

    if (!connection) {
      throw new NotFoundException('Connection not found');
    }

    // If setting as default, unset other defaults
    if (dto.isDefault) {
      await this.prisma.wooCommerceConnection.updateMany({
        where: { userId, isDefault: true, id: { not: connectionId } },
        data: { isDefault: false },
      });
    }

    const updated = await this.prisma.wooCommerceConnection.update({
      where: { id: connectionId },
      data: {
        storeName: dto.storeName,
        storeUrl: dto.storeUrl,
        consumerKey: dto.consumerKey,
        consumerSecret: dto.consumerSecret,
        webhookSecret: dto.webhookSecret,
        isActive: dto.isActive,
        isDefault: dto.isDefault,
      },
    });

    return this.toResponseDto(updated);
  }

  /**
   * Delete a WooCommerce connection
   */
  async deleteConnection(userId: number, connectionId: number): Promise<void> {
    const connection = await this.prisma.wooCommerceConnection.findFirst({
      where: { id: connectionId, userId },
    });

    if (!connection) {
      throw new NotFoundException('Connection not found');
    }

    await this.prisma.wooCommerceConnection.delete({
      where: { id: connectionId },
    });

    this.logger.log(`Connection ${connectionId} deleted for user ${userId}`);
  }

  /**
   * Test a WooCommerce connection
   */
  async testConnection(dto: TestConnectionDto): Promise<TestConnectionResponseDto> {
    try {
      let baseUrl = dto.storeUrl.trim().replace(/\/wp-json.*$/, '');
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        const isLocal =
          baseUrl.includes('localhost') ||
          baseUrl.includes('127.0.0.1') ||
          baseUrl.includes('.local');
        baseUrl = isLocal ? `http://${baseUrl}` : `https://${baseUrl}`;
      }

      const isHttps = baseUrl.startsWith('https://');
      const wooCommerce = new WooCommerceRestApi({
        url: baseUrl,
        consumerKey: dto.consumerKey,
        consumerSecret: dto.consumerSecret,
        version: 'wc/v3',
        queryStringAuth: !isHttps,
      });

      const response = await wooCommerce.get('system_status');
      const data = response.data;

      return {
        success: true,
        message: 'Connection successful',
        storeInfo: {
          wpVersion: data.environment?.wp_version,
          wooVersion: data.environment?.version,
          storeName: data.settings?.general_store_name || baseUrl,
        },
      };
    } catch (error: any) {
      this.logger.error('Connection test failed:', error);
      return {
        success: false,
        message:
          error.response?.data?.message ||
          error.message ||
          'Failed to connect to WooCommerce store',
      };
    }
  }

  /**
   * Get WooCommerce API client for a connection
   */
  async getWooCommerceClient(
    userId: number,
    connectionId: number,
  ): Promise<WooCommerceRestApi> {
    const connection = await this.prisma.wooCommerceConnection.findFirst({
      where: { id: connectionId, userId, isActive: true },
    });

    if (!connection) {
      throw new NotFoundException('Active connection not found');
    }

    let baseUrl = connection.storeUrl.trim().replace(/\/wp-json.*$/, '');
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      const isLocal =
        baseUrl.includes('localhost') ||
        baseUrl.includes('127.0.0.1') ||
        baseUrl.includes('.local');
      baseUrl = isLocal ? `http://${baseUrl}` : `https://${baseUrl}`;
    }

    const isHttps = baseUrl.startsWith('https://');
    return new WooCommerceRestApi({
      url: baseUrl,
      consumerKey: connection.consumerKey,
      consumerSecret: connection.consumerSecret,
      version: 'wc/v3',
      queryStringAuth: !isHttps,
    });
  }

  /**
   * Update last synced timestamp
   */
  async updateLastSynced(connectionId: number): Promise<void> {
    await this.prisma.wooCommerceConnection.update({
      where: { id: connectionId },
      data: { lastSyncedAt: new Date() },
    });
  }

  // ===== Export Mapping Methods =====

  /**
   * Create export mapping for a connection
   */
  async createExportMapping(
    userId: number,
    dto: CreateExportMappingDto,
  ): Promise<ExportMappingResponseDto> {
    // Verify connection exists and belongs to user
    await this.getConnection(userId, dto.connectionId);

    // Validate that required fields are included
    if (!dto.selectedFields.includes('name') || !dto.selectedFields.includes('sku')) {
      throw new BadRequestException('Export mapping must include "name" and "sku" fields');
    }

    const mapping = await this.prisma.wooCommerceExportMapping.create({
      data: {
        connectionId: dto.connectionId,
        selectedFields: dto.selectedFields,
        fieldMappings: dto.fieldMappings || {},
      },
    });

    return this.toExportMappingResponseDto(mapping);
  }

  /**
   * Get export mappings for a connection
   */
  async getExportMappings(
    userId: number,
    connectionId: number,
  ): Promise<ExportMappingResponseDto[]> {
    // Verify connection exists and belongs to user
    await this.getConnection(userId, connectionId);

    const mappings = await this.prisma.wooCommerceExportMapping.findMany({
      where: { connectionId },
      orderBy: { createdAt: 'desc' },
    });

    return mappings.map((m) => this.toExportMappingResponseDto(m));
  }

  /**
   * Get active export mapping for a connection
   */
  async getActiveExportMapping(
    userId: number,
    connectionId: number,
  ): Promise<ExportMappingResponseDto | null> {
    // Verify connection exists and belongs to user
    await this.getConnection(userId, connectionId);

    const mapping = await this.prisma.wooCommerceExportMapping.findFirst({
      where: { connectionId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    return mapping ? this.toExportMappingResponseDto(mapping) : null;
  }

  /**
   * Update export mapping
   */
  async updateExportMapping(
    userId: number,
    mappingId: number,
    dto: UpdateExportMappingDto,
  ): Promise<ExportMappingResponseDto> {
    const mapping = await this.prisma.wooCommerceExportMapping.findUnique({
      where: { id: mappingId },
      include: { connection: true },
    });

    if (!mapping || mapping.connection.userId !== userId) {
      throw new NotFoundException('Export mapping not found');
    }

    // Validate required fields if selectedFields is being updated
    if (dto.selectedFields) {
      if (!dto.selectedFields.includes('name') || !dto.selectedFields.includes('sku')) {
        throw new BadRequestException('Export mapping must include "name" and "sku" fields');
      }
    }

    const updated = await this.prisma.wooCommerceExportMapping.update({
      where: { id: mappingId },
      data: {
        selectedFields: dto.selectedFields,
        fieldMappings: dto.fieldMappings,
        isActive: dto.isActive,
      },
    });

    return this.toExportMappingResponseDto(updated);
  }

  /**
   * Delete export mapping
   */
  async deleteExportMapping(userId: number, mappingId: number): Promise<void> {
    const mapping = await this.prisma.wooCommerceExportMapping.findUnique({
      where: { id: mappingId },
      include: { connection: true },
    });

    if (!mapping || mapping.connection.userId !== userId) {
      throw new NotFoundException('Export mapping not found');
    }

    await this.prisma.wooCommerceExportMapping.delete({
      where: { id: mappingId },
    });
  }

  // ===== Import Mapping Methods =====

  /**
   * Create import mapping for a connection
   */
  async createImportMapping(
    userId: number,
    dto: CreateImportMappingDto,
  ): Promise<ImportMappingResponseDto> {
    // Verify connection exists and belongs to user
    await this.getConnection(userId, dto.connectionId);

    const mapping = await this.prisma.wooCommerceImportMapping.create({
      data: {
        connectionId: dto.connectionId,
        attributeMappings: dto.attributeMappings,
        fieldMappings: dto.fieldMappings || {},
      },
    });

    return this.toImportMappingResponseDto(mapping);
  }

  /**
   * Get import mappings for a connection
   */
  async getImportMappings(
    userId: number,
    connectionId: number,
  ): Promise<ImportMappingResponseDto[]> {
    // Verify connection exists and belongs to user
    await this.getConnection(userId, connectionId);

    const mappings = await this.prisma.wooCommerceImportMapping.findMany({
      where: { connectionId },
      orderBy: { createdAt: 'desc' },
    });

    return mappings.map((m) => this.toImportMappingResponseDto(m));
  }

  /**
   * Get active import mapping for a connection
   */
  async getActiveImportMapping(
    userId: number,
    connectionId: number,
  ): Promise<ImportMappingResponseDto | null> {
    // Verify connection exists and belongs to user
    await this.getConnection(userId, connectionId);

    const mapping = await this.prisma.wooCommerceImportMapping.findFirst({
      where: { connectionId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    return mapping ? this.toImportMappingResponseDto(mapping) : null;
  }

  /**
   * Update import mapping
   */
  async updateImportMapping(
    userId: number,
    mappingId: number,
    dto: UpdateImportMappingDto,
  ): Promise<ImportMappingResponseDto> {
    const mapping = await this.prisma.wooCommerceImportMapping.findUnique({
      where: { id: mappingId },
      include: { connection: true },
    });

    if (!mapping || mapping.connection.userId !== userId) {
      throw new NotFoundException('Import mapping not found');
    }

    const updated = await this.prisma.wooCommerceImportMapping.update({
      where: { id: mappingId },
      data: {
        attributeMappings: dto.attributeMappings,
        fieldMappings: dto.fieldMappings,
        isActive: dto.isActive,
      },
    });

    return this.toImportMappingResponseDto(updated);
  }

  /**
   * Delete import mapping
   */
  async deleteImportMapping(userId: number, mappingId: number): Promise<void> {
    const mapping = await this.prisma.wooCommerceImportMapping.findUnique({
      where: { id: mappingId },
      include: { connection: true },
    });

    if (!mapping || mapping.connection.userId !== userId) {
      throw new NotFoundException('Import mapping not found');
    }

    await this.prisma.wooCommerceImportMapping.delete({
      where: { id: mappingId },
    });
  }

  /**
   * Get WooCommerce product attributes from the store
   */
  async getWooCommerceAttributes(
    userId: number,
    connectionId: number,
  ): Promise<{ success: boolean; attributes: any[] }> {
    try {
      // Get the WooCommerce client
      const wooClient = await this.getWooCommerceClient(userId, connectionId);

      // Fetch product attributes from WooCommerce
      const response = await wooClient.get('products/attributes', {
        per_page: 100, // Fetch up to 100 attributes
      });

      const attributes = response.data || [];

      this.logger.log(`Fetched ${attributes.length} WooCommerce attributes for connection ${connectionId}`);

      return {
        success: true,
        attributes: attributes.map((attr: any) => ({
          id: attr.id,
          name: attr.name,
          slug: attr.slug,
          type: attr.type,
          orderBy: attr.order_by,
          hasArchives: attr.has_archives,
        })),
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch WooCommerce attributes for connection ${connectionId}:`,
        error.response?.data || error.message
      );
      return {
        success: false,
        attributes: [],
      };
    }
  }

  // ===== Helper Methods =====

  private toResponseDto(connection: any): WooCommerceConnectionResponseDto {
    return {
      id: connection.id,
      storeName: connection.storeName,
      storeUrl: connection.storeUrl,
      isActive: connection.isActive,
      isDefault: connection.isDefault,
      lastSyncedAt: connection.lastSyncedAt,
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt,
    };
  }

  private toExportMappingResponseDto(mapping: any): ExportMappingResponseDto {
    return {
      id: mapping.id,
      connectionId: mapping.connectionId,
      selectedFields: mapping.selectedFields,
      fieldMappings: mapping.fieldMappings as Record<string, any>,
      isActive: mapping.isActive,
      createdAt: mapping.createdAt,
      updatedAt: mapping.updatedAt,
    };
  }

  private toImportMappingResponseDto(mapping: any): ImportMappingResponseDto {
    return {
      id: mapping.id,
      connectionId: mapping.connectionId,
      attributeMappings: mapping.attributeMappings as Record<string, any>,
      fieldMappings: mapping.fieldMappings as Record<string, any>,
      isActive: mapping.isActive,
      createdAt: mapping.createdAt,
      updatedAt: mapping.updatedAt,
    };
  }
}
