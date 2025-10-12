import { IsNotEmpty, IsString, IsOptional, IsUrl, IsEnum, IsBoolean } from 'class-validator';

export enum ImportStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PAUSED = 'paused',
  CANCELLED = 'cancelled',
}

export enum ExecutionStatus {
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export class ScheduleImportDto {
  @IsNotEmpty()
  @IsString()
  cronExpression: string;

  @IsNotEmpty()
  @IsUrl()
  csvUrl: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateScheduledImportDto {
  @IsOptional()
  @IsString()
  cronExpression?: string;

  @IsOptional()
  @IsUrl()
  csvUrl?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(ImportStatus)
  status?: ImportStatus;
}

export interface ImportJobData extends ScheduleImportDto {
  id: string;
  userId: number;
  status: ImportStatus;
  isActive: boolean;
  lastRun?: Date;
  nextRun?: Date;
  errorCount: number;
  successCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export class ImportJobResponseDto {
  id: string;
  name?: string;
  description?: string;
  cronExpression: string;
  csvUrl: string;
  status: ImportStatus;
  isActive: boolean;
  lastRun?: Date;
  nextRun?: Date;
  errorCount: number;
  successCount: number;
  createdAt: Date;
  updatedAt: Date;
  recentExecutions?: ImportExecutionLogResponseDto[];
}

export class ImportExecutionLogResponseDto {
  id: number;
  scheduledImportId: string;
  status: ExecutionStatus;
  startTime: Date;
  endTime?: Date;
  itemsProcessed: number;
  itemsImported: number;
  itemsFailed: number;
  errorMessage?: string;
  errorDetails?: any;
  executionSummary?: any;
  createdAt: Date;
  updatedAt: Date;
}

export class ImportExecutionStatsDto {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  totalItemsProcessed: number;
  totalItemsImported: number;
  totalItemsFailed: number;
  lastExecution?: ImportExecutionLogResponseDto;
  averageExecutionTime?: number;
}
