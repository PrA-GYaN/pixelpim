import { IsString, IsNotEmpty, IsArray, IsOptional, ValidateNested, IsNumber, IsBoolean, Length, Matches } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class FamilyAttributeDto {
  @IsNumber()
  attributeId: number;

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean = false;

  @IsOptional()
  additionalValue?: any; // Can be string, number, boolean, object, array, etc.
}

export class CreateFamilyDto {
  @IsString()
  @IsNotEmpty({ message: 'Family name is required' })
  @Length(1, 40, { message: 'Family name must be between 1 and 40 characters' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @Matches(/^[a-zA-Z0-9\s\-_&()']+$/, { 
    message: 'Family name can only contain letters, numbers, spaces, hyphens, underscores, ampersands, parentheses, and apostrophes' 
  })
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
