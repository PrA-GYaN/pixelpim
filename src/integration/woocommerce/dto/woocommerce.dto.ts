import { IsArray, IsInt, ArrayMinSize, IsString, IsOptional, IsEnum } from 'class-validator';

export class WooCommerceIntegrationDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  productIds: number[];
}

export class WooCommerceIntegrationResultDto {
  productId: number;
  status: 'success' | 'error';
  wooProductId?: number;
  message?: string;
}

export class WooCommerceIntegrationResponseDto {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  woocommerceTotal?: number;
  results: WooCommerceIntegrationResultDto[];
}

export class WooCommerceWebhookDto {
  @IsString()
  topic: string;

  @IsInt()
  @IsOptional()
  resource_id?: number;

  @IsOptional()
  resource?: any;
}

export enum WooCommerceWebhookTopic {
  PRODUCT_CREATED = 'product.created',
  PRODUCT_UPDATED = 'product.updated',
  PRODUCT_DELETED = 'product.deleted',
  PRODUCT_RESTORED = 'product.restored',
  ORDER_CREATED = 'order.created',
  ORDER_UPDATED = 'order.updated',
}
