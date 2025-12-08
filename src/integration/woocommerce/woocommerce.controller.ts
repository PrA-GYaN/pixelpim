import {
  Controller,
  Post,
  Body,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
  Req,
  Headers,
  Get,
  Param,
  Delete,
} from '@nestjs/common';
import type { Request } from 'express';
import { WooCommerceService } from './woocommerce.service';
import {
  WooCommerceIntegrationDto,
  WooCommerceIntegrationResponseDto,
} from './dto/woocommerce.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OwnershipGuard } from '../../auth/guards/ownership.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { User as GetUser } from '../../auth/decorators/user.decorator';
import { EffectiveUserId } from '../../auth/decorators/effective-user-id.decorator';
import type { User } from '@prisma/client';

@Controller('integration/woocommerce')
export class WooCommerceController {
  private readonly logger = new Logger(WooCommerceController.name);

  constructor(private readonly woocommerceService: WooCommerceService) {}

  @Post('export')
  @UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'integration', action: 'export' })
  async exportProducts(
    @Body() integrationDto: WooCommerceIntegrationDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ): Promise<WooCommerceIntegrationResponseDto> {
    this.logger.log(
      `User ${user.id} exporting ${integrationDto.productIds.length} products to WooCommerce`,
    );

    const result = await this.woocommerceService.exportProducts(
      integrationDto.productIds,
      effectiveUserId,
    );

    const woocommerceTotal = await this.woocommerceService.getWooCommerceProductCount();

    return {
      success: result.failedCount === 0,
      syncedCount: result.syncedCount,
      failedCount: result.failedCount,
      woocommerceTotal,
      results: result.results.map((r) => ({
        productId: r.productId,
        status: r.status,
        wooProductId: r.externalProductId ? parseInt(r.externalProductId) : undefined,
        message: r.message,
      })),
    };
  }

  @Post('update/:productId')
  @UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'integration', action: 'update' })
  async updateProduct(
    @Param('productId') productId: string,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} updating product ${productId} in WooCommerce`);

    const result = await this.woocommerceService.updateProduct(
      parseInt(productId),
      effectiveUserId,
    );

    return result;
  }

  @Delete(':productId')
  @UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'integration', action: 'delete' })
  async deleteProduct(
    @Param('productId') productId: string,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} deleting product ${productId} from WooCommerce`);

    const result = await this.woocommerceService.deleteProduct(
      parseInt(productId),
      effectiveUserId,
    );

    return result;
  }

  @Get('pull')
  @UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'integration', action: 'read' })
  async pullUpdates(
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} pulling updates from WooCommerce`);

    const result = await this.woocommerceService.pullUpdates(effectiveUserId);

    return result;
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers() headers: any,
    @Req() req: Request,
    @Body() body: any,
  ) {
    this.logger.log('Received WooCommerce webhook');

    // Validate webhook signature
    const isValid = await this.woocommerceService.validateWebhookSignature(headers, body);
    
    if (!isValid) {
      this.logger.warn('Invalid webhook signature');
      return {
        success: false,
        message: 'Invalid signature',
      };
    }

    // Handle the webhook
    const result = await this.woocommerceService.handleWebhook(body);

    return result;
  }
}
