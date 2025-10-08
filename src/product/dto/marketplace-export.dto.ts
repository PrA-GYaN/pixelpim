import { IsEnum, IsOptional, IsArray, IsString, ValidateNested, IsInt, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export enum MarketplaceType {
  AMAZON = 'amazon',
  ALIEXPRESS = 'aliexpress', 
  EBAY = 'ebay',
  ETSY = 'etsy',
  SHOPIFY = 'shopify',
  WALMART = 'walmart',
  FACEBOOK_MARKETPLACE = 'facebook_marketplace',
  GOOGLE_SHOPPING = 'google_shopping',
  CUSTOM = 'custom'
}

export enum EcommerceFieldType {
  // Universal fields
  PRODUCT_NAME = 'product_name',
  PRODUCT_DESCRIPTION = 'product_description',
  SKU = 'sku',
  PRICE = 'price',
  BRAND = 'brand',
  CATEGORY = 'category',
  PRODUCT_IMAGE = 'product_image',
  ADDITIONAL_IMAGES = 'additional_images',
  WEIGHT = 'weight',
  DIMENSIONS = 'dimensions',
  
  // Amazon specific
  AMAZON_ASIN = 'amazon_asin',
  AMAZON_BULLET_POINTS = 'amazon_bullet_points',
  AMAZON_KEYWORDS = 'amazon_keywords',
  AMAZON_PARENT_SKU = 'amazon_parent_sku',
  AMAZON_VARIATION_THEME = 'amazon_variation_theme',
  
  // AliExpress specific
  ALIEXPRESS_SHIPPING_TEMPLATE = 'aliexpress_shipping_template',
  ALIEXPRESS_CATEGORY_ID = 'aliexpress_category_id',
  ALIEXPRESS_LOGISTICS = 'aliexpress_logistics',
  
  // eBay specific
  EBAY_CATEGORY_ID = 'ebay_category_id',
  EBAY_CONDITION = 'ebay_condition',
  EBAY_LISTING_DURATION = 'ebay_listing_duration',
  
  // Etsy specific
  ETSY_TAGS = 'etsy_tags',
  ETSY_MATERIALS = 'etsy_materials',
  ETSY_OCCASION = 'etsy_occasion',
  
  // Shopify specific
  SHOPIFY_PRODUCT_TYPE = 'shopify_product_type',
  SHOPIFY_VENDOR = 'shopify_vendor',
  SHOPIFY_HANDLE = 'shopify_handle',
  
  // Walmart specific
  WALMART_CATEGORY = 'walmart_category',
  WALMART_SUBCATEGORY = 'walmart_subcategory',
  WALMART_GTIN = 'walmart_gtin',
  
  // Google Shopping specific
  GOOGLE_PRODUCT_CATEGORY = 'google_product_category',
  GOOGLE_GTIN = 'google_gtin',
  GOOGLE_MPN = 'google_mpn',
  GOOGLE_CONDITION = 'google_condition',
  
  // Common marketplace fields
  INVENTORY_QUANTITY = 'inventory_quantity',
  SHIPPING_WEIGHT = 'shipping_weight',
  SHIPPING_CLASS = 'shipping_class',
  TAX_CLASS = 'tax_class',
  STATUS = 'status',
  VISIBILITY = 'visibility'
}

export class FieldMappingDto {
  @IsEnum(EcommerceFieldType)
  ecommerceField: EcommerceFieldType;

  @IsString()
  sourceField: string; // PixelPim field name or attribute name

  @IsOptional()
  @IsString()
  defaultValue?: string;

  @IsOptional()
  @IsString()
  transformation?: string; // Optional transformation rule
}

export class MarketplaceTemplateDto {
  @IsEnum(MarketplaceType)
  marketplaceType: MarketplaceType;

  @IsString()
  templateName: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldMappingDto)
  fieldMappings: FieldMappingDto[];

  @IsOptional()
  @IsString()
  csvDelimiter?: string; // Default: comma

  @IsOptional()
  @IsString()
  csvQuote?: string; // Default: double quote

  @IsOptional()
  @IsString()
  fileFormat?: 'csv' | 'xlsx' | 'xml' | 'json'; // Default: csv
}

export class MarketplaceExportDto {
  @IsArray()
  @IsInt({ each: true })
  @ArrayMinSize(1, { message: 'At least one product ID must be provided' })
  productIds: number[];

  @IsEnum(MarketplaceType)
  marketplaceType: MarketplaceType;

  @IsOptional()
  @IsString()
  templateName?: string; // Use predefined template or custom

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldMappingDto)
  customFieldMappings?: FieldMappingDto[]; // Override or add to template

  @IsOptional()
  @IsString()
  filename?: string;

  @IsOptional()
  @IsString()
  fileFormat?: 'csv' | 'xlsx' | 'xml' | 'json';
}

export class MarketplaceExportResponseDto {
  data: any[];
  marketplaceType: MarketplaceType;
  templateUsed: string;
  fileFormat: string;
  filename: string;
  totalRecords: number;
  fieldMappings: FieldMappingDto[];
  exportedAt: Date;
  downloadUrl?: string; // If file is stored temporarily
}