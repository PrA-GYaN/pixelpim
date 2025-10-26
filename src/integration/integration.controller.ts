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
import { User as GetUser } from '../auth/decorators/user.decorator';
import type { User } from '../../generated/prisma';

/**
 * Legacy integration controller - kept for backward compatibility
 * @deprecated Use WooCommerceController or AmazonController instead
 */
@Controller('integrate')
@UseGuards(JwtAuthGuard)
export class IntegrationController {
  private readonly logger = new Logger(IntegrationController.name);

  constructor(private readonly integrationService: IntegrationService) {}

  /**
   * @deprecated Use POST /integration/woocommerce/export instead
   */
  @Post('woocommerce')
  @HttpCode(HttpStatus.OK)
  async integrateWooCommerce(
    @Body() integrationDto: WooCommerceIntegrationDto,
    @GetUser() user: User,
  ): Promise<WooCommerceIntegrationResponseDto> {
    this.logger.warn(
      'POST /integrate/woocommerce is deprecated. Use POST /integration/woocommerce/export instead.',
    );
    this.logger.log(
      `User ${user.id} integrating ${integrationDto.productIds.length} products to WooCommerce`,
    );

    const result = await this.integrationService.syncProductsToWooCommerce(
      integrationDto.productIds,
      user.id,
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