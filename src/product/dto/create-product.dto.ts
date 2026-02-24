import { IsString, IsNotEmpty, IsOptional, IsUrl, IsInt, IsIn, IsArray, ValidateNested, Length, IsBoolean } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ProductAttributeValueDto {
  @IsInt()
  attributeId: number;

  @IsOptional()
  @IsString()
  value?: string;
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty({ message: 'Product name is required' })
  @Length(1, 100, { message: 'Product name must be between 1 and 100 characters' })
  @Transform(({ value }) => value?.trim())
  name: string;

  @IsString()
  @IsNotEmpty()
  @Length(4, 40, { message: 'SKU must be between 4 and 40 characters' })
  @Transform(({ value }) => value?.trim())
  sku: string;

  @IsOptional()
  @IsString()
  @IsUrl({}, { message: 'Product link must be a valid URL' })
  productLink?: string;

  @IsOptional()
  @IsString()
  // @IsUrl({}, { message: 'Image URL must be a valid URL' })
  imageUrl?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    @Type(() => String)
    subImages: string[] = [];

  @IsOptional()
  @IsString()
  // @IsUrl({}, { message: 'Thumbnail URL must be a valid URL' })
  thumbnailUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  thumbnailSubImages: string[] = [];

  @IsOptional()
  @IsString()
  @IsIn(['complete', 'incomplete'], { 
    message: 'Status must be one of: complete, incomplete' 
  })
    status: string = 'incomplete';

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => value === null || value === undefined ? value : parseInt(value))
  categoryId?: number | null;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  attributes?: number[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAttributeValueDto)
  attributesWithValues?: ProductAttributeValueDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAttributeValueDto)
  familyAttributesWithValues?: ProductAttributeValueDto[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  assets?: number[];

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => value === null || value === undefined ? value : parseInt(value))
  attributeGroupId?: number | null;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => value === null || value === undefined ? value : parseInt(value))
  familyId?: number | null;

  @IsOptional()
  @IsString()
  @Length(4, 40, { message: 'Parent SKU must be between 4 and 40 characters' })
  @Transform(({ value }) => value?.trim())
  parentSku?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  updateExisting?: boolean;

}
