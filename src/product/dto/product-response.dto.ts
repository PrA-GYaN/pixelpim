export class ProductVariantSummaryDto {
  id: number;
  name: string;
  sku: string;
  imageUrl?: string;
  status: string;
}

export class ProductResponseDto {
  id: number;
  name: string;
  sku: string;
  productLink?: string;
  imageUrl?: string;
  subImages?: string[];
  status: string;
  categoryId?: number;
  attributeId?: number;
  attributeGroupId?: number;
  familyId?: number;
  userId: number;
  createdAt: Date;
  updatedAt: Date;
  category?: {
    id: number;
    name: string;
    description?: string;
  };
  attribute?: {
    id: number;
    name: string;
    type: string;
    defaultValue?: string;
  };
  attributeGroup?: {
    id: number;
    name: string;
    description?: string;
  };
  family?: {
    id: number;
    name: string;
    requiredAttributes?: {
      id: number;
      name: string;
      type: string;
      defaultValue?: string;
    }[];
    optionalAttributes?: {
      id: number;
      name: string;
      type: string;
      defaultValue?: string;
    }[];
  };
  variants?: ProductVariantSummaryDto[]; // All products that are variants of this product
  totalVariants?: number; // Count of variants
}

export class CreateProductResponseDto {
  message: string;
  product: ProductResponseDto;
}

export class UpdateProductResponseDto {
  message: string;
  product: ProductResponseDto;
}

export class DeleteProductResponseDto {
  message: string;
}
