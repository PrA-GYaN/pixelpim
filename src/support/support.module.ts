import { Module } from '@nestjs/common';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { EmailService } from '../auth/email.service';

@Module({
  controllers: [SupportController],
  providers: [SupportService, EmailService],
})
export class SupportModule {}