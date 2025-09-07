import { IsString, IsNotEmpty, IsOptional, IsUrl, IsInt, IsIn, IsArray, ValidateNested } from 'class-validator';
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
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  name: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  sku: string;

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
    subImages: string[] = [];

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

}
