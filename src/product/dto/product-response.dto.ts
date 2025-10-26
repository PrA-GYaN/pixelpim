import { Transform } from 'class-transformer';

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
  attributeGroupId?: number;
  familyId?: number;
  parentProductId?: number;
  userId: number;
  createdAt: string;
  updatedAt: string;
  category?: {
    id: number;
    name: string;
    description?: string;
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
      userFriendlyType?: string;
    }[];
    optionalAttributes?: {
      id: number;
      name: string;
      type: string;
      defaultValue?: string;
      userFriendlyType?: string;
    }[];
  };
  variants?: ProductVariantSummaryDto[]; // All products that are variants of this product
  totalVariants?: number; // Count of variants
  attributes?: any[]; // List of attribute IDs or details
  assets?: any[]; // List of asset IDs or details

  /**
   * Message about removed attributes during create/update
   */
  removedAttributesMessage?: string;
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
