import { IsArray, IsInt, ArrayMinSize, IsString, IsOptional, IsEnum } from 'class-validator';

export class MyDealIntegrationDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  productIds: number[];

  @IsInt()
  @IsOptional()
  connectionId?: number;
}

export class MyDealIntegrationResultDto {
  productId: number;
  status: 'success' | 'error';
  mydealProductId?: string;
  message?: string;
}

export class MyDealIntegrationResponseDto {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  mydealTotal?: number;
  results: MyDealIntegrationResultDto[];
}

export class MyDealWebhookDto {
  @IsString()
  topic: string;

  @IsInt()
  @IsOptional()
  resource_id?: number;

  @IsOptional()
  resource?: any;
}

export enum MyDealWebhookTopic {
  ORDER_CREATED = 'order.created',
  ORDER_UPDATED = 'order.updated',
  ORDER_FULFILLED = 'order.fulfilled',
  ORDER_CANCELLED = 'order.cancelled',
}

// MyDeal API specific DTOs
export interface MyDealTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  'as:client_id': string;
  '.issued': string;
  '.expires': string;
}

export interface MyDealCategory {
  CategoryId: number;
}

export interface MyDealImage {
  Id?: number | null;
  Src: string;
  Position: number;
  Height?: number;
  Width?: number;
}

export interface MyDealOption {
  OptionName: string;
  OptionValue: string;
  Position: number;
}

export interface MyDealMetaInfo {
  Name: string;
  Value: string;
}

export interface MyDealBuyableProduct {
  ExternalBuyableProductID: string;
  SKU: string;
  Price: number;
  Quantity: number;
  ListingStatus: number;
  RRP?: number;
  ProductUnlimited: boolean;
  Options?: MyDealOption[];
  MetaInfo?: MyDealMetaInfo[];
}

export interface MyDealProductPayload {
  ExternalProductId: string;
  ProductSKU: string;
  Title: string;
  Description: string;
  Specifications?: string;
  Brand?: string;
  Tags?: string;
  Condition: string;
  Categories: MyDealCategory[];
  Images: MyDealImage[];
  Weight: number;
  WeightUnit: string;
  Length?: number;
  Height?: number;
  Width?: number;
  DimensionUnit?: string;
  GTIN?: string | null;
  MPN?: string | null;
  RequiresShipping?: boolean;
  ShippingCostCategory?: number;
  CustomFreightSchemeID?: number | null;
  RequestFreightQuote?: boolean;
  ShippingCostStandard?: number;
  ShippingCostExpedited?: number;
  ProductSpecifics?: Array<{ Name: string; Value: string }>;
  IsDirectImport?: boolean;
  DeliveryTime?: string;
  MaxDaysForDelivery?: number;
  Has48HoursDispatch?: boolean;
  BuyableProducts: MyDealBuyableProduct[];
}

export interface MyDealProductResponse {
  ExternalProductId: string;
  ProductSKU: string;
  Title: string;
  Description: string;
  Brand?: string;
  Tags?: string;
  Condition: string;
  Categories: MyDealCategory[];
  Images: MyDealImage[];
  Weight: number;
  WeightUnit: string;
  Length?: number;
  Height?: number;
  Width?: number;
  DimensionUnit?: string;
  GTIN?: string;
  MPN?: string;
  ShippingCostCategory?: number;
  BuyableProducts: MyDealBuyableProduct[];
}

export interface MyDealApiResponse<T = any> {
  ResponseStatus: 'Complete' | 'AsyncResponsePending' | 'Failed' | 'CompleteWithErrors';
  Data?: T;
  PendingUri?: string;
  Errors?: Array<{
    ID: string;
    Code: string;
    Message: string;
  }>;
}

export interface MyDealBuyableProductError {
  ID: string;
  Code: string;
  Message: string;
}

export interface MyDealBuyableProductResponse {
  ExternalBuyableProductID: string;
  SKU: string;
  Errors?: MyDealBuyableProductError[];
  Result: 'Success' | 'Fail';
}

