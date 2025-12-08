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
import { AmazonService } from './amazon.service';
import {
  AmazonIntegrationDto,
  AmazonIntegrationResponseDto,
} from './dto/amazon.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OwnershipGuard } from '../../auth/guards/ownership.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { User as GetUser } from '../../auth/decorators/user.decorator';
import { EffectiveUserId } from '../../auth/decorators/effective-user-id.decorator';
import type { User } from '@prisma/client';

@Controller('integration/amazon')
export class AmazonController {
  private readonly logger = new Logger(AmazonController.name);

  constructor(private readonly amazonService: AmazonService) {}

  @Post('export')
  @UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'integration', action: 'export' })
  async exportProducts(
    @Body() integrationDto: AmazonIntegrationDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ): Promise<AmazonIntegrationResponseDto> {
    this.logger.log(
      `User ${user.id} exporting ${integrationDto.productIds.length} products to Amazon`,
    );

    const result = await this.amazonService.exportProducts(
      integrationDto.productIds,
      effectiveUserId,
    );

    return {
      success: result.failedCount === 0,
      syncedCount: result.syncedCount,
      failedCount: result.failedCount,
      results: result.results.map((r) => ({
        productId: r.productId,
        status: r.status,
        asin: r.externalProductId,
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
    this.logger.log(`User ${user.id} updating product ${productId} in Amazon`);

    const result = await this.amazonService.updateProduct(
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
    this.logger.log(`User ${user.id} deleting product ${productId} from Amazon`);

    const result = await this.amazonService.deleteProduct(
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
    this.logger.log(`User ${user.id} pulling updates from Amazon`);

    const result = await this.amazonService.pullUpdates(effectiveUserId);

    return result;
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers() headers: any,
    @Req() req: Request,
    @Body() body: any,
  ) {
    this.logger.log('Received Amazon webhook notification');

    // Validate webhook signature
    const isValid = await this.amazonService.validateWebhookSignature(headers, body);
    
    if (!isValid) {
      this.logger.warn('Invalid webhook signature');
      return {
        success: false,
        message: 'Invalid signature',
      };
    }

    // Handle the webhook
    const result = await this.amazonService.handleWebhook(body);

    return result;
  }
}
