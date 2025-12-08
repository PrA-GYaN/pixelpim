import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShareLinkDto } from './dto';
import { customAlphabet } from 'nanoid';

// Generate a non-guessable, URL-safe slug (like Google Drive)
const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 12);

@Injectable()
export class ShareLinkService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new share link for selected assets and/or asset groups
   */
  async create(dto: CreateShareLinkDto, userId: number) {
    const { assetIds = [], assetGroupIds = [] } = dto;

    // Validate that at least one item is being shared
    if (assetIds.length === 0 && assetGroupIds.length === 0) {
      throw new BadRequestException('At least one asset or asset group must be selected');
    }

    // Verify ownership of assets
    if (assetIds.length > 0) {
      const assets = await this.prisma.asset.findMany({
        where: {
          id: { in: assetIds },
          userId,
          isDeleted: false,
        },
      });

      if (assets.length !== assetIds.length) {
        throw new NotFoundException('One or more assets not found or not accessible');
      }
    }

    // Verify ownership of asset groups
    if (assetGroupIds.length > 0) {
      const groups = await this.prisma.assetGroup.findMany({
        where: {
          id: { in: assetGroupIds },
          userId,
        },
      });

      if (groups.length !== assetGroupIds.length) {
        throw new NotFoundException('One or more asset groups not found or not accessible');
      }
    }

    // Generate unique slug
    const slug = nanoid();

    // Create share link with all shared items
    const shareLink = await this.prisma.shareLink.create({
      data: {
        slug,
        userId,
        sharedAssets: {
          create: assetIds.map((assetId) => ({ assetId })),
        },
        sharedAssetGroups: {
          create: assetGroupIds.map((assetGroupId) => ({ assetGroupId })),
        },
      },
      include: {
        sharedAssets: true,
        sharedAssetGroups: true,
      },
    });

    return {
      id: shareLink.id,
      slug: shareLink.slug,
      shareUrl: `/share/${shareLink.slug}`,
      createdAt: shareLink.createdAt,
      itemCount: assetIds.length + assetGroupIds.length,
    };
  }

  /**
   * Get share link details by slug (public access, no auth required)
   */
  async getBySlug(slug: string) {
    const shareLink = await this.prisma.shareLink.findUnique({
      where: { slug, isActive: true },
      include: {
        sharedAssets: {
          include: {
            shareLink: false,
          },
        },
        sharedAssetGroups: {
          include: {
            shareLink: false,
          },
        },
      },
    });

    if (!shareLink) {
      throw new NotFoundException('Share link not found or has been deactivated');
    }

    // Check if expired
    if (shareLink.expiresAt && shareLink.expiresAt < new Date()) {
      throw new NotFoundException('Share link has expired');
    }

    // Increment access count
    await this.prisma.shareLink.update({
      where: { id: shareLink.id },
      data: { accessCount: { increment: 1 } },
    });

    // Fetch full asset and group details
    const assetIds = shareLink.sharedAssets.map((sa) => sa.assetId);
    const groupIds = shareLink.sharedAssetGroups.map((sg) => sg.assetGroupId);

    const [assets, groups] = await Promise.all([
      assetIds.length > 0
        ? this.prisma.asset.findMany({
            where: {
              id: { in: assetIds },
              isDeleted: false,
            },
            include: {
              assetGroup: {
                select: {
                  id: true,
                  groupName: true,
                },
              },
            },
          })
        : [],
      groupIds.length > 0
        ? this.prisma.assetGroup.findMany({
            where: {
              id: { in: groupIds },
            },
            include: {
              assets: {
                where: { isDeleted: false },
                include: {
                  assetGroup: {
                    select: {
                      id: true,
                      groupName: true,
                    },
                  },
                },
              },
              childGroups: {
                include: {
                  _count: {
                    select: { assets: true },
                  },
                },
              },
              _count: {
                select: { assets: true, childGroups: true },
              },
            },
          })
        : [],
    ]);

    // Format assets with download URLs
    const formattedAssets = assets.map((asset) => {
      const relativePath = this.extractRelativePath(asset.filePath);
      return {
        id: asset.id,
        name: asset.name,
        fileName: asset.fileName,
        filePath: asset.filePath,
        mimeType: asset.mimeType,
        size: Number(asset.size),
        uploadDate: asset.uploadDate,
        url: asset.filePath, // Return relative path, frontend will construct full URL
        formattedSize: this.formatBytes(Number(asset.size)),
        assetGroup: asset.assetGroup,
      };
    });

    const formattedGroups = groups.map((group) => ({
      id: group.id,
      groupName: group.groupName,
      createdDate: group.createdDate,
      totalSize: Number(group.totalSize || 0), // Convert BigInt to number
      parentGroupId: group.parentGroupId,
      assetCount: group._count.assets,
      childGroupCount: group._count.childGroups,
      assets: group.assets.map((asset) => {
        return {
          id: asset.id,
          name: asset.name,
          fileName: asset.fileName,
          filePath: asset.filePath,
          mimeType: asset.mimeType,
          size: Number(asset.size), // Convert BigInt to number
          uploadDate: asset.uploadDate,
          url: asset.filePath, // Return relative path, frontend will construct full URL
          formattedSize: this.formatBytes(Number(asset.size)),
        };
      }),
      childGroups: group.childGroups.map((child) => ({
        ...child,
        totalSize: Number(child.totalSize || 0), // Convert BigInt to number
      })),
    }));

    return {
      slug: shareLink.slug,
      createdAt: shareLink.createdAt,
      accessCount: Number(shareLink.accessCount), // Convert to number to avoid BigInt serialization issues
      assets: formattedAssets,
      groups: formattedGroups,
    };
  }

  /**
   * Get user's share links
   */
  async getUserShareLinks(userId: number, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [shareLinks, total] = await Promise.all([
      this.prisma.shareLink.findMany({
        where: { userId, isActive: true },
        include: {
          _count: {
            select: {
              sharedAssets: true,
              sharedAssetGroups: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.shareLink.count({
        where: { userId, isActive: true },
      }),
    ]);

    return {
      data: shareLinks.map((link) => ({
        id: link.id,
        slug: link.slug,
        shareUrl: `/share/${link.slug}`,
        createdAt: link.createdAt,
        expiresAt: link.expiresAt,
        accessCount: Number(link.accessCount), // Convert to number to avoid BigInt serialization issues
        itemCount: link._count.sharedAssets + link._count.sharedAssetGroups,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Deactivate a share link
   */
  async deactivate(id: string, userId: number) {
    const shareLink = await this.prisma.shareLink.findUnique({
      where: { id },
    });

    if (!shareLink) {
      throw new NotFoundException('Share link not found');
    }

    if (shareLink.userId !== userId) {
      throw new BadRequestException('You do not have permission to deactivate this link');
    }

    await this.prisma.shareLink.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Share link deactivated successfully' };
  }

  /**
   * Helper to format bytes
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Extract relative path from absolute file path
   * E.g., "E:\\Savileaf\\PixelPim_backend\\uploads\\4_owner_test_com\\file.jpg" 
   * becomes "4_owner_test_com/file.jpg"
   */
  private extractRelativePath(filePath: string): string {
    // Find the "uploads" directory and get everything after it
    const uploadsIndex = filePath.indexOf('uploads');
    if (uploadsIndex === -1) {
      // If "uploads" not found, just return the last two parts (user folder + filename)
      const parts = filePath.replace(/\\/g, '/').split('/');
      return parts.slice(-2).join('/');
    }
    
    // Get everything after "uploads/"
    const relativePath = filePath
      .substring(uploadsIndex + 'uploads'.length)
      .replace(/\\/g, '/')
      .replace(/^\//, ''); // Remove leading slash if present
    
    return relativePath;
  }
}
