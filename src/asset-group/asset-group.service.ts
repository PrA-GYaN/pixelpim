import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssetGroupDto, UpdateAssetGroupDto } from './dto';

@Injectable()
export class AssetGroupService {
  constructor(private prisma: PrismaService) {}

  async create(createAssetGroupDto: CreateAssetGroupDto, userId: number) {
    // Check if asset group with same name already exists for this user
    const existingGroup = await this.prisma.assetGroup.findFirst({
      where: {
        groupName: createAssetGroupDto.groupName,
        userId,
      },
    });

    if (existingGroup) {
      throw new ConflictException('Asset group with this name already exists');
    }

    const assetGroup = await this.prisma.assetGroup.create({
      data: {
        groupName: createAssetGroupDto.groupName,
        userId,
      },
      include: {
        _count: {
          select: {
            assets: true,
          },
        },
      },
    });

    // Convert BigInt to Number for JSON serialization
    return {
      ...assetGroup,
      totalSize: Number(assetGroup.totalSize),
    };
  }

  async findAll(userId: number) {
    const assetGroups = await this.prisma.assetGroup.findMany({
      where: { userId },
      include: {
        _count: {
          select: {
            assets: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Convert BigInt to Number for JSON serialization
    return assetGroups.map(group => ({
      ...group,
      totalSize: Number(group.totalSize),
    }));
  }

  async findOne(id: number, userId: number) {
    const assetGroup = await this.prisma.assetGroup.findFirst({
      where: { id, userId },
      include: {
        _count: {
          select: {
            assets: true,
          },
        },
      },
    });

    if (!assetGroup) {
      throw new NotFoundException('Asset group not found');
    }

    // Convert BigInt to Number for JSON serialization
    return {
      ...assetGroup,
      totalSize: Number(assetGroup.totalSize),
    };
  }

  async getAssetsInGroup(id: number, userId: number) {
    const assetGroup = await this.findOne(id, userId);

    const assets = await this.prisma.asset.findMany({
      where: {
        assetGroupId: id,
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Convert BigInt to Number for JSON serialization
    return assets.map(asset => ({
      ...asset,
      size: Number(asset.size),
    }));
  }

  async update(id: number, updateAssetGroupDto: UpdateAssetGroupDto, userId: number) {
    const assetGroup = await this.findOne(id, userId);

    // Check if new name conflicts with existing group
    if (updateAssetGroupDto.groupName && updateAssetGroupDto.groupName !== assetGroup.groupName) {
      const existingGroup = await this.prisma.assetGroup.findFirst({
        where: {
          groupName: updateAssetGroupDto.groupName,
          userId,
          id: { not: id },
        },
      });

      if (existingGroup) {
        throw new ConflictException('Asset group with this name already exists');
      }
    }

    const updatedAssetGroup = await this.prisma.assetGroup.update({
      where: { id },
      data: updateAssetGroupDto,
      include: {
        _count: {
          select: {
            assets: true,
          },
        },
      },
    });

    // Convert BigInt to Number for JSON serialization
    return {
      ...updatedAssetGroup,
      totalSize: Number(updatedAssetGroup.totalSize),
    };
  }

  async remove(id: number, userId: number) {
    const assetGroup = await this.findOne(id, userId);

    // Set all assets in this group to have no group
    await this.prisma.asset.updateMany({
      where: { assetGroupId: id },
      data: { assetGroupId: null },
    });

    await this.prisma.assetGroup.delete({
      where: { id },
    });

    return { message: 'Asset group deleted successfully' };
  }
}
