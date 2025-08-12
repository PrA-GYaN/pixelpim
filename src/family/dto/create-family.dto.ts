import { IsString, IsNotEmpty, IsArray, IsOptional, ValidateNested, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class FamilyAttributeDto {
  @IsNumber()
  attributeId: number;

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean = false;

  @IsString()
  @IsOptional()
  defaultValue?: string;
}

export class CreateFamilyDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FamilyAttributeDto)
  @IsOptional()
  requiredAttributes?: FamilyAttributeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FamilyAttributeDto)
  @IsOptional()
  otherAttributes?: FamilyAttributeDto[];
}
