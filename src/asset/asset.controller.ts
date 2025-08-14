import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AssetService } from './asset.service';
import { CreateAssetDto, UpdateAssetDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaginatedResponse } from '../common';

@Controller('assets')
@UseGuards(JwtAuthGuard)
export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
      },
    }),
  )
  async uploadAsset(
    @UploadedFile() file: Express.Multer.File,
    @Body() createAssetDto: CreateAssetDto,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    return this.assetService.create(createAssetDto, file, userId);
  }

  @Get()
  async findAll(
    @Req() req: any,
    @Query('assetGroupId') assetGroupId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user.id;
    const groupId = assetGroupId ? parseInt(assetGroupId, 10) : undefined;
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    
    return this.assetService.findAll(userId, groupId, pageNum, limitNum);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const userId = req.user.id;
    return this.assetService.findOne(id, userId);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAssetDto: UpdateAssetDto,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    return this.assetService.update(id, updateAssetDto, userId);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const userId = req.user.id;
    return this.assetService.remove(id, userId);
  }
}
