import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { PaginatedResponse } from '../common';

export enum EntityType {
  PRODUCT = 'product',
  ATTRIBUTE = 'attribute',
  ATTRIBUTE_GROUP = 'attributeGroup',
  CATEGORY = 'category',
  FAMILY = 'family',
  ASSET = 'asset',
  ASSET_GROUP = 'assetGroup',
  PRODUCT_VARIANT = 'productVariant',
  PRODUCT_ATTRIBUTE = 'productAttribute',
}

export enum ActionType {
  CREATED = 'created',
  UPDATED = 'updated',
  DELETED = 'deleted',
  BULK_CREATED = 'bulk_created',
  BULK_UPDATED = 'bulk_updated',
  BULK_DELETED = 'bulk_deleted',
  LINKED = 'linked',
  UNLINKED = 'unlinked',
}

export interface NotificationMetadata {
  [key: string]: any;
  count?: number;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  affectedItems?: string[];
  details?: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private prisma: PrismaService) {}

  async createNotification(
    userId: number,
    entityType: EntityType,
    action: ActionType,
    entityName: string,
    entityId?: number,
    metadata?: NotificationMetadata,
  ): Promise<void> {
    try {
      const message = this.generateMessage(entityType, action, entityName, metadata);
      
      await this.prisma.notification.create({
        data: {
          userId,
          entityType,
          entityId,
          action,
          entityName,
          message,
          metadata: metadata || {},
        },
      });

      this.logger.log(`Notification created for user ${userId}: ${message}`);
    } catch (error) {
      this.logger.error(`Failed to create notification for user ${userId}:`, error);
      // Don't throw error to avoid breaking the main operation
    }
  }

  async getNotifications(
    userId: number,
    page: number = 1,
    limit: number = 20,
    entityType?: string,
    action?: string,
  ): Promise<PaginatedResponse<NotificationResponseDto>> {
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (entityType) where.entityType = entityType;
    if (action) where.action = action;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: notifications.map(notification => new NotificationResponseDto({
        ...notification,
        entityId: notification.entityId ?? undefined,
        entityName: notification.entityName ?? undefined,
        createdAt: typeof notification.createdAt === 'string' ? notification.createdAt : notification.createdAt?.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async deleteOldNotifications(userId: number, daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.prisma.notification.deleteMany({
      where: {
        userId,
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    this.logger.log(`Deleted ${result.count} old notifications for user ${userId}`);
    return result.count;
  }

  async markAllAsRead(userId: number): Promise<void> {
    // For future implementation if we add read/unread status
    this.logger.log(`Marked all notifications as read for user ${userId}`);
  }

  private generateMessage(
    entityType: EntityType,
    action: ActionType,
    entityName: string,
    metadata?: NotificationMetadata,
  ): string {
    const entityDisplayName = this.getEntityDisplayName(entityType);
    
    switch (action) {
      case ActionType.CREATED:
        return `${entityDisplayName} "${entityName}" was created`;
      
      case ActionType.UPDATED:
        return `${entityDisplayName} "${entityName}" was updated`;
      
      case ActionType.DELETED:
        return `${entityDisplayName} "${entityName}" was deleted`;
      
      case ActionType.BULK_CREATED:
        const createdCount = metadata?.count || 'Multiple';
        return `${createdCount} ${entityDisplayName.toLowerCase()}${createdCount !== 1 ? 's' : ''} were created`;
      
      case ActionType.BULK_UPDATED:
        const updatedCount = metadata?.count || 'Multiple';
        return `${updatedCount} ${entityDisplayName.toLowerCase()}${updatedCount !== 1 ? 's' : ''} were updated`;
      
      case ActionType.BULK_DELETED:
        const deletedCount = metadata?.count || 'Multiple';
        return `${deletedCount} ${entityDisplayName.toLowerCase()}${deletedCount !== 1 ? 's' : ''} were deleted`;
      
      case ActionType.LINKED:
        return `${entityDisplayName} "${entityName}" was linked${metadata?.details ? ` ${metadata.details}` : ''}`;
      
      case ActionType.UNLINKED:
        return `${entityDisplayName} "${entityName}" was unlinked${metadata?.details ? ` ${metadata.details}` : ''}`;
      
      default:
        return `${entityDisplayName} "${entityName}" was ${action}`;
    }
  }

  private getEntityDisplayName(entityType: EntityType): string {
    switch (entityType) {
      case EntityType.PRODUCT:
        return 'Product';
      case EntityType.ATTRIBUTE:
        return 'Attribute';
      case EntityType.ATTRIBUTE_GROUP:
        return 'Attribute Group';
      case EntityType.CATEGORY:
        return 'Category';
      case EntityType.FAMILY:
        return 'Family';
      case EntityType.ASSET:
        return 'Asset';
      case EntityType.ASSET_GROUP:
        return 'Asset Group';
      case EntityType.PRODUCT_VARIANT:
        return 'Product Variant';
      case EntityType.PRODUCT_ATTRIBUTE:
        return 'Product Attribute';
      default:
        return 'Item';
    }
  }

  // Helper methods for common notification patterns
  async logProductCreation(userId: number, productName: string, productId: number): Promise<void> {
    await this.createNotification(
      userId,
      EntityType.PRODUCT,
      ActionType.CREATED,
      productName,
      productId,
    );
  }

  async logProductUpdate(userId: number, productName: string, productId: number, oldValues?: any, newValues?: any): Promise<void> {
    await this.createNotification(
      userId,
      EntityType.PRODUCT,
      ActionType.UPDATED,
      productName,
      productId,
      { oldValues, newValues },
    );
  }

  async logProductDeletion(userId: number, productName: string): Promise<void> {
    await this.createNotification(
      userId,
      EntityType.PRODUCT,
      ActionType.DELETED,
      productName,
    );
  }

  async logAttributeCreation(userId: number, attributeName: string, attributeId: number): Promise<void> {
    await this.createNotification(
      userId,
      EntityType.ATTRIBUTE,
      ActionType.CREATED,
      attributeName,
      attributeId,
    );
  }

  async logAttributeUpdate(userId: number, attributeName: string, attributeId: number): Promise<void> {
    await this.createNotification(
      userId,
      EntityType.ATTRIBUTE,
      ActionType.UPDATED,
      attributeName,
      attributeId,
    );
  }

  async logAttributeDeletion(userId: number, attributeName: string): Promise<void> {
    await this.createNotification(
      userId,
      EntityType.ATTRIBUTE,
      ActionType.DELETED,
      attributeName,
    );
  }

  async logCategoryCreation(userId: number, categoryName: string, categoryId: number): Promise<void> {
    await this.createNotification(
      userId,
      EntityType.CATEGORY,
      ActionType.CREATED,
      categoryName,
      categoryId,
    );
  }

  async logCategoryUpdate(userId: number, categoryName: string, categoryId: number): Promise<void> {
    await this.createNotification(
      userId,
      EntityType.CATEGORY,
      ActionType.UPDATED,
      categoryName,
      categoryId,
    );
  }

  async logCategoryDeletion(userId: number, categoryName: string): Promise<void> {
    await this.createNotification(
      userId,
      EntityType.CATEGORY,
      ActionType.DELETED,
      categoryName,
    );
  }

  async logFamilyCreation(userId: number, familyName: string, familyId: number): Promise<void> {
    await this.createNotification(
      userId,
      EntityType.FAMILY,
      ActionType.CREATED,
      familyName,
      familyId,
    );
  }

  async logFamilyUpdate(userId: number, familyName: string, familyId: number): Promise<void> {
    await this.createNotification(
      userId,
      EntityType.FAMILY,
      ActionType.UPDATED,
      familyName,
      familyId,
    );
  }

  async logFamilyDeletion(userId: number, familyName: string): Promise<void> {
    await this.createNotification(
      userId,
      EntityType.FAMILY,
      ActionType.DELETED,
      familyName,
    );
  }

  async logAssetCreation(userId: number, assetName: string, assetId: number): Promise<void> {
    await this.createNotification(
      userId,
      EntityType.ASSET,
      ActionType.CREATED,
      assetName,
      assetId,
    );
  }

  async logAssetUpdate(userId: number, assetName: string, assetId: number): Promise<void> {
    await this.createNotification(
      userId,
      EntityType.ASSET,
      ActionType.UPDATED,
      assetName,
      assetId,
    );
  }

  async logAssetDeletion(userId: number, assetName: string): Promise<void> {
    await this.createNotification(
      userId,
      EntityType.ASSET,
      ActionType.DELETED,
      assetName,
    );
  }

  async logProductVariantCreation(userId: number, productAName: string, productBName: string): Promise<void> {
    await this.createNotification(
      userId,
      EntityType.PRODUCT_VARIANT,
      ActionType.LINKED,
      `${productAName} and ${productBName}`,
      undefined,
      { details: 'as variants' },
    );
  }

  async logProductVariantDeletion(userId: number, productAName: string, productBName: string): Promise<void> {
    await this.createNotification(
      userId,
      EntityType.PRODUCT_VARIANT,
      ActionType.UNLINKED,
      `${productAName} and ${productBName}`,
      undefined,
      { details: 'variant relationship removed' },
    );
  }

  async logBulkOperation(
    userId: number,
    entityType: EntityType,
    action: ActionType,
    count: number,
    entityTypeName: string,
  ): Promise<void> {
    await this.createNotification(
      userId,
      entityType,
      action,
      entityTypeName,
      undefined,
      { count },
    );
  }
}
