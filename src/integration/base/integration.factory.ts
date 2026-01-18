import { Injectable } from '@nestjs/common';
import { IntegrationType } from './integration-type.enum';
import { BaseIntegrationService } from './base-integration.service';
import { WooCommerceService } from '../woocommerce';
import { AmazonService } from '../amazon';
import { MyDealService } from '../mydeal';

@Injectable()
export class IntegrationFactory {
  constructor(
    private woocommerceService: WooCommerceService,
    private amazonService: AmazonService,
    private mydealService: MyDealService,
  ) {}

  getIntegrationService(type: IntegrationType): BaseIntegrationService {
    switch (type) {
      case IntegrationType.WOOCOMMERCE:
        return this.woocommerceService;
      case IntegrationType.AMAZON:
        return this.amazonService;
      case IntegrationType.MYDEAL:
        return this.mydealService;
      default:
        throw new Error(`Integration type ${type} not supported`);
    }
  }
}
