import { Module } from '@nestjs/common';
import { AssetGroupService } from './asset-group.service';
import { AssetGroupController } from './asset-group.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AssetGroupController],
  providers: [AssetGroupService],
  exports: [AssetGroupService],
})
export class AssetGroupModule {}
