import { IsOptional, IsArray, IsNumber } from 'class-validator';

export class BulkDeleteDto {
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  ids?: number[];

  // Optional filters used to delete matching items (same filters as getProducts)
  @IsOptional()
  filters?: Record<string, any>;
}
