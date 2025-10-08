import { Injectable, Logger, OnModuleInit, OnModuleDestroy, forwardRef, Inject } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { CsvImportService } from './csv-import.service';
import { ScheduleImportDto, ImportJobResponseDto, ImportStatus, ImportJobData } from '../dto/schedule-import.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class ImportSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImportSchedulerService.name);
  private jobs: Map<string, { job: CronJob; data: ImportJobData }> = new Map();

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(forwardRef(() => CsvImportService))
    private readonly csvImportService: CsvImportService,
  ) {}

  onModuleInit() {
    this.logger.log('ImportSchedulerService initialized');
  }

  onModuleDestroy() {
    this.logger.log('ImportSchedulerService destroying, stopping all jobs');
    this.stopAllJobs();
  }

  async scheduleImport(scheduleDto: ScheduleImportDto, userId: number): Promise<ImportJobResponseDto> {
    const jobId = randomUUID();

    const jobData: ImportJobData = {
      id: jobId,
      ...scheduleDto,
      userId,
      status: ImportStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const job = new CronJob(scheduleDto.cronExpression, async () => {
      await this.executeImport(jobId);
    });

    // Store the job
    this.jobs.set(jobId, { job, data: jobData });

    // Start the job
    job.start();

    this.logger.log(`Scheduled import job ${jobId} with cron: ${scheduleDto.cronExpression}`);

    return this.mapToResponseDto(jobData);
  }

  async executeImport(jobId: string): Promise<void> {
    const jobEntry = this.jobs.get(jobId);
    if (!jobEntry) {
      this.logger.error(`Job ${jobId} not found`);
      return;
    }

    const { data } = jobEntry;
    data.status = ImportStatus.PROCESSING;
    data.lastRun = new Date();
    data.updatedAt = new Date();

    this.logger.log(`Executing import job ${jobId}`);

    try {
      const result = await this.csvImportService.importFromCsv(data.csvUrl, data.userId);
      data.status = ImportStatus.COMPLETED;
      this.logger.log(`Import job ${jobId} completed successfully. Imported: ${result.imported}, Errors: ${result.errors.length}`);
    } catch (error) {
      data.status = ImportStatus.FAILED;
      this.logger.error(`Import job ${jobId} failed: ${error.message}`, error);
    }

    data.updatedAt = new Date();
  }

  getAllJobs(userId: number): ImportJobResponseDto[] {
    return Array.from(this.jobs.values())
      .filter(({ data }) => data.userId === userId)
      .map(({ data, job }) => ({
        ...this.mapToResponseDto(data),
        nextRun: job.nextDate().toJSDate(),
      }));
  }

  getJob(jobId: string, userId: number): ImportJobResponseDto | null {
    const jobEntry = this.jobs.get(jobId);
    if (!jobEntry || jobEntry.data.userId !== userId) {
      return null;
    }

    const { data, job } = jobEntry;
    return {
      ...this.mapToResponseDto(data),
      nextRun: job.nextDate().toJSDate(),
    };
  }

  async cancelJob(jobId: string, userId: number): Promise<boolean> {
    const jobEntry = this.jobs.get(jobId);
    if (!jobEntry || jobEntry.data.userId !== userId) {
      return false;
    }

    jobEntry.job.stop();
    this.jobs.delete(jobId);
    this.logger.log(`Cancelled import job ${jobId}`);
    return true;
  }

  private stopAllJobs(): void {
    for (const [jobId, { job }] of this.jobs) {
      job.stop();
      this.logger.log(`Stopped job ${jobId}`);
    }
    this.jobs.clear();
  }

  private mapToResponseDto(data: any): ImportJobResponseDto {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      cronExpression: data.cronExpression,
      csvUrl: data.csvUrl,
      status: data.status,
      lastRun: data.lastRun,
      nextRun: data.nextRun,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }
}
