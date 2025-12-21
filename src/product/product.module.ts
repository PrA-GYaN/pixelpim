import { Module, forwardRef } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
// import { MarketplaceTemplateService } from './services/marketplace-template.service';
// import { MarketplaceExportService } from './services/marketplace-export.service';
import { CsvImportService } from './services/csv-import.service';
import { ImportSchedulerService } from './services/import-scheduler.service';
import { ExcelImportService } from './services/excel-import.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AssetModule } from '../asset/asset.module';
import { NotificationModule } from '../notification/notification.module';
import { WebhookModule } from '../webhook/webhook.module';
import { IntegrationModule } from '../integration/integration.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    PrismaModule, 
    AssetModule, 
    NotificationModule, 
    WebhookModule, 
    forwardRef(() => IntegrationModule),
    ScheduleModule.forRoot()
  ],
  controllers: [ProductController],
  providers: [
    ProductService,
    CsvImportService,
    ImportSchedulerService,
    ExcelImportService,
  ],
  exports: [ProductService],
})
export class ProductModule {}
