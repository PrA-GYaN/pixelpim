import {
  Injectable,
  NotFoundException,
  BadRequestException,
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
  // Utility to recursively convert BigInt values to strings
  private static convertBigIntToString(obj: any): any {
    if (typeof obj === 'bigint') {
      return obj.toString();
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
  ) {
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
}
