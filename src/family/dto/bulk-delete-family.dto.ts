import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class FamilyFilters {
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

export class BulkDeleteFamilyDto {
  @IsOptional()
  @IsArray()
  ids?: number[];

  @IsOptional()
  @ValidateNested()
  @Type(() => FamilyFilters)
  filters?: FamilyFilters;
}
