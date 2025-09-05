import { IsString, IsOptional, IsNumber, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  @Length(1, 100, { message: 'Category name must be between 1 and 100 characters' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @Matches(/^[a-zA-Z0-9\s\-_&()']+$/, { 
    message: 'Category name can only contain letters, numbers, spaces, hyphens, underscores, ampersands, parentheses, and apostrophes' 
  })
  name?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500, { message: 'Description must not exceed 500 characters' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  description?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Parent category ID must be a number' })
  parentCategoryId?: number;
}
