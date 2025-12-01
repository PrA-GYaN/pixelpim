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
import { OwnershipGuard } from '../auth/guards/ownership.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { User as GetUser } from '../auth/decorators/user.decorator';
import { EffectiveUserId } from '../auth/decorators/effective-user-id.decorator';
import { PaginatedResponse } from '../common';
import type { User } from '@prisma/client';

@Controller('asset-groups')
@UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
export class AssetGroupController {
  constructor(private readonly assetGroupService: AssetGroupService) {}

  @Post()
  @RequirePermissions({ resource: 'asset-groups', action: 'create' })
  async create(
    @Body() createAssetGroupDto: CreateAssetGroupDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.assetGroupService.create(createAssetGroupDto, effectiveUserId);
  }

  @Get()
  @RequirePermissions({ resource: 'asset-groups', action: 'read' })
  async findAll(
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
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
    
    // Only return root level groups (parentGroupId = null)
    return this.assetGroupService.findAll(effectiveUserId, null, pageNum, limitNum, filters);
  }

  @Get(':parentId/children')
  @RequirePermissions({ resource: 'asset-groups', action: 'read' })
  async findChildren(
    @Param('parentId', ParseIntPipe) parentId: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
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
    
    // Return groups with specific parentGroupId
    return this.assetGroupService.findAll(effectiveUserId, parentId, pageNum, limitNum, filters);
  }

  @Get(':id')
  @RequirePermissions({ resource: 'asset-groups', action: 'read' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.assetGroupService.findOne(id, effectiveUserId);
  }

  @Get(':id/assets')
  @RequirePermissions({ resource: 'asset-groups', action: 'read' })
  async getAssetsInGroup(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('mimeType') mimeType?: string,
    @Query('minSize') minSize?: string,
    @Query('maxSize') maxSize?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
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
    
    return this.assetGroupService.getAssetsInGroup(id, effectiveUserId, pageNum, limitNum, filters);
  }

  @Patch(':id')
  @RequirePermissions({ resource: 'asset-groups', action: 'update' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAssetGroupDto: UpdateAssetGroupDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    try {
      return await this.assetGroupService.update(id, updateAssetGroupDto, effectiveUserId);
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
  @RequirePermissions({ resource: 'asset-groups', action: 'delete' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.assetGroupService.remove(id, effectiveUserId);
  }
  
  @Post(':id/attach-assets')
  @RequirePermissions({ resource: 'asset-groups', action: 'update' })
  async attachAssetsToGroup(
    @Param('id', ParseIntPipe) id: number,
    @Body() attachAssetsToGroupDto: AttachAssetsToGroupDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.assetGroupService.attachAssetsToGroup(id, attachAssetsToGroupDto.assetIds, effectiveUserId);
  }
}
