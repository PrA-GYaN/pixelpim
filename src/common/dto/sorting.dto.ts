import { IsOptional, IsString, IsIn } from 'class-validator';

export class SortingDto {
  @IsOptional()
  @IsString({ message: 'sortBy must be a string' })
  sortBy?: string;

  @IsOptional()
  @IsString({ message: 'sortOrder must be a string' })
  @IsIn(['asc', 'desc'], { message: 'sortOrder must be either "asc" or "desc"' })
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export interface SortingParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
