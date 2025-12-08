import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssetGroupDto, UpdateAssetGroupDto } from './dto';
import { PaginatedResponse, PaginationUtils } from '../common';

@Injectable()
export class AssetGroupService {
  // Utility to recursively convert BigInt values to strings while preserving dates
  private static convertBigIntToString = (obj: any): any => {
    if (typeof obj === 'bigint') {
      return obj.toString();
    }
    if (obj instanceof Date) {
      return obj.toISOString();
    }
    if (Array.isArray(obj)) {
      return obj.map(AssetGroupService.convertBigIntToString);
    }
    if (obj && typeof obj === 'object') {
      const newObj: any = {};
      for (const key in obj) {
        newObj[key] = AssetGroupService.convertBigIntToString(obj[key]);
      }
      return newObj;
    }
    return obj;
  };

  constructor(private prisma: PrismaService) {}

  async create(createAssetGroupDto: CreateAssetGroupDto, userId: number) {
    // Check if asset group with same name already exists in the same parent folder
    const existingGroup = await this.prisma.assetGroup.findFirst({
      where: {
        groupName: createAssetGroupDto.groupName,
        userId,
        parentGroupId: createAssetGroupDto.parentGroupId ?? null,
      },
    });

    if (existingGroup) {
      throw new ConflictException('Asset group with this name already exists in this folder');
    }

    // If parentGroupId is provided, verify it exists and belongs to the user
    if (createAssetGroupDto.parentGroupId) {
      const parentGroup = await this.prisma.assetGroup.findFirst({
        where: {
          id: createAssetGroupDto.parentGroupId,
          userId,
        },
      });

      if (!parentGroup) {
        throw new NotFoundException('Parent folder not found or does not belong to you');
      }
    }

    const assetGroup = await this.prisma.assetGroup.create({
      data: {
        groupName: createAssetGroupDto.groupName,
        parentGroupId: createAssetGroupDto.parentGroupId,
        userId,
      },
      select: {
        id: true,
        groupName: true,
        parentGroupId: true,
        createdDate: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
        _count: {
          select: {
            assets: true,
          },
        },
      },
    });

  // Convert BigInt to String for JSON serialization
  return AssetGroupService.convertBigIntToString(assetGroup);
  }

  async findAll(userId: number, parentGroupId: number | null, page: number = 1, limit: number = 10, filters: any = {}) {
    const whereCondition: any = { 
      userId,
      parentGroupId: parentGroupId === null ? null : parentGroupId,
    };

    // Search filter (group name)
    if (filters.search) {
      whereCondition.groupName = { contains: filters.search, mode: 'insensitive' };
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
      const validSortFields = ['groupName', 'createdAt', 'updatedAt'];
      if (validSortFields.includes(filters.sortBy)) {
        orderBy = { [filters.sortBy]: filters.sortOrder || 'asc' };
      }
    }

    const paginationOptions = PaginationUtils.createPrismaOptions(page, limit);

    // First get all asset groups with asset counts
    const [assetGroups, total] = await Promise.all([
      this.prisma.assetGroup.findMany({
        where: whereCondition,
        ...paginationOptions,
        select: {
          id: true,
          groupName: true,
          parentGroupId: true,
          createdDate: true,
          createdAt: true,
          updatedAt: true,
          userId: true,
          totalSize: true,
          _count: {
            select: {
              assets: true,
              childGroups: true,
            },
          },
        },
        orderBy,
      }),
      this.prisma.assetGroup.count({ where: whereCondition }),
    ]);

    // Apply post-query filters for asset count and size
    let filteredAssetGroups = assetGroups;

    // Filter by asset count
    if (filters.minAssets !== undefined || filters.maxAssets !== undefined) {
      filteredAssetGroups = filteredAssetGroups.filter(group => {
        const assetCount = group._count.assets;
        if (filters.minAssets !== undefined && assetCount < filters.minAssets) {
          return false;
        }
        if (filters.maxAssets !== undefined && assetCount > filters.maxAssets) {
          return false;
        }
        return true;
      });
    }

    // Filter by total size
    if (filters.minSize !== undefined || filters.maxSize !== undefined) {
      filteredAssetGroups = filteredAssetGroups.filter(group => {
        const totalSize = Number(group.totalSize || 0);
        if (filters.minSize !== undefined && totalSize < filters.minSize) {
          return false;
        }
        if (filters.maxSize !== undefined && totalSize > filters.maxSize) {
          return false;
        }
        return true;
      });
    }

    // Filter by has assets
    if (filters.hasAssets !== undefined) {
      filteredAssetGroups = filteredAssetGroups.filter(group => {
        const hasAssets = group._count.assets > 0;
        return filters.hasAssets ? hasAssets : !hasAssets;
      });
    }

    // Convert BigInt to String for JSON serialization
    const transformedAssetGroups = filteredAssetGroups.map(AssetGroupService.convertBigIntToString);
    
    // Update total count if we applied post-query filters
    const finalTotal = (filters.minAssets !== undefined || filters.maxAssets !== undefined || 
                       filters.minSize !== undefined || filters.maxSize !== undefined ||
                       filters.hasAssets !== undefined) ? transformedAssetGroups.length : total;
    
    return PaginationUtils.createPaginatedResponse(transformedAssetGroups, finalTotal, page, limit);
  }

