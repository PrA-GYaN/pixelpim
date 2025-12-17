import { Module } from '@nestjs/common';
import { IntegrationController } from './integration.controller';
import { IntegrationService } from './integration.service';
import { IntegrationLogController } from './integration-log.controller';
import { IntegrationLogService } from './integration-log.service';
import { WooCommerceController } from './woocommerce/woocommerce.controller';
import { WooCommerceService } from './woocommerce/woocommerce.service';
import { WooCommerceConnectionController } from './woocommerce/woocommerce-connection.controller';
import { WooCommerceConnectionService } from './woocommerce/woocommerce-connection.service';
import { WooCommerceMultiStoreService } from './woocommerce/woocommerce-multistore.service';
import { AmazonController } from './amazon/amazon.controller';
import { AmazonService } from './amazon/amazon.service';
import { IntegrationFactory } from './base/integration.factory';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [
    IntegrationController,
    IntegrationLogController,
    WooCommerceController,
    WooCommerceConnectionController,
    AmazonController,
  ],
  providers: [
    IntegrationService,
    IntegrationLogService,
    WooCommerceService,
    WooCommerceConnectionService,
    WooCommerceMultiStoreService,
    AmazonService,
    IntegrationFactory,
  ],
  exports: [
    IntegrationService,
    IntegrationLogService,
    WooCommerceService,
    WooCommerceConnectionService,
    WooCommerceMultiStoreService,
    AmazonService,
    IntegrationFactory,
  ],
})
export class IntegrationModule {}