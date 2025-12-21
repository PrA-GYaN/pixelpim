import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  QueryIntegrationLogDto,
  ProductLogsQueryDto,
  StatsQueryDto,
  ErrorLogsQueryDto,
  IntegrationLogResponseDto,
  ProductLogsResponseDto,
  ExternalProductLogsResponseDto,
  StatsResponseDto,
  ErrorLogsResponseDto,
  PaginationDto,
  OperationStatsDto,
  IntegrationTypeStatsDto,
} from './dto/query-integration-log.dto';

@Injectable()
export class IntegrationLogService {
  private readonly logger = new Logger(IntegrationLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get paginated integration logs with filters
   */
  async getLogs(
    userId: number,
    query: QueryIntegrationLogDto,
  ): Promise<IntegrationLogResponseDto> {
    const {
      page = 1,
      limit = 20,
      integrationType,
      operation,
      status,
      productId,
      startDate,
      endDate,
      sortBy = 'timestamp',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * limit;

    // Get user's hiddenLogsTimestamp
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { hiddenLogsTimestamp: true },
    });

    // Build where clause
    const where: any = {
      userId,
    };

    // Apply hiddenLogsTimestamp filter to hide logs before the timestamp
    if (user?.hiddenLogsTimestamp) {
      where.timestamp = {
        gt: user.hiddenLogsTimestamp,
      };
    }

    if (integrationType) {
      where.integrationType = integrationType;
    }

    if (operation) {
      where.operation = operation;
    }

    if (status) {
      where.status = status;
    }

    if (productId) {
      where.productId = productId;
    }

    // Merge with existing timestamp filter if provided
    if (startDate || endDate) {
      if (!where.timestamp) {
        where.timestamp = {};
      }
      if (startDate) {
        where.timestamp.gte = new Date(startDate);
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate);
      }
    }

    // Execute queries in parallel
    const [logs, total] = await Promise.all([
      this.prisma.integrationLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
      }),
      this.prisma.integrationLog.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    const pagination: PaginationDto = {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };

    return {
      logs,
      pagination,
    };
  }

  /**
   * Get all logs for a specific product
   */
  async getLogsByProduct(
    userId: number,
    productId: number,
    query: ProductLogsQueryDto,
  ): Promise<ProductLogsResponseDto> {
    const { integrationType, operation, status, limit = 50 } = query;

    // Build where clause
    const where: any = {
      userId,
      productId,
    };

    if (integrationType) {
      where.integrationType = integrationType;
    }

    if (operation) {
      where.operation = operation;
    }

    if (status) {
      where.status = status;
    }

    // Execute queries in parallel
    const [logs, total] = await Promise.all([
      this.prisma.integrationLog.findMany({
        where,
        take: limit,
        orderBy: {
          timestamp: 'desc',
        },
      }),
      this.prisma.integrationLog.count({ where }),
    ]);

    return {
      productId,
      logs,
      total,
    };
  }

  /**
   * Get logs for a product using external platform ID
   */
  async getLogsByExternalId(
    userId: number,
    integrationType: string,
    externalId: string,
  ): Promise<ExternalProductLogsResponseDto> {
    // Find the internal product ID first
    const firstLog = await this.prisma.integrationLog.findFirst({
      where: {
        userId,
        integrationType,
        externalProductId: externalId,
      },
      select: {
        productId: true,
      },
    });

    const internalProductId = firstLog ? firstLog.productId : null;

    // Get all logs for this external product
    const logs = await this.prisma.integrationLog.findMany({
      where: {
        userId,
        integrationType,
        externalProductId: externalId,
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    return {
      externalId,
      integrationType,
      internalProductId,
      logs,
    };
  }

  /**
   * Get aggregated statistics
   */
  async getStats(
    userId: number,
    query: StatsQueryDto,
  ): Promise<StatsResponseDto> {
    const { startDate, endDate, integrationType } = query;

    // Build where clause
    const where: any = {
      userId,
    };

    if (integrationType) {
      where.integrationType = integrationType;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate);
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate);
      }
    }

    // Get counts by status
    const [totalLogs, successCount, errorCount, pendingCount] =
      await Promise.all([
        this.prisma.integrationLog.count({ where }),
        this.prisma.integrationLog.count({
          where: { ...where, status: 'success' },
        }),
        this.prisma.integrationLog.count({
          where: { ...where, status: 'error' },
        }),
        this.prisma.integrationLog.count({
          where: { ...where, status: 'pending' },
        }),
      ]);

    // Calculate success rate
    const successRate =
      totalLogs > 0 ? Number(((successCount / totalLogs) * 100).toFixed(2)) : 0;

    // Get counts by operation
    const operationCounts = await this.prisma.integrationLog.groupBy({
      by: ['operation'],
      where,
      _count: {
        id: true,
      },
    });

    const byOperation: OperationStatsDto = {
      export: 0,
      import: 0,
      update: 0,
      delete: 0,
      webhook: 0,
    };

    operationCounts.forEach((item) => {
      const operation = item.operation as keyof OperationStatsDto;
      if (operation in byOperation) {
        byOperation[operation] = item._count.id;
      }
    });

    // Get counts by integration type
    const integrationTypeCounts = await this.prisma.integrationLog.groupBy({
      by: ['integrationType'],
      where,
      _count: {
        id: true,
      },
    });

    const byIntegrationType: IntegrationTypeStatsDto = {
      woocommerce: 0,
      amazon: 0,
      shopify: 0,
    };

    integrationTypeCounts.forEach((item) => {
      const type = item.integrationType as keyof IntegrationTypeStatsDto;
      if (type in byIntegrationType) {
        byIntegrationType[type] = item._count.id;
      }
    });

    const response: StatsResponseDto = {
      totalLogs,
      successCount,
      errorCount,
      pendingCount,
      successRate,
      byOperation,
      byIntegrationType,
    };

    if (startDate) {
      response.startDate = startDate;
    }

    if (endDate) {
      response.endDate = endDate;
    }

    return response;
  }

  /**
   * Get recent error logs
   */
  async getErrorLogs(
    userId: number,
    query: ErrorLogsQueryDto,
  ): Promise<ErrorLogsResponseDto> {
    const { limit = 20, integrationType, hours = 24 } = query;

    // Calculate time threshold
    const timeThreshold = new Date();
    timeThreshold.setHours(timeThreshold.getHours() - hours);

    // Build where clause
    const where: any = {
      userId,
      status: 'error',
      timestamp: {
        gte: timeThreshold,
      },
    };

    if (integrationType) {
      where.integrationType = integrationType;
    }

    // Execute queries in parallel
    const [errors, total] = await Promise.all([
      this.prisma.integrationLog.findMany({
        where,
        take: limit,
        orderBy: {
          timestamp: 'desc',
        },
      }),
      this.prisma.integrationLog.count({ where }),
    ]);

    return {
      errors,
      total,
    };
  }

  /**
   * Hide logs before current timestamp
   */
  async hideLogs(userId: number): Promise<{ success: boolean; hiddenLogsTimestamp: Date }> {
    const hiddenLogsTimestamp = new Date();

    await this.prisma.user.update({
      where: { id: userId },
      data: { hiddenLogsTimestamp },
    });

    this.logger.log(`User ${userId} hid logs before ${hiddenLogsTimestamp.toISOString()}`);

    return {
      success: true,
      hiddenLogsTimestamp,
    };
  }
}
