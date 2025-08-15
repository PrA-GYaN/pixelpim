import { IsInt, IsNotEmpty, IsArray, IsPositive } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateProductVariantDto {
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  productId: number;

  @IsArray()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  @Type(() => Number)
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value.map(id => Number(id));
    }
    if (typeof value === 'string') {
      return value.split(',').map(id => Number(id.trim()));
    }
    return [Number(value)];
  })
  variantProductIds: number[];
}

export class RemoveProductVariantDto {
  @Transform(({ value }) => {
    // Handle string conversion to number
    if (typeof value === 'string') {
      const num = parseInt(value, 10);
      return isNaN(num) ? value : num;
    }
    return value;
  })
  @Type(() => Number)
  @IsInt({ message: 'productId must be an integer' })
  @IsPositive({ message: 'productId must be a positive number' })
  productId: number;

  @Transform(({ value }) => {
    // Handle string conversion to number
    if (typeof value === 'string') {
      const num = parseInt(value, 10);
      return isNaN(num) ? value : num;
    }
    return value;
  })
  @Type(() => Number)
  @IsInt({ message: 'variantProductId must be an integer' })
  @IsPositive({ message: 'variantProductId must be a positive number' })
  variantProductId: number;
}

export class ProductVariantResponseDto {
  id: number;
  productAId: number;
  productBId: number;
  productA?: {
    id: number;
    name: string;
    sku: string;
    imageUrl?: string;
    status: string;
  };
  productB?: {
    id: number;
    name: string;
    sku: string;
    imageUrl?: string;
    status: string;
  };
}
