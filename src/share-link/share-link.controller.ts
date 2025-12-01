import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ShareLinkService } from './share-link.service';
import { CreateShareLinkDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OwnershipGuard } from '../auth/guards/ownership.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { User as GetUser } from '../auth/decorators/user.decorator';
import { EffectiveUserId } from '../auth/decorators/effective-user-id.decorator';
import type { User } from '@prisma/client';

@Controller('share-links')
export class ShareLinkController {
  constructor(private readonly shareLinkService: ShareLinkService) {}

  /**
   * Create a new share link (authenticated)
   */
  @Post()
  @UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
  @RequirePermissions({ resource: 'assets', action: 'read' })
  async create(
    @Body() createShareLinkDto: CreateShareLinkDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.shareLinkService.create(createShareLinkDto, effectiveUserId);
  }

  /**
   * Get user's share links (authenticated)
   */
  @Get()
  @UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
  @RequirePermissions({ resource: 'assets', action: 'read' })
  async getUserShareLinks(
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    return this.shareLinkService.getUserShareLinks(effectiveUserId, pageNum, limitNum);
  }

  /**
   * Deactivate a share link (authenticated)
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
  @RequirePermissions({ resource: 'assets', action: 'update' })
  async deactivate(
    @Param('id') id: string,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.shareLinkService.deactivate(id, effectiveUserId);
  }
}

/**
 * Public controller for accessing shared content (no auth required)
 */
@Controller('share')
export class PublicShareController {
  constructor(private readonly shareLinkService: ShareLinkService) {}

  /**
   * Get shared content by slug (public, no authentication required)
   */
  @Get(':slug')
  async getSharedContent(@Param('slug') slug: string) {
    return this.shareLinkService.getBySlug(slug);
  }
}
