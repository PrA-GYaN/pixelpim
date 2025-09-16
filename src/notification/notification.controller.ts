import {
  Controller,
  Get,
  Query,
  UseGuards,
  Logger,
  UseInterceptors,
  ClassSerializerInterceptor,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { GetNotificationsDto } from './dto/get-notifications.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User as GetUser } from '../auth/decorators/user.decorator';
import { PaginatedResponse } from '../common';
import type { User } from '../../generated/prisma';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async getNotifications(
    @GetUser() user: User,
    @Query() query: GetNotificationsDto,
  ): Promise<PaginatedResponse<NotificationResponseDto>> {
    this.logger.log(`User ${user.id} fetching notifications with filters: ${JSON.stringify(query)}`);
    
    return this.notificationService.getNotifications(
      user.id,
      query.page,
      query.limit,
      query.entityType,
      query.action,
    );
  }

  @Delete('cleanup')
  @HttpCode(HttpStatus.OK)
  async cleanupOldNotifications(
    @GetUser() user: User,
  ): Promise<{ message: string; deletedCount: number }> {
    this.logger.log(`User ${user.id} cleaning up old notifications`);
    
    const deletedCount = await this.notificationService.deleteOldNotifications(user.id);
    
    return {
      message: `Successfully deleted ${deletedCount} old notifications`,
      deletedCount,
    };
  }

  @Get('stats')
  async getNotificationStats(
    @GetUser() user: User,
  ): Promise<{
    totalNotifications: number;
    byEntityType: Record<string, number>;
    byAction: Record<string, number>;
    recentActivity: number;
  }> {
    this.logger.log(`User ${user.id} fetching notification statistics`);
    
    // Get all notifications for stats
  const allNotifications = await this.notificationService.getNotifications(user.id, 1, 1000);
    
    const byEntityType: Record<string, number> = {};
    const byAction: Record<string, number> = {};
    
    // Count recent activity (last 24 hours)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    let recentActivity = 0;
    
    allNotifications.data.forEach(notification => {
      // Count by entity type
      byEntityType[notification.entityType] = (byEntityType[notification.entityType] || 0) + 1;
      
      // Count by action
      byAction[notification.action] = (byAction[notification.action] || 0) + 1;
      
      // Count recent activity
      if (new Date(notification.createdAt) > yesterday) {
        recentActivity++;
      }
    });
    
    return {
      totalNotifications: allNotifications.pagination.total,
      byEntityType,
      byAction,
      recentActivity,
    };
  }
}
