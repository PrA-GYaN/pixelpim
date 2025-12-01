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
  Res,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  Query,
  Header,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AssetService } from './asset.service';
import { CreateAssetDto, UpdateAssetDto, ExportAssetsDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OwnershipGuard } from '../auth/guards/ownership.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { User as GetUser } from '../auth/decorators/user.decorator';
import { EffectiveUserId } from '../auth/decorators/effective-user-id.decorator';
import { PaginatedResponse } from '../common';
import { FileUploadUtil } from '../utils/file-upload.util';
import type { Response } from 'express';
import type { User } from '@prisma/client';

@Controller('assets')
@UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  @Post('upload')
  @RequirePermissions({ resource: 'assets', action: 'create' })
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
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.assetService.create(createAssetDto, file, effectiveUserId);
  }

  @Post('zip')
  @RequirePermissions({ resource: 'assets', action: 'read' })
  async downloadZip(@Body('files') files: string[], @Res() res: Response) {
    await FileUploadUtil.downloadFilesAsZip(files, res, 'my-assets.zip');
  }

  @Get()
  @RequirePermissions({ resource: 'assets', action: 'read' })
  async findAll(
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
    @Query('assetGroupId') assetGroupId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('mimeType') mimeType?: string,
    @Query('minSize') minSize?: string,
    @Query('maxSize') maxSize?: string,
    @Query('createdAfter') createdAfter?: string,
    @Query('createdBefore') createdBefore?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('hasGroup') hasGroup?: string,
    @Query('dateFilter') dateFilter?: 'latest' | 'oldest',
  ) {
    const groupId = assetGroupId ? parseInt(assetGroupId, 10) : undefined;
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    const sortOrderValidated = sortOrder === 'asc' ? 'asc' : 'desc';
    
    const filters = {
      search,
      mimeType,
      minSize: minSize ? parseInt(minSize) : undefined,
      maxSize: maxSize ? parseInt(maxSize) : undefined,
      createdAfter,
      createdBefore,
      sortBy,
      sortOrder: sortOrderValidated,
      hasGroup: hasGroup === 'true' ? true : hasGroup === 'false' ? false : undefined,
      dateFilter,
    };
    
    return this.assetService.findAll(effectiveUserId, groupId, pageNum, limitNum, filters);
  }

  @Get(':id')
  @RequirePermissions({ resource: 'assets', action: 'read' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.assetService.findOne(id, effectiveUserId);
  }

  @Patch(':id')
  @RequirePermissions({ resource: 'assets', action: 'update' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAssetDto: UpdateAssetDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
      try {
        return await this.assetService.update(id, updateAssetDto, effectiveUserId);
      } catch (error) {
        // Handle known HTTP exceptions
        if (error instanceof Error && error.name === 'NotFoundException') {
          return { statusCode: 404, message: error.message };
        }
        if (error instanceof Error && error.name === 'BadRequestException') {
          return { statusCode: 400, message: error.message };
        }
        // Prisma error codes (optional, if needed)
        if (error.code) {
          const prismaErrorMessages: Record<string, string> = {
            'P2000': 'The provided value is too long for the database field',
            'P2001': 'Record not found',
            'P2002': 'A record with this unique constraint already exists',
            'P2003': 'Foreign key constraint failed',
            'P2004': 'A constraint failed on the database',
            'P2005': 'The value stored in the database is invalid for the field type',
            'P2006': 'The provided value is not valid for this field',
            'P2007': 'Data validation error',
          };
          const message = prismaErrorMessages[error.code];
          if (message) {
            return { statusCode: 400, message };
          }
        }
        // Fallback for unknown errors
        return { statusCode: 500, message: 'Internal server error' };
      }
  }

  @Delete(':id')
  @RequirePermissions({ resource: 'assets', action: 'delete' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.assetService.remove(id, effectiveUserId);
  }

  @Get('export/json')
  @RequirePermissions({ resource: 'assets', action: 'export' })
  async exportAsJson(
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
    @Query('assetGroupId') assetGroupId?: string,
  ) {
    const groupId = assetGroupId ? parseInt(assetGroupId, 10) : undefined;
    return this.assetService.exportAsJson(effectiveUserId, groupId);
  }

  @Post('export')
  @RequirePermissions({ resource: 'assets', action: 'export' })
  async exportAssets(
    @Body() exportDto: ExportAssetsDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
    @Res() res: Response,
  ) {
    const result = await this.assetService.exportAssets(effectiveUserId, exportDto);

    // Set appropriate content type and headers based on format
    if (exportDto.format === 'xml') {
      res.setHeader('Content-Type', 'application/xml');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="assets-export-${Date.now()}.xml"`,
      );
      return res.send(result);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="assets-export-${Date.now()}.json"`,
      );
      return res.json(result);
    }
  }

  // Soft Delete Endpoints

  @Get('deleted')
  @RequirePermissions({ resource: 'assets', action: 'delete' })
  async getSoftDeletedAssets(
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    
    return this.assetService.getSoftDeletedAssets(effectiveUserId, pageNum, limitNum);
  }

  @Post(':id/restore')
  @RequirePermissions({ resource: 'assets', action: 'create' })
  async restoreAsset(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.assetService.restoreAsset(id, effectiveUserId);
  }

  @Delete(':id/permanent')
  @RequirePermissions({ resource: 'assets', action: 'delete' })
  async permanentlyDeleteAsset(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.assetService.permanentlyDeleteAsset(id, effectiveUserId);
  }
}
