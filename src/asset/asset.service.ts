import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssetDto, UpdateAssetDto } from './dto';
import { CloudinaryUtil, CloudinaryUploadResult } from '../utils/cloudinary.util';
import { PaginatedResponse, PaginationUtils } from '../common';

@Injectable()
export class AssetService {
  constructor(private prisma: PrismaService) {}

  async create(createAssetDto: CreateAssetDto, file: Express.Multer.File, userId: number) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    console.log('Creating asset with userId:', userId, 'file:', file.originalname);

    // Upload file to Cloudinary
    const uploadOptions = CloudinaryUtil.getAssetUploadOptions();
    const cloudinaryResult: CloudinaryUploadResult = await CloudinaryUtil.uploadFile(file, uploadOptions);

    // Check if asset group exists if provided
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

    const asset = await this.prisma.asset.create({
      data: {
        name: createAssetDto.name,
        fileName: cloudinaryResult.original_filename || file.originalname,
        filePath: cloudinaryResult.public_id, // Store Cloudinary public_id as file path
        mimeType: file.mimetype,
        size: cloudinaryResult.bytes,
        userId,
        assetGroupId: createAssetDto.assetGroupId,
      },
      include: {
        assetGroup: true,
      },
    });

    // Update asset group total size if asset is assigned to a group
    if (createAssetDto.assetGroupId) {
      await this.updateAssetGroupSize(createAssetDto.assetGroupId);
    }

    return {
      ...asset,
      size: Number(asset.size), 
      url: cloudinaryResult.url,
      thumbnailUrl: CloudinaryUtil.getThumbnailUrl(cloudinaryResult.public_id),
      formattedSize: CloudinaryUtil.formatFileSize(Number(asset.size)),
      cloudinaryData: {
        public_id: cloudinaryResult.public_id,
        format: cloudinaryResult.format,
        resource_type: cloudinaryResult.resource_type,
        created_at: cloudinaryResult.created_at,
      },
    };
  }

  async findAll(userId: number, assetGroupId?: number, page: number = 1, limit: number = 10) {
    const whereCondition: any = { userId };
    
    if (assetGroupId !== undefined) {
      whereCondition.assetGroupId = assetGroupId;
    }

    const paginationOptions = PaginationUtils.createPrismaOptions(page, limit);

    const [assets, total] = await Promise.all([
      this.prisma.asset.findMany({
        where: whereCondition,
        ...paginationOptions,
        include: {
          assetGroup: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.asset.count({ where: whereCondition }),
    ]);

    // Add Cloudinary URLs to each asset
    const transformedAssets = assets.map(asset => ({
      ...asset,
      size: Number(asset.size), // Convert BigInt to Number for JSON serialization
      url: CloudinaryUtil.getOptimizedUrl(asset.filePath),
      thumbnailUrl: CloudinaryUtil.getThumbnailUrl(asset.filePath),
      formattedSize: CloudinaryUtil.formatFileSize(Number(asset.size)),
    }));

    return PaginationUtils.createPaginatedResponse(transformedAssets, total, page, limit);
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
      ...asset,
      size: Number(asset.size), // Convert BigInt to Number for JSON serialization
      url: CloudinaryUtil.getOptimizedUrl(asset.filePath),
      thumbnailUrl: CloudinaryUtil.getThumbnailUrl(asset.filePath),
      formattedSize: CloudinaryUtil.formatFileSize(Number(asset.size)),
    };
  }

  async update(id: number, updateAssetDto: UpdateAssetDto, userId: number) {
    const asset = await this.findOne(id, userId);
    const oldAssetGroupId = asset.assetGroupId;

    // Check if new asset group exists
    if (updateAssetDto.assetGroupId && updateAssetDto.assetGroupId !== oldAssetGroupId) {
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

    // Update asset group sizes if group changed
    if (oldAssetGroupId !== updateAssetDto.assetGroupId) {
      if (oldAssetGroupId) {
        await this.updateAssetGroupSize(oldAssetGroupId);
      }
      if (updateAssetDto.assetGroupId) {
        await this.updateAssetGroupSize(updateAssetDto.assetGroupId);
      }
    }

    return updatedAsset;
  }

  async remove(id: number, userId: number) {
    const asset = await this.findOne(id, userId);

    // Delete the file from Cloudinary
    try {
      await CloudinaryUtil.deleteFile(asset.filePath);
    } catch (error) {
      console.error('Error deleting file from Cloudinary:', error);
    }

    await this.prisma.asset.delete({
      where: { id },
    });

    // Update asset group size if asset was in a group
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
}
