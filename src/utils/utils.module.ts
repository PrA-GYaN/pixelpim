import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductUtilService } from './product.util';

@Module({
  imports: [PrismaModule],
  providers: [ProductUtilService],
  exports: [ProductUtilService],
})
export class UtilsModule {}
