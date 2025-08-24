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
  Query,
} from '@nestjs/common';
import { AssetGroupService } from './asset-group.service';
import { CreateAssetGroupDto, UpdateAssetGroupDto, AttachAssetsToGroupDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaginatedResponse } from '../common';

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
  async findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user.id;
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    
    return this.assetGroupService.findAll(userId, pageNum, limitNum);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const userId = req.user.id;
    return this.assetGroupService.findOne(id, userId);
  }

  @Get(':id/assets')
  async getAssetsInGroup(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user.id;
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    
    return this.assetGroupService.getAssetsInGroup(id, userId, pageNum, limitNum);
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
  
  @Post(':id/attach-assets')
  async attachAssetsToGroup(
    @Param('id', ParseIntPipe) id: number,
    @Body() attachAssetsToGroupDto: AttachAssetsToGroupDto,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    return this.assetGroupService.attachAssetsToGroup(id, attachAssetsToGroupDto.assetIds, userId);
  }
}
