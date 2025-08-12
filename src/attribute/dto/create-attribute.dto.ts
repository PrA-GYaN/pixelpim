import { IsString, IsNotEmpty, IsIn, IsOptional, IsObject } from 'class-validator';

export class CreateAttributeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @IsIn([
    'STRING', 'TEXT', 'NUMBER', 'INTEGER', 'FLOAT', 'BOOLEAN', 
    'DATE', 'DATETIME', 'TIME', 'EMAIL', 'URL', 'PHONE', 
    'ENUM', 'JSON', 'ARRAY', 'FILE', 'IMAGE', 'COLOR', 
    'CURRENCY', 'PERCENTAGE'
  ])
  type: string;

  @IsOptional()
  defaultValue?: any; // Can be string, number, boolean, object, array, etc.
}
