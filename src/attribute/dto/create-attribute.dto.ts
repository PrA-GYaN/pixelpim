import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class CreateAttributeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['string', 'number', 'boolean', 'date', 'enum'])
  type: string;
}
