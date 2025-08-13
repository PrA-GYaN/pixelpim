export class ProductSummaryDto {
  id: number;
  name: string;
  sku: string;
  status: string;
  imageUrl?: string | null;
}

export class CategoryResponseDto {
  id: number;
  name: string;
  description?: string;
  parentCategoryId?: number;
  userId: number;
  createdAt: Date;
  updatedAt: Date;
  parentCategory?: CategoryResponseDto;
  subcategories?: CategoryResponseDto[];
  productCount?: number; // For findAll endpoint
  products?: ProductSummaryDto[]; // For findOne endpoint
}

export class CategoryTreeResponseDto {
  id: number;
  name: string;
  description?: string;
  level: number;
  path: string[];
  subcategories: CategoryTreeResponseDto[];
}

export class CreateCategoryResponseDto {
  message: string;
  category: CategoryResponseDto;
}

export class UpdateCategoryResponseDto {
  message: string;
  category: CategoryResponseDto;
}

export class DeleteCategoryResponseDto {
  message: string;
}
