import {
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  IsArray,
  IsObject,
  ValidateNested,
  IsUrl,
  MinLength,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

// DTO for creating a new WooCommerce connection
export class CreateWooCommerceConnectionDto {
  @IsString()
  @MinLength(1)
  storeName: string;

  // @IsUrl({}, { message: 'Store URL must be a valid URL' })
  @IsString()
  storeUrl: string;

  @IsString()
  @MinLength(10)
  consumerKey: string;

  @IsString()
  @MinLength(10)
  consumerSecret: string;

  @IsString()
  @IsOptional()
  webhookSecret?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

// DTO for updating a WooCommerce connection
export class UpdateWooCommerceConnectionDto {
  @IsString()
  @IsOptional()
  storeName?: string;

  @IsString()
  // @IsUrl({}, { message: 'Store URL must be a valid URL' })
  @IsOptional()
  storeUrl?: string;

  @IsString()
  @IsOptional()
  consumerKey?: string;

  @IsString()
  @IsOptional()
  consumerSecret?: string;

  @IsString()
  @IsOptional()
  webhookSecret?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

// Response DTO for WooCommerce connection
export class WooCommerceConnectionResponseDto {
  id: number;
  storeName: string;
  storeUrl: string;
  isActive: boolean;
  isDefault: boolean;
  lastSyncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Sensitive fields excluded (consumerKey, consumerSecret, webhookSecret)
}

// DTO for field mapping structure
export class FieldMappingDto {
  @IsString()
  internalField: string;

  @IsString()
  externalField: string;

  @IsString()
  @IsOptional()
  dataType?: string; // text, number, boolean, array, etc.

  @IsBoolean()
  @IsOptional()
  required?: boolean;
}

// DTO for creating export mapping
export class CreateExportMappingDto {
  @IsInt()
  connectionId: number;

  @IsArray()
  @IsString({ each: true })
  selectedFields: string[]; // Must include 'name' and 'sku' at minimum

  @IsObject()
  @IsOptional()
  fieldMappings?: Record<string, any>; // Maps internal fields to WooCommerce fields
}

// DTO for updating export mapping
export class UpdateExportMappingDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  selectedFields?: string[];

  @IsObject()
  @IsOptional()
  fieldMappings?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

// Response DTO for export mapping
export class ExportMappingResponseDto {
  id: number;
  connectionId: number;
  selectedFields: string[];
  fieldMappings: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// DTO for creating import mapping
export class CreateImportMappingDto {
  @IsInt()
  connectionId: number;

  @IsObject()
  attributeMappings: Record<string, any>; // Maps WooCommerce attributes to internal attributes

  @IsObject()
  @IsOptional()
  fieldMappings?: Record<string, any>; // Maps WooCommerce fields to internal fields
}

// DTO for updating import mapping
export class UpdateImportMappingDto {
  @IsObject()
  @IsOptional()
  attributeMappings?: Record<string, any>;

  @IsObject()
  @IsOptional()
  fieldMappings?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

// Response DTO for import mapping
export class ImportMappingResponseDto {
  id: number;
  connectionId: number;
  attributeMappings: Record<string, any>;
  fieldMappings: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// DTO for exporting products with specific connection
export class ExportProductsDto {
  @IsInt()
  connectionId: number;

  @IsArray()
  @IsInt({ each: true })
  productIds: number[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  fieldsToExport?: string[]; // Override mapping for this export

  @IsBoolean()
  @IsOptional()
  partialUpdate?: boolean; // Only send modified fields
}

// DTO for importing products from WooCommerce
export class ImportProductsDto {
  @IsInt()
  connectionId: number;

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  wooProductIds?: number[]; // Specific products to import, or empty for all

  @IsBoolean()
  @IsOptional()
  updateExisting?: boolean; // Update existing products or skip them

  @IsEnum(['update', 'link', 'skip'])
  @IsOptional()
  onSkuConflict?: 'update' | 'link' | 'skip'; // How to handle SKU conflicts with existing products

  @IsBoolean()
  @IsOptional()
  useMapping?: boolean; // Use stored mapping or default

  @IsInt()
  @IsOptional()
  familyId?: number; // Optional family ID to attach all imported products to
}

// Response DTO for product sync
export class ProductSyncResponseDto {
  connectionId: number;
  productId: number;
  wooProductId?: number;
  status: 'success' | 'error';
  message?: string;
  exportedFields?: string[];
  lastExportedAt?: Date;
}

// Response DTO for import operation
export class ImportProductsResponseDto {
  success: boolean;
  importedCount: number;
  updatedCount: number;
  linkedCount: number;
  failedCount: number;
  products: Array<{
    wooProductId: number;
    productId?: number;
    status: 'imported' | 'updated' | 'linked' | 'error';
    message?: string;
  }>;
}

// Response DTO for batch export
export class ExportProductsResponseDto {
  success: boolean;
  connectionId: number;
  syncedCount: number;
  failedCount: number;
  results: ProductSyncResponseDto[];
}

// DTO for testing connection
export class TestConnectionDto {
  @IsUrl({}, { message: 'Store URL must be a valid URL' })
  storeUrl: string;

  @IsString()
  consumerKey: string;

  @IsString()
  consumerSecret: string;
}

// Response for testing connection
export class TestConnectionResponseDto {
  success: boolean;
  message: string;
  storeInfo?: {
    wpVersion?: string;
    wooVersion?: string;
    storeName?: string;
  };
}
