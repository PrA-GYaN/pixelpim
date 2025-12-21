import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsOptional, IsUrl, IsIn, IsInt, IsArray, Length } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { CreateProductDto } from './create-product.dto';

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @IsOptional()
  @IsString()
  @Length(1, 100, { message: 'Product name must be between 1 and 100 characters' })
  @Transform(({ value }) => value?.trim())
  name?: string;

  @IsOptional()
  @IsString()
  @Length(4, 40, { message: 'SKU must be between 4 and 40 characters' })
  @Transform(({ value }) => value?.trim())
  sku?: string;

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
  // @IsUrl({}, { each: true, message: 'Each sub image must be a valid URL' })
  @Type(() => String)
  subImages?: string[];

  @IsOptional()
  @IsString()
  @IsIn(['complete', 'incomplete'], { 
    message: 'Status must be one of: complete, incomplete' 
  })
  status?: string;

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
  @IsInt()
  @Transform(({ value }) => value === null || value === undefined ? value : parseInt(value))
  parentProductId?: number | null;
}
