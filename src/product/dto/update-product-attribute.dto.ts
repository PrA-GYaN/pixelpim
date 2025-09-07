import { IsString, IsNotEmpty, IsOptional, IsInt, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ProductAttributeValueDto {
  @IsInt()
  attributeId: number;

  @IsOptional()
  @IsString()
  value?: string;
}

export class UpdateProductAttributesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAttributeValueDto)
  attributes: ProductAttributeValueDto[];
}
