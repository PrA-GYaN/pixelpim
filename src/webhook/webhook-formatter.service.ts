import { Injectable } from '@nestjs/common';

export interface WebhookPayload {
  event: string;
  timestamp: string;
  product: any;
}

@Injectable()
export class WebhookFormatterService {
  /**
   * Formats product data for webhook payloads
   * This method can be easily modified to change the product data structure
   */
  formatProductForWebhook(product: any): any {
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      status: product.status,
      categoryId: product.categoryId,
      familyId: product.familyId,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      // Add more fields as needed, or customize the format
      // For example, you could include:
      // imageUrl: product.imageUrl,
      // productLink: product.productLink,
      // category: product.category,
      // family: product.family,
      // attributes: this.formatProductAttributes(product.attributes),
      // ... full product object
    };
  }

  /**
   * Formats product attributes for webhook payloads
   * Can be customized to include only certain attributes or format them differently
   */
  private formatProductAttributes(attributes: any[]): any[] {
    if (!attributes) return [];

    return attributes.map(attr => ({
      id: attr.id || attr.attribute?.id,
      name: attr.name || attr.attribute?.name,
      type: attr.type || attr.attribute?.type,
      value: attr.value,
      defaultValue: attr.defaultValue || attr.attribute?.defaultValue,
    }));
  }

  /**
   * Creates a standardized webhook payload for product events
   */
  createProductWebhookPayload(event: string, product: any): WebhookPayload {
    return {
      event,
      timestamp: new Date().toISOString(),
      product: this.formatProductForWebhook(product),
    };
  }

  /**
   * Creates webhook payload for product creation events
   */
  formatProductCreated(product: any): WebhookPayload {
    return this.createProductWebhookPayload('product.created', product);
  }

  /**
   * Creates webhook payload for product update events
   */
  formatProductUpdated(product: any): WebhookPayload {
    return this.createProductWebhookPayload('product.updated', product);
  }

  /**
   * Creates webhook payload for product deletion events
   */
  formatProductDeleted(product: any): WebhookPayload {
    return this.createProductWebhookPayload('product.deleted', product);
  }

  /**
   * Generic method to create webhook payload for any event type
   */
  formatWebhookPayload(event: string, data: any): WebhookPayload {
    return {
      event,
      timestamp: new Date().toISOString(),
      ...data,
    };
  }
}
