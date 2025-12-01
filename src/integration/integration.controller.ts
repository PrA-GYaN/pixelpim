import {
  Controller,
  Post,
  Body,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IntegrationService } from './integration.service';
import {
  WooCommerceIntegrationDto,
  WooCommerceIntegrationResponseDto,
} from './woocommerce/dto/woocommerce.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OwnershipGuard } from '../auth/guards/ownership.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { User as GetUser } from '../auth/decorators/user.decorator';
import { EffectiveUserId } from '../auth/decorators/effective-user-id.decorator';
import type { User } from '@prisma/client';

/**
 * Legacy integration controller - kept for backward compatibility
 * @deprecated Use WooCommerceController or AmazonController instead
 */
@Controller('integrate')
@UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
export class IntegrationController {
  private readonly logger = new Logger(IntegrationController.name);

  constructor(private readonly integrationService: IntegrationService) {}

  /**
   * @deprecated Use POST /integration/woocommerce/export instead
   */
  @Post('woocommerce')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'integration', action: 'export' })
  async integrateWooCommerce(
    @Body() integrationDto: WooCommerceIntegrationDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ): Promise<WooCommerceIntegrationResponseDto> {
    this.logger.warn(
      'POST /integrate/woocommerce is deprecated. Use POST /integration/woocommerce/export instead.',
    );
    this.logger.log(
      `User ${user.id} integrating ${integrationDto.productIds.length} products to WooCommerce`,
    );

    const result = await this.integrationService.syncProductsToWooCommerce(
      integrationDto.productIds,
      effectiveUserId,
    );

    return {
      success: result.failedCount === 0,
      syncedCount: result.syncedCount,
      failedCount: result.failedCount,
      woocommerceTotal: result.woocommerceTotal,
      results: result.results,
    };
  }
}