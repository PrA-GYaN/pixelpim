import { Module } from '@nestjs/common';
import { FamilyService } from './family.service';
import { FamilyController } from './family.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AttributeModule } from '../attribute/attribute.module';

@Module({
  imports: [PrismaModule, AttributeModule],
  controllers: [FamilyController],
  providers: [FamilyService],
  exports: [FamilyService],
})
export class FamilyModule {}
