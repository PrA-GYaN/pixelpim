import { IsArray, IsInt, IsOptional, IsString, IsEnum, ArrayMinSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum ExportFormat {
  CSV = 'csv',
  JSON = 'json',
  EXCEL = 'excel',
}

export enum ProductAttribute {
  ID = 'id',
  NAME = 'name',
  SKU = 'sku',
  STATUS = 'status',
  PRODUCT_LINK = 'productLink',
  IMAGE_URL = 'imageUrl',
  CATEGORY_ID = 'categoryId',
  CATEGORY_NAME = 'categoryName',
  CATEGORY_DESCRIPTION = 'categoryDescription',
  ATTRIBUTE_ID = 'attributeId',
  ATTRIBUTE_NAME = 'attributeName',
  ATTRIBUTE_TYPE = 'attributeType',
  ATTRIBUTE_DEFAULT_VALUE = 'attributeDefaultValue',
  ATTRIBUTE_GROUP_ID = 'attributeGroupId',
  ATTRIBUTE_GROUP_NAME = 'attributeGroupName',
  ATTRIBUTE_GROUP_DESCRIPTION = 'attributeGroupDescription',
  FAMILY_ID = 'familyId',
  FAMILY_NAME = 'familyName',
  VARIANT_COUNT = 'variantCount',
  VARIANT_NAMES = 'variantNames',
  VARIANT_SKUS = 'variantSkus',
  USER_ID = 'userId',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  // New attribute for custom attribute values
  CUSTOM_ATTRIBUTES = 'customAttributes',
}

export class AttributeSelectionDto {
  @IsInt()
  attributeId: number;

  @IsString()
  attributeName: string;

  @IsOptional()
  @IsString()
  columnName?: string; // Custom column name for export
}

export class ExportProductDto {
  @IsArray()
  @IsInt({ each: true })
  @ArrayMinSize(1, { message: 'At least one product ID must be provided' })
  productIds: number[];

  @IsArray()
  @IsEnum(ProductAttribute, { each: true })
  @ArrayMinSize(1, { message: 'At least one attribute must be selected' })
  attributes: ProductAttribute[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttributeSelectionDto)
  selectedAttributes?: AttributeSelectionDto[]; // For custom attribute value exports

  @IsOptional()
  @IsEnum(ExportFormat)
  format?: ExportFormat = ExportFormat.JSON;

  @IsOptional()
  @IsString()
  filename?: string;
}

export class ExportProductResponseDto {
  data: any[];
  format: ExportFormat;
  filename: string;
  totalRecords: number;
  selectedAttributes: ProductAttribute[];
  customAttributes?: AttributeSelectionDto[]; // Include custom attributes in response
  exportedAt: Date;
}
