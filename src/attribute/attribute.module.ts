import { Module } from '@nestjs/common';
import { AttributeService } from './attribute.service';
import { AttributeController } from './attribute.controller';
import { AttributeValueValidator } from './validators/attribute-value.validator';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [AttributeController],
  providers: [
    AttributeService,
    AttributeValueValidator,
  ],
  exports: [AttributeService, AttributeValueValidator],
})
export class AttributeModule {}
