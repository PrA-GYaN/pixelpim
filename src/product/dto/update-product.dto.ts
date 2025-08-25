import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsOptional, IsUrl, IsIn, IsInt, IsArray } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { CreateProductDto } from './create-product.dto';

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  name?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  sku?: string;

  @IsOptional()
  @IsString()
  @IsUrl({}, { message: 'Product link must be a valid URL' })
  productLink?: string;

  @IsOptional()
  @IsString()
  @IsUrl({}, { message: 'Image URL must be a valid URL' })
  imageUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsUrl({}, { each: true, message: 'Each sub image must be a valid URL' })
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
  @Transform(({ value }) => parseInt(value))
  categoryId?: number;

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
  @Transform(({ value }) => parseInt(value))
  attributeGroupId?: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  familyId?: number;
}
