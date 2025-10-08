import { IsNotEmpty, IsString, IsOptional, IsUrl, IsEnum } from 'class-validator';

export enum ImportStatus {
  PENDING = 'pending',
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

export interface ImportJobData extends ScheduleImportDto {
  id: string;
  userId: number;
  status: ImportStatus;
  lastRun?: Date;
  nextRun?: Date;
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
  lastRun?: Date;
  nextRun?: Date;
  createdAt: Date;
  updatedAt: Date;
}
