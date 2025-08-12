import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { AttributeType } from '../../../generated/prisma';

export class CreateAttributeDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  name: string;

  @IsEnum(AttributeType, {
    message: `Type must be one of: ${Object.values(AttributeType).join(', ')}`
  })
  @IsNotEmpty()
  type: AttributeType;

  @IsOptional()
  // Let the service handle all type conversion and validation for better performance
  defaultValue?: any;
}
