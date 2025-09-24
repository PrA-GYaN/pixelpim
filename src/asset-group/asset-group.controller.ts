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
    @Query('search') search?: string,
    @Query('minAssets') minAssets?: string,
    @Query('maxAssets') maxAssets?: string,
    @Query('minSize') minSize?: string,
    @Query('maxSize') maxSize?: string,
    @Query('createdAfter') createdAfter?: string,
    @Query('createdBefore') createdBefore?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('dateFilter') dateFilter?: 'latest' | 'oldest',
    @Query('hasAssets') hasAssets?: string,
  ) {
    const userId = req.user.id;
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    const sortOrderValidated = sortOrder === 'asc' ? 'asc' : 'desc';
    
    const filters = {
      search,
      minAssets: minAssets ? parseInt(minAssets) : undefined,
      maxAssets: maxAssets ? parseInt(maxAssets) : undefined,
      minSize: minSize ? parseInt(minSize) : undefined,
      maxSize: maxSize ? parseInt(maxSize) : undefined,
      createdAfter,
      createdBefore,
      sortBy,
      sortOrder: sortOrderValidated,
      dateFilter,
      hasAssets: hasAssets === 'true' ? true : hasAssets === 'false' ? false : undefined,
    };
    
    return this.assetGroupService.findAll(userId, pageNum, limitNum, filters);
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
    @Query('search') search?: string,
    @Query('mimeType') mimeType?: string,
    @Query('minSize') minSize?: string,
    @Query('maxSize') maxSize?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    const userId = req.user.id;
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    const sortOrderValidated = sortOrder === 'asc' ? 'asc' : 'desc';
    
    const filters = {
      search,
      mimeType,
      minSize: minSize ? parseInt(minSize) : undefined,
      maxSize: maxSize ? parseInt(maxSize) : undefined,
      sortBy,
      sortOrder: sortOrderValidated,
    };
    
    return this.assetGroupService.getAssetsInGroup(id, userId, pageNum, limitNum, filters);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAssetGroupDto: UpdateAssetGroupDto,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    try {
      return await this.assetGroupService.update(id, updateAssetGroupDto, userId);
    } catch (error) {
      if (error.status && error.message) {
        // Known NestJS exception
        return {
          statusCode: error.status,
          message: error.message,
        };
      }
      // Unknown error
      return {
        statusCode: 500,
        message: error.message || 'Internal server error',
      };
    }
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
