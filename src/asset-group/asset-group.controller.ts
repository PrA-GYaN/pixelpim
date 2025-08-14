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
  ParseIntPipe,
} from '@nestjs/common';
import { AssetGroupService } from './asset-group.service';
import { CreateAssetGroupDto, UpdateAssetGroupDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('asset-groups')
@UseGuards(JwtAuthGuard)
export class AssetGroupController {
  constructor(private readonly assetGroupService: AssetGroupService) {}

  @Post()
  async create(@Body() createAssetGroupDto: CreateAssetGroupDto, @Req() req: any) {
    const userId = req.user.id;
    return this.assetGroupService.create(createAssetGroupDto, userId);
  }

  @Get()
  async findAll(@Req() req: any) {
    const userId = req.user.id;
    return this.assetGroupService.findAll(userId);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const userId = req.user.id;
    return this.assetGroupService.findOne(id, userId);
  }

  @Get(':id/assets')
  async getAssetsInGroup(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const userId = req.user.id;
    return this.assetGroupService.getAssetsInGroup(id, userId);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAssetGroupDto: UpdateAssetGroupDto,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    return this.assetGroupService.update(id, updateAssetGroupDto, userId);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const userId = req.user.id;
    return this.assetGroupService.remove(id, userId);
  }
}
