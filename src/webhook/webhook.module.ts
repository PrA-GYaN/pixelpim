import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { WebhookFormatterService } from './webhook-formatter.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WebhookController],
  providers: [WebhookService, WebhookFormatterService],
  exports: [WebhookService, WebhookFormatterService],
})
export class WebhookModule {}