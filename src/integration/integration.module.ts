import { Module } from '@nestjs/common';
import { IntegrationController } from './integration.controller';
import { IntegrationService } from './integration.service';
import { WooCommerceController } from './woocommerce/woocommerce.controller';
import { WooCommerceService } from './woocommerce/woocommerce.service';
import { AmazonController } from './amazon/amazon.controller';
import { AmazonService } from './amazon/amazon.service';
import { IntegrationFactory } from './base/integration.factory';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [
    IntegrationController,
    WooCommerceController,
    AmazonController,
  ],
  providers: [
    IntegrationService,
    WooCommerceService,
    AmazonService,
    IntegrationFactory,
  ],
  exports: [
    IntegrationService,
    WooCommerceService,
    AmazonService,
    IntegrationFactory,
  ],
})
export class IntegrationModule {}