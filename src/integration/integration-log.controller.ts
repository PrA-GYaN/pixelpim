import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  Logger,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { IntegrationLogService } from './integration-log.service';
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
} from './dto/query-integration-log.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User as GetUser } from '../auth/decorators/user.decorator';
import type { User } from '../../generated/prisma';

@Controller('api/integration/logs')
@UseGuards(JwtAuthGuard)
export class IntegrationLogController {
  private readonly logger = new Logger(IntegrationLogController.name);

  constructor(private readonly integrationLogService: IntegrationLogService) {}

  /**
   * GET /api/integration/logs
   * Paginated retrieval of integration logs with filters
   */
  @Get()
  async getLogs(
    @Query() query: QueryIntegrationLogDto,
    @GetUser() user: User,
  ): Promise<IntegrationLogResponseDto> {
    this.logger.log(
      `User ${user.id} fetching integration logs with filters: ${JSON.stringify(query)}`,
    );

    try {
      return await this.integrationLogService.getLogs(user.id, query);
    } catch (error) {
      this.logger.error(
        `Failed to fetch integration logs for user ${user.id}`,
        error,
      );
      throw new BadRequestException('Failed to fetch integration logs');
    }
  }

  /**
   * GET /api/integration/logs/product/:productId
   * Get all logs for a specific internal product
   */
  @Get('product/:productId')
  async getLogsByProduct(
    @Param('productId', ParseIntPipe) productId: number,
    @Query() query: ProductLogsQueryDto,
    @GetUser() user: User,
  ): Promise<ProductLogsResponseDto> {
    this.logger.log(
      `User ${user.id} fetching logs for product ${productId} with filters: ${JSON.stringify(query)}`,
    );

    try {
      return await this.integrationLogService.getLogsByProduct(
        user.id,
        productId,
        query,
      );
    } catch (error) {
      this.logger.error(
        `Failed to fetch logs for product ${productId} for user ${user.id}`,
        error,
      );
      throw new BadRequestException(
        `Failed to fetch logs for product ${productId}`,
      );
    }
  }

  /**
   * GET /api/integration/logs/external/:integrationType/:externalId
   * Retrieve logs for a product using its external platform ID
   */
  @Get('external/:integrationType/:externalId')
  async getLogsByExternalId(
    @Param('integrationType') integrationType: string,
    @Param('externalId') externalId: string,
    @GetUser() user: User,
  ): Promise<ExternalProductLogsResponseDto> {
    this.logger.log(
      `User ${user.id} fetching logs for external product ${externalId} (${integrationType})`,
    );

    try {
      return await this.integrationLogService.getLogsByExternalId(
        user.id,
        integrationType,
        externalId,
      );
    } catch (error) {
      this.logger.error(
        `Failed to fetch logs for external product ${externalId} (${integrationType}) for user ${user.id}`,
        error,
      );
      throw new BadRequestException(
        `Failed to fetch logs for external product ${externalId}`,
      );
    }
  }

  /**
   * GET /api/integration/logs/stats
   * Get aggregated statistics
   */
  @Get('stats')
  async getStats(
    @Query() query: StatsQueryDto,
    @GetUser() user: User,
  ): Promise<StatsResponseDto> {
    this.logger.log(
      `User ${user.id} fetching integration statistics with filters: ${JSON.stringify(query)}`,
    );

    try {
      return await this.integrationLogService.getStats(user.id, query);
    } catch (error) {
      this.logger.error(
        `Failed to fetch statistics for user ${user.id}`,
        error,
      );
      throw new BadRequestException('Failed to fetch statistics');
    }
  }

  /**
   * GET /api/integration/logs/errors
   * Get recent error logs
   */
  @Get('errors')
  async getErrorLogs(
    @Query() query: ErrorLogsQueryDto,
    @GetUser() user: User,
  ): Promise<ErrorLogsResponseDto> {
    this.logger.log(
      `User ${user.id} fetching error logs with filters: ${JSON.stringify(query)}`,
    );

    try {
      return await this.integrationLogService.getErrorLogs(user.id, query);
    } catch (error) {
      this.logger.error(`Failed to fetch error logs for user ${user.id}`, error);
      throw new BadRequestException('Failed to fetch error logs');
    }
  }
}
