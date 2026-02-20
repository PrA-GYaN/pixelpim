import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CategoryFilters {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: string;
}

export class BulkDeleteCategoryDto {
  @IsOptional()
  @IsArray()
  ids?: number[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CategoryFilters)
  filters?: CategoryFilters;
}
