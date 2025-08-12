import { IsString, IsNotEmpty, IsIn, IsOptional, IsEnum } from 'class-validator';
import { AttributeType } from '../../../generated/prisma';

export class CreateAttributeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(AttributeType)
  @IsNotEmpty()
  type: AttributeType;

  @IsOptional()
  defaultValue?: any; // Can be string, number, boolean, object, array, etc.
}
