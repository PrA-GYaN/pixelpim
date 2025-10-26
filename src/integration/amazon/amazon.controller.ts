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
import { User as GetUser } from '../../auth/decorators/user.decorator';
import type { User } from '../../../generated/prisma';

@Controller('integration/amazon')
export class AmazonController {
  private readonly logger = new Logger(AmazonController.name);

  constructor(private readonly amazonService: AmazonService) {}

  @Post('export')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async exportProducts(
    @Body() integrationDto: AmazonIntegrationDto,
    @GetUser() user: User,
  ): Promise<AmazonIntegrationResponseDto> {
    this.logger.log(
      `User ${user.id} exporting ${integrationDto.productIds.length} products to Amazon`,
    );

    const result = await this.amazonService.exportProducts(
      integrationDto.productIds,
      user.id,
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
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateProduct(
    @Param('productId') productId: string,
    @GetUser() user: User,
  ) {
    this.logger.log(`User ${user.id} updating product ${productId} in Amazon`);

    const result = await this.amazonService.updateProduct(
      parseInt(productId),
      user.id,
    );

    return result;
  }

  @Delete(':productId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deleteProduct(
    @Param('productId') productId: string,
    @GetUser() user: User,
  ) {
    this.logger.log(`User ${user.id} deleting product ${productId} from Amazon`);

    const result = await this.amazonService.deleteProduct(
      parseInt(productId),
      user.id,
    );

    return result;
  }

  @Get('pull')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async pullUpdates(@GetUser() user: User) {
    this.logger.log(`User ${user.id} pulling updates from Amazon`);

    const result = await this.amazonService.pullUpdates(user.id);

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
    const isValid = this.amazonService.validateWebhookSignature(headers, body);
    
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