  async findOne(id: number, userId: number) {
    const assetGroup = await this.prisma.assetGroup.findFirst({
      where: { id, userId },
      select: {
        id: true,
        groupName: true,
        parentGroupId: true,
        createdDate: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
        totalSize: true,
        _count: {
          select: {
            assets: true,
            childGroups: true,
          },
        },
      },
    });

    if (!assetGroup) {
      throw new NotFoundException('Asset group not found');
    }

  // Convert BigInt to String for JSON serialization
  return AssetGroupService.convertBigIntToString(assetGroup);
  }

  async getAssetsInGroup(id: number, userId: number, page: number = 1, limit: number = 10, filters: any = {}) {
    const assetGroup = await this.findOne(id, userId);

    const whereCondition: any = {
      assetGroupId: id,
      userId,
    };

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

    // Sorting logic
    let orderBy: any = { createdAt: 'desc' };
    
    if (filters.sortBy) {
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
        select: {
          id: true,
          name: true,
          fileName: true,
          filePath: true,
          mimeType: true,
          uploadDate: true,
          size: true,
          userId: true,
          assetGroupId: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy,
      }),
      this.prisma.asset.count({ where: whereCondition }),
    ]);

  // Convert BigInt to String for JSON serialization
  const transformedAssets = assets.map(AssetGroupService.convertBigIntToString);
  return PaginationUtils.createPaginatedResponse(transformedAssets, total, page, limit);
  }

  async update(id: number, updateAssetGroupDto: UpdateAssetGroupDto, userId: number) {
    const assetGroup = await this.findOne(id, userId);

    // Check if new name conflicts with existing group in the same parent folder
    if (updateAssetGroupDto.groupName && updateAssetGroupDto.groupName !== assetGroup.groupName) {
      const targetParentId = updateAssetGroupDto.parentGroupId !== undefined 
        ? updateAssetGroupDto.parentGroupId 
        : assetGroup.parentGroupId;
        
      const existingGroup = await this.prisma.assetGroup.findFirst({
        where: {
          groupName: updateAssetGroupDto.groupName,
          userId,
          parentGroupId: targetParentId ?? null,
          id: { not: id },
        },
      });

      if (existingGroup) {
        throw new ConflictException('Asset group with this name already exists in this folder');
      }
    }

    // If changing parent, verify the new parent exists
    if (updateAssetGroupDto.parentGroupId !== undefined && updateAssetGroupDto.parentGroupId !== null) {
      const parentGroup = await this.prisma.assetGroup.findFirst({
        where: {
          id: updateAssetGroupDto.parentGroupId,
          userId,
        },
      });

      if (!parentGroup) {
        throw new NotFoundException('Parent folder not found or does not belong to you');
      }
      
      // Prevent circular references - can't be parent of itself
      if (updateAssetGroupDto.parentGroupId === id) {
        throw new ConflictException('A folder cannot be its own parent');
      }
    }

    const updatedAssetGroup = await this.prisma.assetGroup.update({
      where: { id },
      data: updateAssetGroupDto,
      select: {
        id: true,
        groupName: true,
        parentGroupId: true,
        createdDate: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
        _count: {
          select: {
            assets: true,
          },
        },
      },
    });

  // Convert BigInt to String for JSON serialization
  return AssetGroupService.convertBigIntToString(updatedAssetGroup);
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

  async attachAssetsToGroup(groupId: number, assetIds: number[], userId: number) {
    // Ensure group exists and belongs to user
    await this.findOne(groupId, userId);

    // Update assets to attach to group
    const result = await this.prisma.asset.updateMany({
      where: {
        id: { in: assetIds },
        userId,
      },
      data: {
        assetGroupId: groupId,
      },
    });

    return { message: `${result.count} assets attached to group ${groupId}` };
  }
}
