import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import axios from 'axios';
import {
  CreateMyDealExportMappingDto,
  UpdateMyDealExportMappingDto,
  CreateMyDealImportMappingDto,
  UpdateMyDealImportMappingDto,
  MyDealExportMappingResponseDto,
  MyDealImportMappingResponseDto,
} from './dto/mydeal-mapping.dto';

@Injectable()
export class MyDealConnectionService {
  private readonly logger = new Logger(MyDealConnectionService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Save MyDeal credentials for a user
   */
  async saveCredentials(
    userId: number,
    credentials: {
      connectionName: string;
      baseApiUrl: string;
      clientId: string;
      clientSecret: string;
      sellerId: string;
      sellerToken: string;
      isDefault?: boolean;
    },
  ) {
    try {
      // Test the connection before saving
      const isValid = await this.validateCredentials(credentials);
      
      if (!isValid) {
        throw new BadRequestException('Invalid MyDeal credentials');
      }

      // If setting as default, unset other default connections
      if (credentials.isDefault) {
        await this.prisma.myDealConnection.updateMany({
          where: {
            userId,
            isDefault: true,
          },
          data: {
            isDefault: false,
          },
        });
      }

      // Save or update connection
      const savedConnection = await this.prisma.myDealConnection.upsert({
        where: {
          userId_baseApiUrl: {
            userId,
            baseApiUrl: credentials.baseApiUrl,
          },
        },
        create: {
          userId,
          connectionName: credentials.connectionName,
          baseApiUrl: credentials.baseApiUrl,
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret,
          sellerId: credentials.sellerId,
          sellerToken: credentials.sellerToken,
          isActive: true,
          isDefault: credentials.isDefault ?? false,
        },
        update: {
          connectionName: credentials.connectionName,
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret,
          sellerId: credentials.sellerId,
          sellerToken: credentials.sellerToken,
          isActive: true,
          isDefault: credentials.isDefault ?? false,
          updatedAt: new Date(),
        },
      });

      this.logger.log(`MyDeal connection saved for user ${userId}`);

      return {
        id: savedConnection.id,
        connectionName: savedConnection.connectionName,
        isActive: savedConnection.isActive,
        isDefault: savedConnection.isDefault,
        createdAt: savedConnection.createdAt,
        updatedAt: savedConnection.updatedAt,
        // Don't return sensitive credentials
        hasCredentials: true,
      };
    } catch (error: any) {
      this.logger.error(`Failed to save MyDeal connection:`, error);
      throw error;
    }
  }

  /**
   * Update MyDeal connection for a user
   */
  async updateCredentials(
    userId: number,
    credentials: {
      connectionName: string;
      baseApiUrl: string;
      clientId: string;
      clientSecret: string;
      sellerId: string;
      sellerToken: string;
      isDefault?: boolean;
    },
  ) {
    return this.saveCredentials(userId, credentials);
  }

  /**
   * Get MyDeal connections for a user (without sensitive data)
   */
  async getCredentials(userId: number) {
    const connections = await this.prisma.myDealConnection.findMany({
      where: {
        userId,
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    if (!connections || connections.length === 0) {
      return {
        hasCredentials: false,
        connections: [],
      };
    }

    return {
      hasCredentials: true,
      connections: connections.map(conn => ({
        id: conn.id,
        connectionName: conn.connectionName,
        isActive: conn.isActive,
        isDefault: conn.isDefault,
        createdAt: conn.createdAt,
        updatedAt: conn.updatedAt,
        lastSyncedAt: conn.lastSyncedAt,
        // Return non-sensitive info
        baseApiUrl: conn.baseApiUrl,
        sellerId: conn.sellerId,
      })),
    };
  }

  /**
   * Get a specific MyDeal connection by ID
   */
  async getConnectionById(userId: number, connectionId: number) {
    const connection = await this.prisma.myDealConnection.findFirst({
      where: {
        id: connectionId,
        userId,
      },
    });

    if (!connection) {
      throw new NotFoundException('MyDeal connection not found');
    }

    return {
      id: connection.id,
      connectionName: connection.connectionName,
      isActive: connection.isActive,
      isDefault: connection.isDefault,
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt,
      lastSyncedAt: connection.lastSyncedAt,
      baseApiUrl: connection.baseApiUrl,
      sellerId: connection.sellerId,
    };
  }

  /**
   * Delete MyDeal connection for a user
   */
  async deleteCredentials(userId: number, connectionId: number) {
    try {
      // Verify connection belongs to user
      const connection = await this.prisma.myDealConnection.findFirst({
        where: {
          id: connectionId,
          userId,
        },
      });

      if (!connection) {
        throw new NotFoundException('MyDeal connection not found');
      }

      await this.prisma.myDealConnection.delete({
        where: {
          id: connectionId,
        },
      });

      this.logger.log(`MyDeal connection ${connectionId} deleted for user ${userId}`);
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException('MyDeal connection not found');
      }
      throw error;
    }
  }

  /**
   * Test MyDeal connection
   */
  async testConnection(
    userId: number,
    testCredentials?: {
      connectionId?: number;
      baseApiUrl?: string;
      clientId?: string;
      clientSecret?: string;
      sellerId?: string;
      sellerToken?: string;
    },
  ) {
    try {
      let credentials: any;

      if (testCredentials && testCredentials.baseApiUrl) {
        // Test with provided credentials
        credentials = testCredentials;
      } else if (testCredentials?.connectionId) {
        // Test with specific connection
        const connection = await this.prisma.myDealConnection.findFirst({
          where: {
            id: testCredentials.connectionId,
            userId,
          },
        });

        if (!connection) {
          throw new NotFoundException('MyDeal connection not found');
        }

        credentials = {
          baseApiUrl: connection.baseApiUrl,
          clientId: connection.clientId,
          clientSecret: connection.clientSecret,
          sellerId: connection.sellerId,
          sellerToken: connection.sellerToken,
        };
      } else {
        // Test with default or first active connection
        const connection = await this.prisma.myDealConnection.findFirst({
          where: {
            userId,
            isActive: true,
          },
          orderBy: [
            { isDefault: 'desc' },
            { createdAt: 'asc' },
          ],
        });

        if (!connection) {
          throw new NotFoundException('MyDeal connection not found');
        }

        credentials = {
          baseApiUrl: connection.baseApiUrl,
          clientId: connection.clientId,
          clientSecret: connection.clientSecret,
          sellerId: connection.sellerId,
          sellerToken: connection.sellerToken,
        };
      }

      const isValid = await this.validateCredentials(credentials);

      if (isValid) {
        return {
          success: true,
          message: 'MyDeal connection successful',
          status: 'connected',
        };
      } else {
        return {
          success: false,
          message: 'MyDeal connection failed',
          status: 'failed',
        };
      }
    } catch (error: any) {
      this.logger.error('MyDeal connection test failed:', error);
      return {
        success: false,
        message: error.message || 'MyDeal connection test failed',
        status: 'failed',
        error: error.response?.data || error.message,
      };
    }
  }

  /**
   * Validate MyDeal credentials by getting an access token
   */
  private async validateCredentials(credentials: {
    baseApiUrl: string;
    clientId: string;
    clientSecret: string;
    sellerId: string;
    sellerToken: string;
  }): Promise<boolean> {
    try {
      const { baseApiUrl, clientId, clientSecret, sellerId, sellerToken } = credentials;

      this.logger.debug('Testing MyDeal connection with credentials:', credentials);
      // Try to get an access token
      // const tokenResponse = await axios.post(
      //   `${baseApiUrl}/mydealaccesstoken`,
      //   new URLSearchParams({
      //     grant_type: 'client_credentials',
      //     client_Id: clientId,
      //     client_secret: clientSecret,
      //   }),
      //   {
      //     headers: {
      //       'Content-Type': 'application/x-www-form-urlencoded',
      //     },
      //     timeout: 10000, // 10 second timeout
      //   }
      // );

      try {
        this.logger.debug('Using try catch block');
        const body = new URLSearchParams();
        body.append('grant_type', 'client_credentials');
        body.append('client_Id', clientId);       // exact casing required by MyDeal
        body.append('client_secret', clientSecret);

        const response = await axios.post(
          `${baseApiUrl}/mydealaccesstoken`,
          body.toString(),                        // IMPORTANT
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout: 10000,
          },
        );

        this.logger.debug('MyDeal token response:', response.data);
        return !!response.data?.access_token;

      } catch (error) {
        this.logger.error(
          'MyDeal token request failed',
          {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message,
          },
        );
      }


      // this.logger.debug('Access Token Response:', tokenResponse.data);

      // if (!tokenResponse.data.access_token) {
      //   return false;
      // }

      // Try to make a test API call with the token
      // const testResponse = await axios.get(
      //   `${baseApiUrl}/products`,
      //   {
      //     headers: {
      //       'Authorization': `Bearer ${tokenResponse.data.access_token}`,
      //       'SellerID': sellerId,
      //       'SellerToken': sellerToken,
      //       'Content-Type': 'application/json',
      //     },
      //     params: {
      //       fields: 'ExternalProductId',
      //       page: 1,
      //       limit: 1,
      //     },
      //     timeout: 10000,
      //   }
      // );

      // If we got here without errors, the connection is valid
      // return testResponse.status === 200;
      return true;
    } catch (error: any) {
      this.logger.error('Credential validation failed:', error.response?.data || error.message);
      return false;
    }
  }

  // ===== Export Mapping Management =====

  async createExportMapping(
    userId: number,
    dto: CreateMyDealExportMappingDto,
  ): Promise<MyDealExportMappingResponseDto> {
    // Verify connection exists and belongs to user
    const connection = await this.prisma.myDealConnection.findFirst({
      where: {
        id: dto.connectionId,
        userId,
      },
    });

    if (!connection) {
      throw new NotFoundException('MyDeal connection not found');
    }

    // If setting as active, deactivate other mappings
    if (dto.isActive !== false) {
      await this.prisma.myDealExportMapping.updateMany({
        where: {
          connectionId: dto.connectionId,
          isActive: true,
        },
        data: { isActive: false },
      });
    }

    const mapping = await this.prisma.myDealExportMapping.create({
      data: {
        connectionId: dto.connectionId,
        fieldMappings: dto.fieldMappings as any,
        selectedFields: dto.selectedFields,
        isActive: dto.isActive ?? true,
      },
    });

    return this.toExportMappingDto(mapping);
  }

  async getExportMappings(
    userId: number,
    connectionId: number,
  ): Promise<MyDealExportMappingResponseDto[]> {
    // Verify connection belongs to user
    const connection = await this.prisma.myDealConnection.findFirst({
      where: { id: connectionId, userId },
    });

    if (!connection) {
      throw new NotFoundException('MyDeal connection not found');
    }

    const mappings = await this.prisma.myDealExportMapping.findMany({
      where: { connectionId },
      orderBy: { createdAt: 'desc' },
    });

    return mappings.map((m) => this.toExportMappingDto(m));
  }

  async getActiveExportMapping(
    userId: number,
    connectionId: number,
  ): Promise<MyDealExportMappingResponseDto | null> {
    const connection = await this.prisma.myDealConnection.findFirst({
      where: { id: connectionId, userId },
    });

    if (!connection) {
      throw new NotFoundException('MyDeal connection not found');
    }

    const mapping = await this.prisma.myDealExportMapping.findFirst({
      where: { connectionId, isActive: true },
    });

    return mapping ? this.toExportMappingDto(mapping) : null;
  }

  async updateExportMapping(
    userId: number,
    mappingId: number,
    dto: UpdateMyDealExportMappingDto,
  ): Promise<MyDealExportMappingResponseDto> {
    const mapping = await this.prisma.myDealExportMapping.findFirst({
      where: { id: mappingId },
      include: { connection: true },
    });

    if (!mapping || mapping.connection.userId !== userId) {
      throw new NotFoundException('Export mapping not found');
    }

    // If setting as active, deactivate other mappings
    if (dto.isActive === true) {
      await this.prisma.myDealExportMapping.updateMany({
        where: {
          connectionId: mapping.connectionId,
          isActive: true,
          id: { not: mappingId },
        },
        data: { isActive: false },
      });
    }

    const updated = await this.prisma.myDealExportMapping.update({
      where: { id: mappingId },
      data: {
        fieldMappings: dto.fieldMappings as any,
        selectedFields: dto.selectedFields,
        isActive: dto.isActive,
      },
    });

    return this.toExportMappingDto(updated);
  }

  async deleteExportMapping(userId: number, mappingId: number): Promise<void> {
    const mapping = await this.prisma.myDealExportMapping.findFirst({
      where: { id: mappingId },
      include: { connection: true },
    });

    if (!mapping || mapping.connection.userId !== userId) {
      throw new NotFoundException('Export mapping not found');
    }

    await this.prisma.myDealExportMapping.delete({
      where: { id: mappingId },
    });

    this.logger.log(`MyDeal export mapping ${mappingId} deleted`);
  }

  // ===== Import Mapping Management =====

  async createImportMapping(
    userId: number,
    dto: CreateMyDealImportMappingDto,
  ): Promise<MyDealImportMappingResponseDto> {
    const connection = await this.prisma.myDealConnection.findFirst({
      where: {
        id: dto.connectionId,
        userId,
      },
    });

    if (!connection) {
      throw new NotFoundException('MyDeal connection not found');
    }

    // If setting as active, deactivate other mappings
    if (dto.isActive !== false) {
      await this.prisma.myDealImportMapping.updateMany({
        where: {
          connectionId: dto.connectionId,
          isActive: true,
        },
        data: { isActive: false },
      });
    }

    const mapping = await this.prisma.myDealImportMapping.create({
      data: {
        connectionId: dto.connectionId,
        attributeMappings: dto.attributeMappings as any,
        fieldMappings: dto.fieldMappings as any,
        isActive: dto.isActive ?? true,
      },
    });

    return this.toImportMappingDto(mapping);
  }

  async getImportMappings(
    userId: number,
    connectionId: number,
  ): Promise<MyDealImportMappingResponseDto[]> {
    const connection = await this.prisma.myDealConnection.findFirst({
      where: { id: connectionId, userId },
    });

    if (!connection) {
      throw new NotFoundException('MyDeal connection not found');
    }

    const mappings = await this.prisma.myDealImportMapping.findMany({
      where: { connectionId },
      orderBy: { createdAt: 'desc' },
    });

    return mappings.map((m) => this.toImportMappingDto(m));
  }

  async getActiveImportMapping(
    userId: number,
    connectionId: number,
  ): Promise<MyDealImportMappingResponseDto | null> {
    const connection = await this.prisma.myDealConnection.findFirst({
      where: { id: connectionId, userId },
    });

    if (!connection) {
      throw new NotFoundException('MyDeal connection not found');
    }

    const mapping = await this.prisma.myDealImportMapping.findFirst({
      where: { connectionId, isActive: true },
    });

    return mapping ? this.toImportMappingDto(mapping) : null;
  }

  async updateImportMapping(
    userId: number,
    mappingId: number,
    dto: UpdateMyDealImportMappingDto,
  ): Promise<MyDealImportMappingResponseDto> {
    const mapping = await this.prisma.myDealImportMapping.findFirst({
      where: { id: mappingId },
      include: { connection: true },
    });

    if (!mapping || mapping.connection.userId !== userId) {
      throw new NotFoundException('Import mapping not found');
    }

    // If setting as active, deactivate other mappings
    if (dto.isActive === true) {
      await this.prisma.myDealImportMapping.updateMany({
        where: {
          connectionId: mapping.connectionId,
          isActive: true,
          id: { not: mappingId },
        },
        data: { isActive: false },
      });
    }

    const updated = await this.prisma.myDealImportMapping.update({
      where: { id: mappingId },
      data: {
        attributeMappings: dto.attributeMappings as any,
        fieldMappings: dto.fieldMappings as any,
        isActive: dto.isActive,
      },
    });

    return this.toImportMappingDto(updated);
  }

  async deleteImportMapping(userId: number, mappingId: number): Promise<void> {
    const mapping = await this.prisma.myDealImportMapping.findFirst({
      where: { id: mappingId },
      include: { connection: true },
    });

    if (!mapping || mapping.connection.userId !== userId) {
      throw new NotFoundException('Import mapping not found');
    }

    await this.prisma.myDealImportMapping.delete({
      where: { id: mappingId },
    });

    this.logger.log(`MyDeal import mapping ${mappingId} deleted`);
  }

  // ===== Helper Methods =====

  private toExportMappingDto(mapping: any): MyDealExportMappingResponseDto {
    return {
      id: mapping.id,
      connectionId: mapping.connectionId,
      fieldMappings: mapping.fieldMappings as Record<string, string>,
      selectedFields: mapping.selectedFields,
      isActive: mapping.isActive,
      createdAt: mapping.createdAt,
      updatedAt: mapping.updatedAt,
    };
  }

  private toImportMappingDto(mapping: any): MyDealImportMappingResponseDto {
    return {
      id: mapping.id,
      connectionId: mapping.connectionId,
      attributeMappings: mapping.attributeMappings as Record<string, string>,
      fieldMappings: mapping.fieldMappings as Record<string, string>,
      isActive: mapping.isActive,
      createdAt: mapping.createdAt,
      updatedAt: mapping.updatedAt,
    };
  }

  /**
   * Get MyDeal sync logs with pagination and filtering
   */
  async getSyncLogs(
    userId: number,
    options: {
      connectionId?: number;
      operation?: string;
      status?: string;
      productId?: number;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<{
    logs: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    // Get the user's hidden logs timestamp
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { hiddenMyDealSyncLogsTimestamp: true },
    });

    // Build the where clause
    const where: any = {
      userId,
    };

    // Filter by connection if specified
    if (options.connectionId) {
      where.connectionId = options.connectionId;
    }

    // Filter by operation if specified
    if (options.operation) {
      where.operation = options.operation;
    }

    // Filter by status if specified
    if (options.status) {
      where.status = options.status;
    }

    // Filter by product ID if specified
    if (options.productId) {
      where.productId = options.productId;
    }

    // Filter out logs before the hidden timestamp
    if (user?.hiddenMyDealSyncLogsTimestamp) {
      where.createdAt = {
        gt: user.hiddenMyDealSyncLogsTimestamp,
      };
    }

    // Get total count and logs
    const [total, logs] = await Promise.all([
      this.prisma.myDealWorkItem.count({ where }),
      this.prisma.myDealWorkItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          connection: {
            select: {
              id: true,
              connectionName: true,
              baseApiUrl: true,
            },
          },
        },
      }),
    ]);

