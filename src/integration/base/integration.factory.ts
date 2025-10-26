import { Injectable } from '@nestjs/common';
import { IntegrationType } from './integration-type.enum';
import { BaseIntegrationService } from './base-integration.service';
import { WooCommerceService } from '../woocommerce';
import { AmazonService } from '../amazon';

@Injectable()
export class IntegrationFactory {
  constructor(
    private woocommerceService: WooCommerceService,
    private amazonService: AmazonService,
  ) {}

  getIntegrationService(type: IntegrationType): BaseIntegrationService {
    switch (type) {
      case IntegrationType.WOOCOMMERCE:
        return this.woocommerceService;
      case IntegrationType.AMAZON:
        return this.amazonService;
      default:
        throw new Error(`Integration type ${type} not supported`);
    }
  }
}
