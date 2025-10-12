import { Injectable, Logger, OnModuleInit, OnModuleDestroy, forwardRef, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { CsvImportService } from './csv-import.service';
import { PrismaService } from '../../prisma/prisma.service';
import { 
  ScheduleImportDto, 
  UpdateScheduledImportDto,
  ImportJobResponseDto, 
  ImportStatus, 
  ExecutionStatus,
  ImportExecutionLogResponseDto,
  ImportExecutionStatsDto
} from '../dto/schedule-import.dto';
import cron from 'cron-validate';

@Injectable()
export class ImportSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImportSchedulerService.name);
  private jobs: Map<string, CronJob> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(forwardRef(() => CsvImportService))
    private readonly csvImportService: CsvImportService,
  ) {}

  async onModuleInit() {
    this.logger.log('ImportSchedulerService initialized');
    // Restore scheduled jobs from database on startup
    await this.restoreScheduledJobs();
  }

  onModuleDestroy() {
    this.logger.log('ImportSchedulerService destroying, stopping all jobs');
    this.stopAllJobs();
  }

  async scheduleImport(scheduleDto: ScheduleImportDto, userId: number): Promise<ImportJobResponseDto> {
    // Validate cron expression
    const cronValidation = cron(scheduleDto.cronExpression);
    if (!cronValidation.isValid()) {
      throw new BadRequestException(`Invalid cron expression: ${cronValidation.getError().join(', ')}`);
    }

    // Calculate next run time
    const cronJob = new CronJob(scheduleDto.cronExpression, () => {});
    const nextRun = cronJob.nextDate().toJSDate();

    // Save to database
    const scheduledImport = await this.prisma.scheduledImport.create({
      data: {
        name: scheduleDto.name,
        description: scheduleDto.description,
        cronExpression: scheduleDto.cronExpression,
        csvUrl: scheduleDto.csvUrl,
        status: ImportStatus.ACTIVE,
        isActive: true,
        nextRun,
        userId,
      },
    });

    // Create and start the cron job
    await this.createAndStartCronJob(scheduledImport);

    this.logger.log(`Scheduled import job ${scheduledImport.id} with cron: ${scheduleDto.cronExpression}`);

    return this.mapToResponseDto(scheduledImport);
  }

  async updateScheduledImport(jobId: string, updateDto: UpdateScheduledImportDto, userId: number): Promise<ImportJobResponseDto> {
    // Find the scheduled import
    const existingImport = await this.prisma.scheduledImport.findFirst({
      where: { id: jobId, userId },
    });

    if (!existingImport) {
      throw new NotFoundException(`Scheduled import with ID ${jobId} not found`);
    }

    // Validate cron expression if provided
    if (updateDto.cronExpression) {
      const cronValidation = cron(updateDto.cronExpression);
      if (!cronValidation.isValid()) {
        throw new BadRequestException(`Invalid cron expression: ${cronValidation.getError().join(', ')}`);
      }
    }

    // Calculate next run time if cron expression changed
    let nextRun = existingImport.nextRun;
    if (updateDto.cronExpression && updateDto.cronExpression !== existingImport.cronExpression) {
      const cronJob = new CronJob(updateDto.cronExpression, () => {});
      nextRun = cronJob.nextDate().toJSDate();
    }

    // Update in database
    const updatedImport = await this.prisma.scheduledImport.update({
      where: { id: jobId },
      data: {
        ...updateDto,
        nextRun,
        updatedAt: new Date(),
      },
    });

    // Stop existing job and create new one if still active
    this.stopJob(jobId);
    if (updatedImport.isActive && updatedImport.status === ImportStatus.ACTIVE) {
      await this.createAndStartCronJob(updatedImport);
    }

    this.logger.log(`Updated scheduled import job ${jobId}`);

    return this.mapToResponseDto(updatedImport);
  }

  async executeImport(jobId: string): Promise<void> {
    // Get the scheduled import from database
    const scheduledImport = await this.prisma.scheduledImport.findUnique({
      where: { id: jobId },
    });

    if (!scheduledImport) {
      this.logger.error(`Scheduled import ${jobId} not found`);
      return;
    }

    if (!scheduledImport.isActive) {
      this.logger.warn(`Scheduled import ${jobId} is not active, skipping execution`);
      return;
    }

    // Create execution log
    const executionLog = await this.prisma.importExecutionLog.create({
      data: {
        scheduledImportId: jobId,
        status: ExecutionStatus.PROCESSING,
        userId: scheduledImport.userId,
      },
    });

    // Update scheduled import status
    await this.prisma.scheduledImport.update({
      where: { id: jobId },
      data: {
        status: ImportStatus.PROCESSING,
        lastRun: new Date(),
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Executing import job ${jobId} (execution ${executionLog.id})`);

    try {
      const result = await this.csvImportService.importFromCsv(
        scheduledImport.csvUrl,
        scheduledImport.userId
      );

      // Update execution log with success
      await this.prisma.importExecutionLog.update({
        where: { id: executionLog.id },
        data: {
          status: ExecutionStatus.COMPLETED,
          endTime: new Date(),
          itemsProcessed: result.totalProcessed,
          itemsImported: result.imported,
          itemsFailed: result.errors.length,
          executionSummary: {
            imported: result.imported,
            totalProcessed: result.totalProcessed,
            errors: result.errors.slice(0, 50), // Limit stored errors to prevent large JSON
            errorCount: result.errors.length,
            executionTime: result.executionTime,
            successRate: result.totalProcessed > 0 ? ((result.imported / result.totalProcessed) * 100).toFixed(2) : '0',
            success: true,
          },
          updatedAt: new Date(),
        },
      });

      // Update scheduled import status and counters
      await this.prisma.scheduledImport.update({
        where: { id: jobId },
        data: {
          status: ImportStatus.ACTIVE,
          successCount: { increment: 1 },
          nextRun: this.calculateNextRun(scheduledImport.cronExpression),
          updatedAt: new Date(),
        },
      });

      this.logger.log(
        `Import job ${jobId} completed successfully in ${result.executionTime}ms. Processed: ${result.totalProcessed}, Imported: ${result.imported}, Errors: ${result.errors.length}`
      );
    } catch (error) {
      this.logger.error(`Import job ${jobId} failed: ${error.message}`, error);

      // Update execution log with failure
      await this.prisma.importExecutionLog.update({
        where: { id: executionLog.id },
        data: {
          status: ExecutionStatus.FAILED,
          endTime: new Date(),
          errorMessage: error.message,
          errorDetails: {
            stack: error.stack,
            name: error.name,
            message: error.message,
          },
          executionSummary: {
            success: false,
            error: error.message,
          },
          updatedAt: new Date(),
        },
      });

      // Update scheduled import status and counters
      await this.prisma.scheduledImport.update({
        where: { id: jobId },
        data: {
          status: ImportStatus.ACTIVE,
          errorCount: { increment: 1 },
          nextRun: this.calculateNextRun(scheduledImport.cronExpression),
          updatedAt: new Date(),
        },
      });
    }
  }

  async getAllJobs(userId: number, includeExecutions: boolean = true): Promise<ImportJobResponseDto[]> {
    const scheduledImports = await this.prisma.scheduledImport.findMany({
      where: { userId },
      include: {
        executionLogs: includeExecutions ? {
          take: 5,
          orderBy: { createdAt: 'desc' },
        } : false,
      },
      orderBy: { createdAt: 'desc' },
    });

    return scheduledImports.map(importJob => this.mapToResponseDto(importJob, includeExecutions));
  }

  async getJob(jobId: string, userId: number, includeExecutions: boolean = true): Promise<ImportJobResponseDto | null> {
    const scheduledImport = await this.prisma.scheduledImport.findFirst({
      where: { id: jobId, userId },
      include: {
        executionLogs: includeExecutions ? {
          take: 10,
          orderBy: { createdAt: 'desc' },
        } : false,
      },
    });

    if (!scheduledImport) {
      return null;
    }

    return this.mapToResponseDto(scheduledImport, includeExecutions);
  }

  async pauseJob(jobId: string, userId: number): Promise<boolean> {
    const scheduledImport = await this.prisma.scheduledImport.findFirst({
      where: { id: jobId, userId },
    });

    if (!scheduledImport) {
      return false;
    }

    await this.prisma.scheduledImport.update({
      where: { id: jobId },
      data: {
        status: ImportStatus.PAUSED,
        isActive: false,
        updatedAt: new Date(),
      },
    });

    this.stopJob(jobId);
    this.logger.log(`Paused import job ${jobId}`);
    return true;
  }

  async resumeJob(jobId: string, userId: number): Promise<boolean> {
    const scheduledImport = await this.prisma.scheduledImport.findFirst({
      where: { id: jobId, userId },
    });

    if (!scheduledImport) {
      return false;
    }

    const updatedImport = await this.prisma.scheduledImport.update({
      where: { id: jobId },
      data: {
        status: ImportStatus.ACTIVE,
        isActive: true,
        nextRun: this.calculateNextRun(scheduledImport.cronExpression),
        updatedAt: new Date(),
      },
    });

    await this.createAndStartCronJob(updatedImport);
    this.logger.log(`Resumed import job ${jobId}`);
    return true;
  }

  async cancelJob(jobId: string, userId: number): Promise<boolean> {
    const scheduledImport = await this.prisma.scheduledImport.findFirst({
      where: { id: jobId, userId },
    });

    if (!scheduledImport) {
      return false;
    }

    await this.prisma.scheduledImport.update({
      where: { id: jobId },
      data: {
        status: ImportStatus.CANCELLED,
        isActive: false,
        updatedAt: new Date(),
      },
    });

    this.stopJob(jobId);
    this.logger.log(`Cancelled import job ${jobId}`);
    return true;
  }

  async deleteJob(jobId: string, userId: number): Promise<boolean> {
    const scheduledImport = await this.prisma.scheduledImport.findFirst({
      where: { id: jobId, userId },
    });

    if (!scheduledImport) {
      return false;
    }

    this.stopJob(jobId);
    
    // Delete from database (execution logs will be cascade deleted)
    await this.prisma.scheduledImport.delete({
      where: { id: jobId },
    });

    this.logger.log(`Deleted import job ${jobId}`);
    return true;
  }

  async getExecutionLogs(jobId: string, userId: number, page: number = 1, limit: number = 20): Promise<{
    logs: ImportExecutionLogResponseDto[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    // Verify user owns the scheduled import
    const scheduledImport = await this.prisma.scheduledImport.findFirst({
      where: { id: jobId, userId },
    });

    if (!scheduledImport) {
      throw new NotFoundException(`Scheduled import with ID ${jobId} not found`);
    }

    const skip = (page - 1) * limit;
    
    const [logs, total] = await Promise.all([
      this.prisma.importExecutionLog.findMany({
        where: { scheduledImportId: jobId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.importExecutionLog.count({
        where: { scheduledImportId: jobId },
      }),
    ]);

    return {
      logs: logs.map(log => this.mapExecutionLogToDto(log)),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getExecutionStats(jobId: string, userId: number): Promise<ImportExecutionStatsDto> {
    // Verify user owns the scheduled import
    const scheduledImport = await this.prisma.scheduledImport.findFirst({
      where: { id: jobId, userId },
    });

    if (!scheduledImport) {
      throw new NotFoundException(`Scheduled import with ID ${jobId} not found`);
    }

    const [stats, lastExecution] = await Promise.all([
      this.prisma.importExecutionLog.aggregate({
        where: { scheduledImportId: jobId },
        _count: { id: true },
        _sum: {
          itemsProcessed: true,
          itemsImported: true,
          itemsFailed: true,
        },
      }),
      this.prisma.importExecutionLog.findFirst({
        where: { scheduledImportId: jobId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const [successCount, avgExecutionTime] = await Promise.all([
      this.prisma.importExecutionLog.count({
        where: {
          scheduledImportId: jobId,
          status: ExecutionStatus.COMPLETED,
        },
      }),
      this.prisma.importExecutionLog.aggregate({
        where: {
          scheduledImportId: jobId,
          endTime: { not: null },
        },
        _avg: {
          // Calculate average execution time in milliseconds
        },
      }),
    ]);

    return {
      totalExecutions: stats._count.id,
      successfulExecutions: successCount,
      failedExecutions: stats._count.id - successCount,
      totalItemsProcessed: Number(stats._sum.itemsProcessed || 0),
      totalItemsImported: Number(stats._sum.itemsImported || 0),
      totalItemsFailed: Number(stats._sum.itemsFailed || 0),
      lastExecution: lastExecution ? this.mapExecutionLogToDto(lastExecution) : undefined,
    };
  }

  private async restoreScheduledJobs(): Promise<void> {
    try {
      const activeImports = await this.prisma.scheduledImport.findMany({
        where: {
          isActive: true,
          status: ImportStatus.ACTIVE,
        },
      });

      for (const importJob of activeImports) {
        await this.createAndStartCronJob(importJob);
      }

      this.logger.log(`Restored ${activeImports.length} scheduled import jobs`);
    } catch (error) {
      this.logger.error(`Failed to restore scheduled jobs: ${error.message}`, error);
    }
  }

  private async createAndStartCronJob(scheduledImport: any): Promise<void> {
    try {
      const job = new CronJob(scheduledImport.cronExpression, async () => {
        await this.executeImport(scheduledImport.id);
      });

      this.jobs.set(scheduledImport.id, job);
      job.start();

      // Update next run time in database
      await this.prisma.scheduledImport.update({
        where: { id: scheduledImport.id },
        data: {
          nextRun: this.calculateNextRun(scheduledImport.cronExpression),
        },
      });

      this.logger.debug(`Started cron job for import ${scheduledImport.id}`);
    } catch (error) {
      this.logger.error(`Failed to create cron job for import ${scheduledImport.id}: ${error.message}`, error);
    }
  }

  private stopJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.stop();
      this.jobs.delete(jobId);
      this.logger.debug(`Stopped job ${jobId}`);
    }
  }

  private stopAllJobs(): void {
    for (const [jobId, job] of this.jobs) {
      job.stop();
      this.logger.debug(`Stopped job ${jobId}`);
    }
    this.jobs.clear();
  }

  private calculateNextRun(cronExpression: string): Date {
    const cronJob = new CronJob(cronExpression, () => {});
    return cronJob.nextDate().toJSDate();
  }

  private mapToResponseDto(scheduledImport: any, includeExecutions: boolean = false): ImportJobResponseDto {
    const dto: ImportJobResponseDto = {
      id: scheduledImport.id,
      name: scheduledImport.name,
      description: scheduledImport.description,
      cronExpression: scheduledImport.cronExpression,
      csvUrl: scheduledImport.csvUrl,
      status: scheduledImport.status as ImportStatus,
      isActive: scheduledImport.isActive,
      lastRun: scheduledImport.lastRun,
      nextRun: scheduledImport.nextRun,
      errorCount: scheduledImport.errorCount,
      successCount: scheduledImport.successCount,
      createdAt: scheduledImport.createdAt,
      updatedAt: scheduledImport.updatedAt,
    };

    if (includeExecutions && scheduledImport.executionLogs) {
      dto.recentExecutions = scheduledImport.executionLogs.map((log: any) => 
        this.mapExecutionLogToDto(log)
      );
    }

    return dto;
  }

  private mapExecutionLogToDto(executionLog: any): ImportExecutionLogResponseDto {
    return {
      id: executionLog.id,
      scheduledImportId: executionLog.scheduledImportId,
      status: executionLog.status as ExecutionStatus,
      startTime: executionLog.startTime,
      endTime: executionLog.endTime,
      itemsProcessed: executionLog.itemsProcessed,
      itemsImported: executionLog.itemsImported,
      itemsFailed: executionLog.itemsFailed,
      errorMessage: executionLog.errorMessage,
      errorDetails: executionLog.errorDetails,
      executionSummary: executionLog.executionSummary,
      createdAt: executionLog.createdAt,
      updatedAt: executionLog.updatedAt,
    };
  }
}
