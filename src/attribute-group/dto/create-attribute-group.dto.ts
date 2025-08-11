import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsBoolean, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class AttributeGroupItemDto {
  @IsNumber()
  attributeId: number;

  @IsBoolean()
  @IsOptional()
  required?: boolean = false;

  @IsString()
  @IsOptional()
  defaultValue?: string;
}

export class CreateAttributeGroupDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttributeGroupItemDto)
  attributes: AttributeGroupItemDto[];
}
