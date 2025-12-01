import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssetDto, UpdateAssetDto, ExportAssetsDto, ExportType } from './dto';
import {
  CloudinaryUtil,
  CloudinaryUploadResult,
} from '../utils/cloudinary.util';
import { PaginationUtils } from '../common';
import { Builder } from 'xml2js';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class AssetService {
  constructor(private prisma: PrismaService) {}
  
  /**
   * Build the local directory path for storing assets
   * Creates folder structure: uploads/{userId}_{username}/{groupPath}/
   */
  private async buildLocalDirectoryPath(userId: number, assetGroupId?: number): Promise<string> {
    // Get user details
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Create user folder name
    const username = user.email.replace(/[^a-zA-Z0-9]/g, '_');
    const userFolder = `${userId}_${username}`;
    let dirPath = path.join(process.cwd(), 'uploads', userFolder);

    // If asset group is specified, build the full path including subfolders
    if (assetGroupId) {
      const groupPath = await this.buildAssetGroupPath(assetGroupId, userId);
      dirPath = path.join(dirPath, groupPath);
    }

    return dirPath;
  }

  /**
   * Convert local file path to URL for serving
   */
  private async convertLocalPathToUrl(localPath: string, userId: number): Promise<string> {
    // Get user details
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      return localPath; // fallback
    }

    const username = user.email.replace(/[^a-zA-Z0-9]/g, '_');
    const userFolder = `${userId}_${username}`;
    const uploadsPath = path.join(process.cwd(), 'uploads', userFolder);

    // Get relative path from user folder
    const relativePath = path.relative(uploadsPath, localPath);

    return `/uploads/${userFolder}/${relativePath.replace(/\\/g, '/')}`;
  }

  /**
   * Build the asset group path including parent folders
   */
  private async buildAssetGroupPath(assetGroupId: number, userId: number): Promise<string> {
    const groups: string[] = [];
    let currentGroupId: number | null = assetGroupId;

    while (currentGroupId) {
      const group = await this.prisma.assetGroup.findFirst({
        where: {
          id: currentGroupId,
          userId,
        },
        select: {
          id: true,
          groupName: true,
          parentGroupId: true,
        },
      });

      if (!group) {
        throw new NotFoundException('Asset group not found');
      }

      groups.unshift(group.groupName);
      currentGroupId = group.parentGroupId;
    }

    return path.join(...groups);
  }
  // Utility to recursively convert BigInt values to strings while preserving dates
  private static convertBigIntToString(obj: any): any {
    if (typeof obj === 'bigint') {
      return obj.toString();
    }
    if (obj instanceof Date) {
      return obj.toISOString();
    }
    if (Array.isArray(obj)) {
      return obj.map(AssetService.convertBigIntToString);
    }
    if (obj && typeof obj === 'object') {
      const newObj: any = {};
      for (const key in obj) {
        newObj[key] = AssetService.convertBigIntToString(obj[key]);
      }
      return newObj;
    }
    return obj;
  }

  async create(
    createAssetDto: CreateAssetDto,
    file: Express.Multer.File,
    userId: number,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    console.log(
      'Creating asset with userId:',
      userId,
      'file:',
      file.originalname,
    );

    // Get user details for folder creation
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullname: true },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Create user folder name: userid_username (using email as username)
    const username = user.email.replace(/[^a-zA-Z0-9]/g, '_');
    const userFolder = `${userId}_${username}`;

    // Check if asset with same name already exists in the same folder (excluding soft-deleted)
    const existingAsset = await this.prisma.asset.findFirst({
      where: {
        name: createAssetDto.name,
        userId,
        assetGroupId: createAssetDto.assetGroupId ?? null,
        isDeleted: false,
      },
    });

    if (existingAsset) {
      throw new BadRequestException('Asset with this name already exists in this folder');
    }

    // Build local directory path
    const localDirPath = await this.buildLocalDirectoryPath(userId, createAssetDto.assetGroupId);

    // Ensure directory exists
    await fs.mkdir(localDirPath, { recursive: true });

    // Generate unique filename to avoid conflicts
    const fileExtension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, fileExtension);
    const timestamp = Date.now();
    const uniqueFileName = `${baseName}_${timestamp}${fileExtension}`;
    const localFilePath = path.join(localDirPath, uniqueFileName);

    // Save file locally
    await fs.writeFile(localFilePath, file.buffer);

    // Check asset group exists
    if (createAssetDto.assetGroupId) {
      const assetGroup = await this.prisma.assetGroup.findFirst({
        where: {
          id: createAssetDto.assetGroupId,
          userId,
        },
      });

      if (!assetGroup) {
        throw new NotFoundException('Asset group not found');
      }
    }

    // Convert local path to URL format for serving
    const fileUrl = await this.convertLocalPathToUrl(localFilePath, userId);

    // Store local file path in database
    const asset = await this.prisma.asset.create({
      data: {
        name: createAssetDto.name,
        fileName: uniqueFileName,
        filePath: localFilePath, // Store local file path
        mimeType: file.mimetype,
        size: BigInt(file.size),
        userId,
        assetGroupId: createAssetDto.assetGroupId,
      },
      include: {
        assetGroup: true,
      },
    });

    // Update group size
    if (createAssetDto.assetGroupId) {
      await this.updateAssetGroupSize(createAssetDto.assetGroupId);
    }

    return {
      ...AssetService.convertBigIntToString(asset),
      size: Number(asset.size),
      url: fileUrl, // Local file URL
      formattedSize: CloudinaryUtil.formatFileSize(Number(asset.size)),
    };
  }

  async findAll(
    userId: number,
    assetGroupId?: number,
    page: number = 1,
    limit: number = 10,
    filters: any = {},
    includeDeleted: boolean = false,
  ) {
    const whereCondition: any = { userId };
    
    // Exclude soft-deleted assets by default
    if (!includeDeleted) {
      whereCondition.isDeleted = false;
    }
    
    // Group filter - IMPORTANT: Always filter by exact folder context
    // If assetGroupId is explicitly provided (including null for root), use it
    // If not provided and no hasGroup filter, show only root-level assets (null)
    if (assetGroupId !== undefined) {
      whereCondition.assetGroupId = assetGroupId;
    } else if (filters.hasGroup === undefined) {
      // Default behavior: show only root-level assets when no group context specified
      whereCondition.assetGroupId = null;
    }

    // Has group filter (only applies if assetGroupId not explicitly set)
    if (assetGroupId === undefined && filters.hasGroup !== undefined) {
      if (filters.hasGroup === true) {
        whereCondition.assetGroupId = { not: null };
      } else if (filters.hasGroup === false) {
        whereCondition.assetGroupId = null;
      }
    }

    // Search filter (name or fileName)
    if (filters.search) {
      whereCondition.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { fileName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // MIME type filter
    if (filters.mimeType) {
      whereCondition.mimeType = { contains: filters.mimeType, mode: 'insensitive' };
    }

    // Size filters
    if (filters.minSize !== undefined || filters.maxSize !== undefined) {
      whereCondition.size = {};
      if (filters.minSize !== undefined) {
        whereCondition.size.gte = filters.minSize;
      }
      if (filters.maxSize !== undefined) {
        whereCondition.size.lte = filters.maxSize;
      }
    }

    // Date range filters
    if (filters.createdAfter || filters.createdBefore) {
      whereCondition.createdAt = {};
      if (filters.createdAfter) {
        whereCondition.createdAt.gte = new Date(filters.createdAfter);
      }
      if (filters.createdBefore) {
        whereCondition.createdAt.lte = new Date(filters.createdBefore);
      }
    }

    // Sorting logic
    let orderBy: any = { createdAt: 'desc' };
    
    if (filters.dateFilter) {
      orderBy = { createdAt: filters.dateFilter === 'latest' ? 'desc' : 'asc' };
    } else if (filters.sortBy) {
      const validSortFields = ['name', 'fileName', 'size', 'createdAt', 'updatedAt'];
      if (validSortFields.includes(filters.sortBy)) {
        orderBy = { [filters.sortBy]: filters.sortOrder || 'asc' };
      }
    }

    const paginationOptions = PaginationUtils.createPrismaOptions(page, limit);

    const [assets, total] = await Promise.all([
      this.prisma.asset.findMany({
        where: whereCondition,
        ...paginationOptions,
        include: {
          assetGroup: true,
        },
        orderBy,
      }),
      this.prisma.asset.count({ where: whereCondition }),
    ]);

    const transformedAssets = await Promise.all(assets.map(async (asset) => ({
      ...AssetService.convertBigIntToString(asset),
      size: Number(asset.size),
      url: await this.convertLocalPathToUrl(asset.filePath, userId), // Convert to URL
      formattedSize: CloudinaryUtil.formatFileSize(Number(asset.size)),
    })));

    return PaginationUtils.createPaginatedResponse(
      transformedAssets,
      total,
      page,
      limit,
    );
  }

  async findOne(id: number, userId: number, includeDeleted: boolean = false) {
    const whereCondition: any = { id, userId };
    
    // Exclude soft-deleted assets by default
    if (!includeDeleted) {
      whereCondition.isDeleted = false;
    }

    const asset = await this.prisma.asset.findFirst({
      where: whereCondition,
      include: {
        assetGroup: true,
      },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    return {
      ...AssetService.convertBigIntToString(asset),
      size: Number(asset.size),
      url: asset.filePath, // Cloudinary URL
      formattedSize: CloudinaryUtil.formatFileSize(Number(asset.size)),
    };
  }

  async update(
    id: number,
    updateAssetDto: UpdateAssetDto,
    userId: number,
  ) {
    const asset = await this.findOne(id, userId);
    const oldAssetGroupId = asset.assetGroupId;
    console.log('Updating asset:', id, 'with data:', updateAssetDto);
    
    // Check if new name conflicts with existing asset in the same folder
    if (updateAssetDto.name && updateAssetDto.name !== asset.name) {
      const targetGroupId = updateAssetDto.assetGroupId !== undefined 
        ? updateAssetDto.assetGroupId 
        : oldAssetGroupId;
        
      const existingAsset = await this.prisma.asset.findFirst({
        where: {
          name: updateAssetDto.name,
          userId,
          assetGroupId: targetGroupId ?? null,
          id: { not: id },
        },
      });

      if (existingAsset) {
        throw new ConflictException('Asset with this name already exists in this folder');
      }
    }
    
    if (
      updateAssetDto.assetGroupId &&
      updateAssetDto.assetGroupId !== oldAssetGroupId
    ) {
      const assetGroup = await this.prisma.assetGroup.findFirst({
        where: {
          id: updateAssetDto.assetGroupId,
          userId,
        },
      });

      if (!assetGroup) {
        throw new NotFoundException('Asset group not found');
      }
    }

    const updatedAsset = await this.prisma.asset.update({
      where: { id },
      data: updateAssetDto,
      include: {
        assetGroup: true,
      },
    });

    if (oldAssetGroupId !== updateAssetDto.assetGroupId) {
      if (oldAssetGroupId) {
        await this.updateAssetGroupSize(oldAssetGroupId);
      }
      if (updateAssetDto.assetGroupId) {
        await this.updateAssetGroupSize(updateAssetDto.assetGroupId);
      }
    }

    return {
      ...AssetService.convertBigIntToString(updatedAsset),
      size: Number(updatedAsset.size),
      url: await this.convertLocalPathToUrl(updatedAsset.filePath, userId), // Convert to URL
      formattedSize: CloudinaryUtil.formatFileSize(Number(updatedAsset.size)),
    };
  }

  async remove(id: number, userId: number) {
    // Use soft delete instead of hard delete
    return this.softDeleteAsset(id, userId);
  }

  private async updateAssetGroupSize(assetGroupId: number) {
    const totalSize = await this.prisma.asset.aggregate({
      where: { assetGroupId },
      _sum: {
        size: true,
      },
    });

    await this.prisma.assetGroup.update({
      where: { id: assetGroupId },
      data: {
        totalSize: totalSize._sum.size || 0,
      },
    });
  }

  /**
   * Export assets based on specified criteria
   * @param userId - User ID
   * @param exportDto - Export configuration
   * @returns Exported data in requested format
   */
  async exportAssets(userId: number, exportDto: ExportAssetsDto) {
    const { format, type, assetIds, assetGroupId, assetGroupIds, includeSubfolders } = exportDto;

    // Build where condition based on export type
    const whereCondition: any = { userId };

    switch (type) {
      case ExportType.ALL:
        // No additional filters - export all assets
        break;

      case ExportType.SELECTED:
        if (!assetIds || assetIds.length === 0) {
          throw new BadRequestException('Asset IDs are required for selected export type');
        }
        whereCondition.id = { in: assetIds };
        break;

      case ExportType.FOLDER:
        if (!assetGroupId) {
          throw new BadRequestException('Asset group ID is required for folder export type');
        }

        if (includeSubfolders) {
          // Get all descendant folders
          const descendantIds = await this.getDescendantFolderIds(assetGroupId, userId);
          whereCondition.assetGroupId = { in: [assetGroupId, ...descendantIds] };
        } else {
          whereCondition.assetGroupId = assetGroupId;
        }
        break;

      case ExportType.MULTIPLE_FOLDERS:
        if (!assetGroupIds || assetGroupIds.length === 0) {
          throw new BadRequestException('Asset group IDs are required for multiple folders export type');
        }

        if (includeSubfolders) {
          // Get all descendant folders for each selected folder
          const allFolderIds = [...assetGroupIds];
          for (const groupId of assetGroupIds) {
            const descendantIds = await this.getDescendantFolderIds(groupId, userId);
            allFolderIds.push(...descendantIds);
          }
          // Remove duplicates
          const uniqueFolderIds = [...new Set(allFolderIds)];
          whereCondition.assetGroupId = { in: uniqueFolderIds };
        } else {
          whereCondition.assetGroupId = { in: assetGroupIds };
        }
        break;

      default:
        throw new BadRequestException('Invalid export type');
    }

    // Fetch assets
    const assets = await this.prisma.asset.findMany({
      where: whereCondition,
      select: {
        id: true,
        name: true,
        filePath: true,
        fileName: true,
        mimeType: true,
        size: true,
        uploadDate: true,
        createdAt: true,
        updatedAt: true,
        assetGroupId: true,
        assetGroup: {
          select: {
            id: true,
            groupName: true,
            parentGroupId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (assets.length === 0) {
      throw new NotFoundException('No assets found matching the criteria');
    }

    // Transform assets to export format
    const exportData = await Promise.all(assets.map(async (asset) => ({
      id: asset.id.toString(),
      name: asset.name,
      url: await this.convertLocalPathToUrl(asset.filePath, userId), // Convert to URL
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      size: asset.size.toString(),
      formattedSize: CloudinaryUtil.formatFileSize(Number(asset.size)),
      uploadDate: asset.uploadDate.toISOString(),
      createdAt: asset.createdAt.toISOString(),
      updatedAt: asset.updatedAt.toISOString(),
      folder: asset.assetGroup ? {
        id: asset.assetGroup.id.toString(),
        name: asset.assetGroup.groupName,
        parentId: asset.assetGroup.parentGroupId?.toString() || null,
      } : null,
    })));

    // Return in requested format
    if (format === 'xml') {
      return this.convertToXml(exportData);
    }

    return {
      totalAssets: exportData.length,
      exportDate: new Date().toISOString(),
      exportType: type,
      assets: exportData,
    };
  }

  /**
   * Get all descendant folder IDs recursively
   */
  private async getDescendantFolderIds(parentGroupId: number, userId: number): Promise<number[]> {
    const children = await this.prisma.assetGroup.findMany({
      where: {
        parentGroupId,
        userId,
      },
      select: {
        id: true,
      },
    });

    const childIds = children.map(child => child.id);
    const descendantIds: number[] = [...childIds];

    // Recursively get descendants of children
    for (const childId of childIds) {
      const nestedDescendants = await this.getDescendantFolderIds(childId, userId);
      descendantIds.push(...nestedDescendants);
    }

    return descendantIds;
  }

  /**
   * Convert asset data to XML format
   */
  private convertToXml(assets: any[]): string {
    const builder = new Builder({
      xmldec: { version: '1.0', encoding: 'UTF-8' },
      renderOpts: { pretty: true, indent: '  ' },
    });

    const xmlData = {
      assetExport: {
        $: {
          totalAssets: assets.length,
          exportDate: new Date().toISOString(),
        },
        assets: {
          asset: assets.map(asset => ({
            id: asset.id,
            name: asset.name,
            url: asset.url,
            fileName: asset.fileName,
            mimeType: asset.mimeType,
            size: asset.size,
            formattedSize: asset.formattedSize,
            uploadDate: asset.uploadDate,
            createdAt: asset.createdAt,
            updatedAt: asset.updatedAt,
            folder: asset.folder ? {
              id: asset.folder.id,
              name: asset.folder.name,
              parentId: asset.folder.parentId || '',
            } : '',
          })),
        },
      },
    };

    return builder.buildObject(xmlData);
  }

  /**
   * Export assets as JSON (legacy method - kept for backward compatibility)
   * @param userId - User ID
   * @param assetGroupId - Optional: Filter by specific folder/group
   * @returns Array of assets in JSON format
   */
  async exportAsJson(userId: number, assetGroupId?: number) {
    const whereCondition: any = { userId };
    
    if (assetGroupId !== undefined) {
      whereCondition.assetGroupId = assetGroupId;
    }

    const assets = await this.prisma.asset.findMany({
      where: whereCondition,
      select: {
        id: true,
        name: true,
        filePath: true,
        fileName: true,
        mimeType: true,
        size: true,
        uploadDate: true,
        assetGroupId: true,
        assetGroup: {
          select: {
            id: true,
            groupName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform assets to clean JSON format
    const exportData = await Promise.all(assets.map(async (asset) => ({
      id: asset.id.toString(),
      name: asset.name,
      url: await this.convertLocalPathToUrl(asset.filePath, userId), // Convert to URL
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      size: asset.size.toString(),
      uploadDate: asset.uploadDate.toISOString(),
      folder: asset.assetGroup ? {
        id: asset.assetGroup.id,
        name: asset.assetGroup.groupName,
      } : null,
    })));

    return exportData;
  }

  // ============================================================
  // SOFT DELETE METHODS
  // ============================================================

  /**
   * Soft delete an asset by setting deletedAt and isDeleted flags
   * @param id - Asset ID
   * @param userId - User ID
   * @returns Promise<{ message: string; asset: any }>
   */
  async softDeleteAsset(id: number, userId: number): Promise<{ message: string; asset: any }> {
    const asset = await this.prisma.asset.findFirst({
      where: { 
        id, 
        userId,
        isDeleted: false 
      },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found or already deleted');
    }

    // Soft delete the asset
    const deletedAsset = await this.prisma.asset.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isDeleted: true,
      },
    });

    // Update group size if asset was in a group
    if (asset.assetGroupId) {
      await this.updateAssetGroupSize(asset.assetGroupId);
    }

    return { 
      message: 'Asset successfully soft deleted',
      asset: AssetService.convertBigIntToString(deletedAsset)
    };
  }

  /**
   * Restore a soft-deleted asset
   * @param id - Asset ID
   * @param userId - User ID
   * @returns Promise<{ message: string; asset: any }>
   */
  async restoreAsset(id: number, userId: number): Promise<{ message: string; asset: any }> {
    const asset = await this.prisma.asset.findFirst({
      where: { 
        id, 
        userId,
        isDeleted: true 
      },
    });

    if (!asset) {
      throw new NotFoundException('Soft-deleted asset not found');
    }

    // Check for name conflicts before restoring
    const existingAsset = await this.prisma.asset.findFirst({
      where: {
        name: asset.name,
        userId,
        assetGroupId: asset.assetGroupId,
        isDeleted: false,
      },
    });

    if (existingAsset) {
      throw new ConflictException(`Cannot restore: An asset with name "${asset.name}" already exists in this folder`);
    }

    // Restore the asset
    const restoredAsset = await this.prisma.asset.update({
      where: { id },
      data: {
        deletedAt: null,
        isDeleted: false,
      },
    });

    // Update group size if asset is in a group
    if (asset.assetGroupId) {
      await this.updateAssetGroupSize(asset.assetGroupId);
    }

    return { 
      message: 'Asset successfully restored',
      asset: {
        ...AssetService.convertBigIntToString(restoredAsset),
        size: Number(restoredAsset.size),
        url: await this.convertLocalPathToUrl(restoredAsset.filePath, userId),
        formattedSize: CloudinaryUtil.formatFileSize(Number(restoredAsset.size)),
      }
    };
  }

  /**
   * Get soft-deleted assets for a user
   * @param userId - User ID
   * @param page - Page number
   * @param limit - Items per page
   * @returns Promise<PaginatedResponse<any>>
   */
  async getSoftDeletedAssets(
    userId: number,
    page: number = 1,
    limit: number = 10
  ) {
    const whereCondition: any = { 
      userId,
      isDeleted: true 
    };

    const paginationOptions = PaginationUtils.createPrismaOptions(page, limit);

    const [assets, total] = await Promise.all([
      this.prisma.asset.findMany({
        where: whereCondition,
        ...paginationOptions,
        include: {
          assetGroup: true,
        },
        orderBy: { deletedAt: 'desc' },
      }),
      this.prisma.asset.count({ where: whereCondition }),
    ]);

    const transformedAssets = await Promise.all(assets.map(async (asset) => ({
      ...AssetService.convertBigIntToString(asset),
      size: Number(asset.size),
      url: await this.convertLocalPathToUrl(asset.filePath, userId),
      formattedSize: CloudinaryUtil.formatFileSize(Number(asset.size)),
    })));

    return PaginationUtils.createPaginatedResponse(
      transformedAssets,
      total,
      page,
      limit,
    );
  }

  /**
   * Permanently delete a soft-deleted asset (hard delete)
   * @param id - Asset ID
   * @param userId - User ID
   * @returns Promise<{ message: string }>
   */
  async permanentlyDeleteAsset(id: number, userId: number): Promise<{ message: string }> {
    const asset = await this.prisma.asset.findFirst({
      where: { 
        id, 
        userId,
        isDeleted: true 
      },
    });

    if (!asset) {
      throw new NotFoundException('Soft-deleted asset not found');
    }

    // Delete local file
    try {
      await fs.unlink(asset.filePath);
    } catch (error) {
      console.error('Error deleting local file:', error);
    }

    // Permanently delete
    await this.prisma.asset.delete({
      where: { id },
    });

    // Update group size if asset was in a group
    if (asset.assetGroupId) {
      await this.updateAssetGroupSize(asset.assetGroupId);
    }

    return { message: 'Asset permanently deleted' };
  }
}
