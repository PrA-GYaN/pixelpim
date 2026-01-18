import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { MyDealService } from './mydeal.service';
import {
  MyDealIntegrationDto,
  MyDealIntegrationResponseDto,
  UpdateProductQuantityPriceDto,
  UpdateProductListingStatusDto,
  ActionResponse,
} from './dto/mydeal.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OwnershipGuard } from '../../auth/guards/ownership.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { User as GetUser } from '../../auth/decorators/user.decorator';
import { EffectiveUserId } from '../../auth/decorators/effective-user-id.decorator';
import type { User } from '@prisma/client';

@Controller('integration/mydeal')
export class MyDealController {
  private readonly logger = new Logger(MyDealController.name);

  constructor(private readonly mydealService: MyDealService) {}

  @Post('export')
  @UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'integration', action: 'export' })
  async exportProducts(
    @Body() integrationDto: MyDealIntegrationDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ): Promise<MyDealIntegrationResponseDto> {
    this.logger.log(
      `User ${user.id} exporting ${integrationDto.productIds.length} products to MyDeal Connection Id ${integrationDto.connectionId}`,
    );

    const result = await this.mydealService.exportProducts(
      integrationDto.productIds,
      effectiveUserId,
      integrationDto.connectionId,
    );

    const mydealTotal = await this.mydealService.getMyDealProductCount(
      effectiveUserId,
      integrationDto.connectionId,
    );

    return {
      success: result.failedCount === 0,
      syncedCount: result.syncedCount,
      failedCount: result.failedCount,
      mydealTotal,
      results: result.results.map((r) => ({
        productId: r.productId,
        status: r.status,
        mydealProductId: r.externalProductId,
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
    @Body() body: { connectionId?: number },
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} updating product ${productId} in MyDeal`);

    const result = await this.mydealService.updateProduct(
      parseInt(productId),
      effectiveUserId,
      body.connectionId,
    );

    return result;
  }

  @Delete(':productId')
  @UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'integration', action: 'delete' })
  async deleteProduct(
    @Param('productId') productId: string,
    @Body() body: { connectionId?: number },
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} deleting product ${productId} from MyDeal`);

    const result = await this.mydealService.deleteProduct(
      parseInt(productId),
      effectiveUserId,
      body.connectionId,
    );

    return result;
  }

  @Get('orders')
  @UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'integration', action: 'read' })
  async getOrders(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('status') status: string,
    @Query('connectionId') connectionId: string,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} fetching orders from MyDeal`);

    const orders = await this.mydealService.getOrders(effectiveUserId, {
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      status,
      connectionId: connectionId ? parseInt(connectionId) : undefined,
    });

    return {
      success: true,
      orders,
      count: orders.length,
    };
  }

  @Get('products')
  @UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'integration', action: 'read' })
  async getProducts(
    @Query('connectionId') connectionId: string,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} fetching products from MyDeal`);

    const result = await this.mydealService.pullUpdates(
      effectiveUserId,
      connectionId ? parseInt(connectionId) : undefined,
    );

    return result;
  }

  @Get('work-item/:workItemId')
  @UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'integration', action: 'read' })
  async checkWorkItemStatus(
    @Param('workItemId') workItemId: string,
    @Query('connectionId') connectionId: string,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} checking MyDeal work item ${workItemId}`);

    const result = await this.mydealService.checkWorkItemStatus(
      workItemId,
      effectiveUserId,
      connectionId ? parseInt(connectionId) : undefined,
    );

    return result;
  }

  @Post('pull-updates')
  @UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'integration', action: 'import' })
  async pullUpdates(
    @Body() body: { connectionId?: number },
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} pulling updates from MyDeal`);

    const result = await this.mydealService.pullUpdates(
      effectiveUserId,
      body.connectionId,
    );

    return result;
  }

  @Get('work-items')
  @UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'integration', action: 'read' })
  async getWorkItems(
    @Query('status') status: string,
    @Query('operation') operation: string,
    @Query('productId') productId: string,
    @Query('limit') limit: string,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    this.logger.log(`User ${user.id} fetching MyDeal work items`);

    const filters: any = {};
    if (status) filters.status = status;
    if (operation) filters.operation = operation;
    if (productId) filters.productId = parseInt(productId);
    if (limit) filters.limit = parseInt(limit);

    const result = await this.mydealService.getWorkItems(effectiveUserId, filters);

    return result;
  }

  @Post('products/quantityprice')
  @UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'integration', action: 'update' })
  async updateProductQuantityPrice(
    @Body() updateDto: UpdateProductQuantityPriceDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ): Promise<ActionResponse> {
    this.logger.log(
      `User ${user.id} updating price/quantity for ${updateDto.products.length} products on MyDeal`,
    );

    // Validate batch size (max 250 products)
    if (updateDto.products.length > 250) {
      return {
        ResponseStatus: 'Failed',
        ProductGroups: [],
        Errors: [
          {
            ID: 'BATCH_COUNT_EXCEEDED',
            Code: 'BatchCountExceeded',
            Message: 'Maximum 250 products allowed per request',
          },
        ],
      };
    }

    const result = await this.mydealService.updateProductQuantityPrice(
      updateDto.products,
      effectiveUserId,
      updateDto.connectionId,
    );

    return result;
  }

  @Post('products/listingstatus')
  @UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'integration', action: 'update' })
  async updateProductListingStatus(
    @Body() updateDto: UpdateProductListingStatusDto,
    @GetUser() user: User,
    @EffectiveUserId() effectiveUserId: number,
  ): Promise<ActionResponse> {
    this.logger.log(
      `User ${user.id} updating listing status for ${updateDto.products.length} products on MyDeal`,
    );

    // Validate batch size (max 100 products)
    if (updateDto.products.length > 100) {
      return {
        ResponseStatus: 'Failed',
        ProductGroups: [],
        Errors: [
          {
            ID: 'BATCH_COUNT_EXCEEDED',
            Code: 'BatchCountExceeded',
            Message: 'Maximum 100 products allowed per request',
          },
        ],
      };
    }

    const result = await this.mydealService.updateProductListingStatus(
      updateDto.products,
      effectiveUserId,
      updateDto.connectionId,
    );

    return result;
  }
}
