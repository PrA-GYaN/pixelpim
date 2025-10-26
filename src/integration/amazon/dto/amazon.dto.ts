import { IsArray, IsInt, ArrayMinSize, IsString, IsOptional } from 'class-validator';

export class AmazonIntegrationDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  productIds: number[];
}

export class AmazonIntegrationResultDto {
  productId: number;
  status: 'success' | 'error';
  asin?: string;
  message?: string;
}

export class AmazonIntegrationResponseDto {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  results: AmazonIntegrationResultDto[];
}

export class AmazonWebhookDto {
  @IsString()
  notificationType: string;

  @IsOptional()
  payload?: any;
}

export enum AmazonNotificationType {
  INVENTORY_UPDATE = 'INVENTORY_UPDATE',
  PRICE_CHANGE = 'PRICE_CHANGE',
  PRODUCT_TYPE_DEFINITIONS = 'PRODUCT_TYPE_DEFINITIONS',
  LISTINGS_ITEM_STATUS_CHANGE = 'LISTINGS_ITEM_STATUS_CHANGE',
  LISTINGS_ITEM_ISSUES_CHANGE = 'LISTINGS_ITEM_ISSUES_CHANGE',
}
