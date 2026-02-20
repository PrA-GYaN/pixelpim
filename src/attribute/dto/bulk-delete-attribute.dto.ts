import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AttributeFilters {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  userFriendlyType?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: string;
}

export class BulkDeleteAttributeDto {
  @IsOptional()
  @IsArray()
  ids?: number[];

  @IsOptional()
  @ValidateNested()
  @Type(() => AttributeFilters)
  filters?: AttributeFilters;
}
