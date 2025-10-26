import { IsInt, IsNotEmpty, IsArray, IsPositive, IsOptional, IsString, IsIn, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { SortingDto } from '../../common/dto/sorting.dto';
import { CreateProductDto } from './create-product.dto';

export class GetProductVariantsDto extends PaginationDto {
  @IsOptional()
  @IsString({ message: 'sortBy must be a string' })
  @IsIn(['name', 'sku'], { message: 'sortBy must be either "name" or "sku"' })
  sortBy?: 'name' | 'sku' = 'name';

  @IsOptional()
  @IsString({ message: 'sortOrder must be a string' })
  @IsIn(['asc', 'desc'], { message: 'sortOrder must be either "asc" or "desc"' })
  sortOrder?: 'asc' | 'desc' = 'asc';

  @IsOptional()
  @IsString({ message: 'search must be a string' })
  search?: string;

  @IsOptional()
  @IsString({ message: 'status must be a string' })
  @IsIn(['complete', 'incomplete'], { message: 'status must be either "complete" or "incomplete"' })
  status?: 'complete' | 'incomplete';
}

export class AddVariantDto extends CreateProductDto {
  // Inherits all fields from CreateProductDto
  // The parent product ID will be provided separately in the method
}

export class RemoveVariantDto {
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const num = parseInt(value, 10);
      return isNaN(num) ? value : num;
    }
    return value;
  })
  @Type(() => Number)
  @IsInt({ message: 'variantId must be an integer' })
  @IsPositive({ message: 'variantId must be a positive number' })
  variantId: number;
}

export class ProductVariantResponseDto {
  id: number;
  name: string;
  sku: string;
  imageUrl?: string;
  status: string;
  parentProductId?: number;
  createdAt: string;
  updatedAt: string;
}
