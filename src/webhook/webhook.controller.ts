import { Controller, Post, Get, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OwnershipGuard } from '../auth/guards/ownership.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { User as GetUser } from '../auth/decorators/user.decorator';
import { EffectiveUserId } from '../auth/decorators/effective-user-id.decorator';
import type { User } from '@prisma/client';

@Controller('webhooks')
@UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
export class WebhookController {
  constructor(private webhookService: WebhookService) {}

  @Post()
  @RequirePermissions({ resource: 'webhooks', action: 'create' })
  async createWebhook(
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
    @Body() dto: CreateWebhookDto,
  ) {
    return this.webhookService.createWebhook(effectiveUserId, dto);
  }

  @Get()
  @RequirePermissions({ resource: 'webhooks', action: 'read' })
  async getWebhooks(
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.webhookService.getWebhooks(effectiveUserId);
  }

  @Put(':id')
  @RequirePermissions({ resource: 'webhooks', action: 'update' })
  async updateWebhook(
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
    @Param('id') id: string,
    @Body() dto: Partial<CreateWebhookDto>,
  ) {
    return this.webhookService.updateWebhook(effectiveUserId, +id, dto);
  }

  @Delete(':id')
  @RequirePermissions({ resource: 'webhooks', action: 'delete' })
  async deleteWebhook(
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
    @Param('id') id: string,
  ) {
    return this.webhookService.deleteWebhook(effectiveUserId, +id);
  }
}