export interface MyDealProductErrorResponse {
  ExternalProductId: string;
  ProductSKU: string;
  BuyableProductResponses?: MyDealBuyableProductResponse[];
  Errors?: MyDealBuyableProductError[];
  Result: 'Success' | 'Fail';
}

export interface MyDealOrder {
  OrderId: number;
  PurchaseDate: string;
  OrderStatus: string;
  SubTotalPrice: number;
  TotalPrice: number;
  TotalShippingPrice: number;
  TaxInclusive: boolean;
  Currency: string;
  CustomerEmail: string;
  ShippingAddress: {
    FirstName: string;
    LastName: string;
    Phone: string;
    CompanyName?: string;
    Address1: string;
    Address2?: string;
    Suburb: string;
    State: string;
    Postcode: string;
    Country: string;
  };
  OrderLines: Array<{
    OrderLineId: number;
    SKU: string;
    ProductTitle: string;
    Quantity: number;
    UnitPrice: number;
    TotalPrice: number;
  }>;
}
export interface MyDealConfigurationDto {
  version: string;
  integrationType: 'mydeal';
  connection: {
    baseApiUrl: string;
    clientId: string;
    clientSecret: string;
    sellerId: string;
    sellerToken: string;
  };
  metadata?: {
    exportedAt: string;
    exportedBy: number;
  };
}

export class ImportConfigurationDto {
  @IsOptional()
  configuration: MyDealConfigurationDto;
}

export class ExportConfigurationResponseDto {
  success: boolean;
  configuration: MyDealConfigurationDto;
  exportedAt: string;
}

export class ImportConfigurationResponseDto {
  success: boolean;
  message: string;
  imported: {
    baseApiUrl: string;
    sellerId: string;
  };
}

export interface MyDealWorkItemDto {
  id: number;
  workItemId: string;
  userId: number;
  productId?: number;
  status: string;
  operation: string;
  requestPayload?: any;
  responseData?: any;
  errorMessage?: string;
  pendingUri?: string;
  externalProductId?: string;
  externalSku?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// DTOs for Update Product Price and Quantity
export class BuyableProductUpdateDto {
  @IsString()
  ExternalBuyableProductID: string;

  @IsString()
  SKU: string;

  @IsOptional()
  Price?: number;

  @IsOptional()
  RRP?: number;

  @IsOptional()
  Quantity?: number;

  @IsOptional()
  ProductUnlimited?: boolean;

  @IsOptional()
  ListingStatus?: number;
}

export class ProductGroupDto {
  @IsString()
  ExternalProductID: string;

  @IsString()
  ProductSKU: string;

  @IsArray()
  @ArrayMinSize(1)
  BuyableProducts: BuyableProductUpdateDto[];
}

export class UpdateProductQuantityPriceDto {
  @IsArray()
  @ArrayMinSize(1)
  products: ProductGroupDto[];

  @IsInt()
  @IsOptional()
  connectionId?: number;
}

// DTOs for Update Product Listing Status
export class BuyableProductListingDto {
  @IsString()
  ExternalBuyableProductID: string;

  @IsString()
  SKU: string;

  @IsString()
  @IsEnum(['NotLive', 'Live'], { message: 'ListingStatus must be either "NotLive" or "Live"' })
  ListingStatus: string;
}

export class ProductGroupListingDto {
  @IsString()
  ExternalProductID: string;

  @IsString()
  ProductSKU: string;

  @IsArray()
  @ArrayMinSize(1)
  BuyableProducts: BuyableProductListingDto[];
}

export class UpdateProductListingStatusDto {
  @IsArray()
  @ArrayMinSize(1)
  products: ProductGroupListingDto[];

  @IsInt()
  @IsOptional()
  connectionId?: number;
}

// Response DTOs
export interface ProductGroupResponse {
  ExternalProductID: string;
  ProductSKU: string;
  Success: boolean;
  Message?: string;
  BuyableProductsProcessed?: number;
}

export interface ErrorResponse {
  ID: string;
  Code: string;
  Message: string;
}

export interface ActionResponse {
  ResponseStatus: 'Complete' | 'AsyncResponsePending' | 'Failed';
  ProductGroups: ProductGroupResponse[];
  Errors?: ErrorResponse[];
  PendingUri?: string;
}