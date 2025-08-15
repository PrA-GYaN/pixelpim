import { IsOptional, IsString, IsEnum, IsIn, IsArray } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export enum FamilySortField {
  NAME = 'name',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  TOTAL_PRODUCTS = 'totalProducts',
  TOTAL_ATTRIBUTES = 'totalAttributes',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export enum DateFilter {
  LATEST = 'latest',
  OLDEST = 'oldest',
}

export class FamilyFilterDto {
  @IsOptional()
  @IsString()
  search?: string; // Search by name

  @IsOptional()
  @IsEnum(FamilySortField)
  sortBy?: FamilySortField = FamilySortField.NAME;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.ASC;

  @IsOptional()
  @IsEnum(DateFilter)
  dateFilter?: DateFilter;

  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;

  // Filter by selected attributes containing family
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    }
    return Array.isArray(value) ? value.map(id => parseInt(id, 10)).filter(id => !isNaN(id)) : [];
  })
  attributeIds?: number[]; // Filter families that contain these attributes

  @IsOptional()
  @IsString()
  attributeFilter?: 'any' | 'all'; // 'any' = family contains any of the attributes, 'all' = family contains all attributes

  // Additional filters
  @IsOptional()
  @Type(() => Number)
  minProducts?: number; // Minimum number of products in family

  @IsOptional()
  @Type(() => Number)
  maxProducts?: number; // Maximum number of products in family

  @IsOptional()
  @Type(() => Number)
  minAttributes?: number; // Minimum number of attributes in family

  @IsOptional()
  @Type(() => Number)
  maxAttributes?: number; // Maximum number of attributes in family

  @IsOptional()
  @IsString()
  hasProducts?: string; // 'true' or 'false' - filter families with/without products

  @IsOptional()
  @IsString()
  hasRequiredAttributes?: string; // 'true' or 'false' - filter families with/without required attributes

  @IsOptional()
  @IsString()
  createdAfter?: string; // ISO date string

  @IsOptional()
  @IsString()
  createdBefore?: string; // ISO date string
}
