import { IsOptional, IsString, IsEnum, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { UserAttributeType } from '../../types/user-attribute-type.enum';

export enum AttributeSortField {
  NAME = 'name',
  TYPE = 'type',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  TOTAL_ATTRIBUTES = 'totalAttributes', // For attribute groups
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export enum DateFilter {
  LATEST = 'latest',
  OLDEST = 'oldest',
}

export class AttributeFilterDto {
  @IsOptional()
  @IsString()
  search?: string; // Search by name

  @IsOptional()
  @IsEnum(UserAttributeType)
  userFriendlyType?: UserAttributeType; // Filter by user-friendly type

  @IsOptional()
  @IsEnum(DateFilter)
  dateFilter?: DateFilter; // Latest/newest or oldest

  @IsOptional()
  @IsEnum(AttributeSortField)
  sortBy?: AttributeSortField = AttributeSortField.NAME;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.ASC;

  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;

  // Additional filters
  @IsOptional()
  @IsString()
  hasDefaultValue?: string; // 'true' or 'false' - filter attributes with/without default values

  @IsOptional()
  @IsString()
  inGroups?: string; // 'true' or 'false' - filter attributes that are in groups

  @IsOptional()
  @IsString()
  createdAfter?: string; // ISO date string

  @IsOptional()
  @IsString()
  createdBefore?: string; // ISO date string
}

export class AttributeGroupFilterDto {
  @IsOptional()
  @IsString()
  search?: string; // Search by name or description

  @IsOptional()
  @IsEnum(AttributeSortField)
  @IsIn([AttributeSortField.NAME, AttributeSortField.CREATED_AT, AttributeSortField.UPDATED_AT, AttributeSortField.TOTAL_ATTRIBUTES])
  sortBy?: AttributeSortField = AttributeSortField.NAME;

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

  // Additional filters
  @IsOptional()
  @IsString()
  hasDescription?: string; // 'true' or 'false'

  @IsOptional()
  @Type(() => Number)
  minAttributes?: number; // Minimum number of attributes in group

  @IsOptional()
  @Type(() => Number)
  maxAttributes?: number; // Maximum number of attributes in group

  @IsOptional()
  @IsString()
  createdAfter?: string;

  @IsOptional()
  @IsString()
  createdBefore?: string;
}
