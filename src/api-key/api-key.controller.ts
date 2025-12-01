import { Controller, Post, Get, UseGuards, Request } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OwnershipGuard } from '../auth/guards/ownership.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { User as GetUser } from '../auth/decorators/user.decorator';
import { EffectiveUserId } from '../auth/decorators/effective-user-id.decorator';
import type { User } from '@prisma/client';

@Controller('api-keys')
@UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
@RequirePermissions({ resource: 'api-keys', action: 'manage' })
export class ApiKeyController {
  constructor(private apiKeyService: ApiKeyService) {}

  @Post('generate')
  async generateKeys(
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.apiKeyService.generateKeys(effectiveUserId);
  }

  @Get()
  async getKeys(
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.apiKeyService.getKeys(effectiveUserId);
  }

  @Post('regenerate')
  async regenerateKeys(
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.apiKeyService.regenerateKeys(effectiveUserId);
  }
}