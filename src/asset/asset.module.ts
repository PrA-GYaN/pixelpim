import { Module } from '@nestjs/common';
import { AssetService } from './asset.service';
import { AssetController } from './asset.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudinaryConfigService } from '../config/cloudinary-config.service';

@Module({
  imports: [PrismaModule],
  controllers: [AssetController],
  providers: [AssetService, CloudinaryConfigService],
  exports: [AssetService],
})
export class AssetModule {}
