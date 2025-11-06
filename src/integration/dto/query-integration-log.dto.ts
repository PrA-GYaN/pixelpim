import { IsOptional, IsInt, IsString, IsEnum, IsDateString, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export enum IntegrationType {
  WOOCOMMERCE = 'woocommerce',
  AMAZON = 'amazon',
  SHOPIFY = 'shopify',
}

export enum OperationType {
  EXPORT = 'export',
  IMPORT = 'import',
  UPDATE = 'update',
  DELETE = 'delete',
  WEBHOOK = 'webhook',
}

export enum StatusType {
  SUCCESS = 'success',
  ERROR = 'error',
  PENDING = 'pending',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class QueryIntegrationLogDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(IntegrationType)
  integrationType?: IntegrationType;

  @IsOptional()
  @IsEnum(OperationType)
  operation?: OperationType;

  @IsOptional()
  @IsEnum(StatusType)
  status?: StatusType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  productId?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  sortBy?: string = 'timestamp';

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;
}

export class ProductLogsQueryDto {
  @IsOptional()
  @IsEnum(IntegrationType)
  integrationType?: IntegrationType;

  @IsOptional()
  @IsEnum(OperationType)
  operation?: OperationType;

  @IsOptional()
  @IsEnum(StatusType)
  status?: StatusType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;
}

export class StatsQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(IntegrationType)
  integrationType?: IntegrationType;
}

export class ErrorLogsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(IntegrationType)
  integrationType?: IntegrationType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  hours?: number = 24;
}

// Response DTOs
export class PaginationDto {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export class IntegrationLogResponseDto {
  logs: any[];
  pagination: PaginationDto;
}

export class ProductLogsResponseDto {
  productId: number;
  logs: any[];
  total: number;
}

export class ExternalProductLogsResponseDto {
  externalId: string;
  integrationType: string;
  internalProductId: number | null;
  logs: any[];
}

export class OperationStatsDto {
  export: number;
  import: number;
  update: number;
  delete: number;
  webhook: number;
}

export class IntegrationTypeStatsDto {
  woocommerce: number;
  amazon: number;
  shopify: number;
}

export class StatsResponseDto {
  totalLogs: number;
  successCount: number;
  errorCount: number;
  pendingCount: number;
  successRate: number;
  byOperation: OperationStatsDto;
  byIntegrationType: IntegrationTypeStatsDto;
  startDate?: string;
  endDate?: string;
}

export class ErrorLogsResponseDto {
  errors: any[];
  total: number;
}
