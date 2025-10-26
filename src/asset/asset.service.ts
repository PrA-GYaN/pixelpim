import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssetDto, UpdateAssetDto } from './dto';
import {
  CloudinaryUtil,
  CloudinaryUploadResult,
} from '../utils/cloudinary.util';
import { PaginationUtils } from '../common';

@Injectable()
export class AssetService {
  constructor(private prisma: PrismaService) {}
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

    // Check if asset with same name already exists in the same folder
    const existingAsset = await this.prisma.asset.findFirst({
      where: {
        name: createAssetDto.name,
        userId,
        assetGroupId: createAssetDto.assetGroupId ?? null,
      },
    });

    if (existingAsset) {
      throw new BadRequestException('Asset with this name already exists in this folder');
    }

    // Upload to Cloudinary
    const uploadOptions = CloudinaryUtil.getAssetUploadOptions();
    const cloudinaryResult: CloudinaryUploadResult =
      await CloudinaryUtil.uploadFile(file, uploadOptions);
    console.log('Cloudinary upload result:', cloudinaryResult);

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

    // Store secure_url in filePath
    const asset = await this.prisma.asset.create({
      data: {
        name: createAssetDto.name,
        fileName: cloudinaryResult.original_filename || file.originalname,
        filePath: cloudinaryResult.secure_url, // ✅ Store full URL
        mimeType: file.mimetype,
        size: cloudinaryResult.bytes,
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
      url: asset.filePath, // ✅ Return full URL
      formattedSize: CloudinaryUtil.formatFileSize(Number(asset.size)),
    };
  }

  async findAll(
    userId: number,
    assetGroupId?: number,
    page: number = 1,
    limit: number = 10,
    filters: any = {},
  ) {
    const whereCondition: any = { userId };
    
    // Group filter
    if (assetGroupId !== undefined) {
      whereCondition.assetGroupId = assetGroupId;
    }

    // Has group filter
    if (filters.hasGroup !== undefined) {
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

    const transformedAssets = assets.map((asset) => ({
      ...AssetService.convertBigIntToString(asset),
      size: Number(asset.size),
      url: asset.filePath, // ✅ Use filePath as URL
      formattedSize: CloudinaryUtil.formatFileSize(Number(asset.size)),
    }));

    return PaginationUtils.createPaginatedResponse(
      transformedAssets,
      total,
      page,
      limit,
    );
  }

  async findOne(id: number, userId: number) {
    const asset = await this.prisma.asset.findFirst({
      where: { id, userId },
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
      url: asset.filePath, // ✅ Use filePath as URL
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
      url: updatedAsset.filePath,
      formattedSize: CloudinaryUtil.formatFileSize(Number(updatedAsset.size)),
    };
  }

  async remove(id: number, userId: number) {
    const asset = await this.findOne(id, userId);

    // Delete file from Cloudinary using public_id
    try {
      const publicId = CloudinaryUtil.extractPublicId(asset.filePath);
      await CloudinaryUtil.deleteFile(publicId);
    } catch (error) {
      console.error('Error deleting file from Cloudinary:', error);
    }

    await this.prisma.asset.delete({
      where: { id },
    });

    if (asset.assetGroupId) {
      await this.updateAssetGroupSize(asset.assetGroupId);
    }

    return { message: 'Asset deleted successfully' };
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
   * Export assets as JSON
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
    const exportData = assets.map(asset => ({
      id: asset.id.toString(),
      name: asset.name,
      url: asset.filePath,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      size: asset.size.toString(),
      uploadDate: asset.uploadDate.toISOString(),
      folder: asset.assetGroup ? {
        id: asset.assetGroup.id,
        name: asset.assetGroup.groupName,
      } : null,
    }));

    return exportData;
  }
}