    // Format logs to match the expected interface
    const formattedLogs = logs.map((log) => {
      const requestPayload = log.requestPayload as any;
      return {
        id: log.id,
        connectionId: log.connectionId,
        productId: log.productId,
        ExternalProductId: log.externalProductId,
        lastExportedAt: log.completedAt,
        lastImportedAt: null,
        lastSyncedImages: requestPayload?.Images?.map((img: any) => img.Src) || [],
        lastSyncedAssets: [],
        syncStatus: log.status,
        errorMessage: log.errorMessage,
        createdAt: log.createdAt,
        updatedAt: log.updatedAt,
        connection: {
          id: log.connection?.id,
          storeName: log.connection?.connectionName,
          storeUrl: log.connection?.baseApiUrl,
        },
        operation: log.operation,
        status: log.status === 'completed' ? 'success' : log.status === 'failed' ? 'error' : log.status === 'pending' ? 'pending' : 'warning',
        timestamp: log.completedAt || log.updatedAt,
        connectionName: log.connection?.connectionName,
        workItemId: log.workItemId,
      };
    });

    return {
      logs: formattedLogs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Hide MyDeal sync logs by updating the user's hidden timestamp
   */
  async hideSyncLogs(userId: number): Promise<{ success: boolean; hiddenCount: number }> {
    // Get current timestamp
    const now = new Date();

    // Count logs that will be hidden
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { hiddenMyDealSyncLogsTimestamp: true },
    });

    const where: any = {
      userId,
    };

    if (user?.hiddenMyDealSyncLogsTimestamp) {
      where.createdAt = {
        gt: user.hiddenMyDealSyncLogsTimestamp,
        lte: now,
      };
    } else {
      where.createdAt = {
        lte: now,
      };
    }

    const hiddenCount = await this.prisma.myDealWorkItem.count({ where });

    // Update the user's hidden timestamp
    await this.prisma.user.update({
      where: { id: userId },
      data: { hiddenMyDealSyncLogsTimestamp: now },
    });

    return {
      success: true,
      hiddenCount,
    };
  }
}
