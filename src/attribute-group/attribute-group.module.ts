import { Module } from '@nestjs/common';
import { AttributeGroupService } from './attribute-group.service';
import { AttributeGroupController } from './attribute-group.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AttributeGroupController],
  providers: [AttributeGroupService],
  exports: [AttributeGroupService],
})
export class AttributeGroupModule {}
