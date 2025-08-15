export class FamilyAttributeResponseDto {
  id: number;
  isRequired: boolean;
  additionalValue: any;
  attribute: {
    id: number;
    name: string;
    type: string;
    defaultValue: any;
    userId: number;
  };
}

export class ProductSummaryDto {
  id: number;
  name: string;
  sku: string;
  status: string;
  imageUrl?: string | null;
}

export class FamilyResponseDto {
  id: number;
  name: string;
  userId: number;
  createdAt: Date;
  updatedAt: Date;
  familyAttributes: FamilyAttributeResponseDto[];
  productCount?: number; // For findAll endpoint
  totalAttributes?: number; // Total number of attributes in family
  products?: ProductSummaryDto[]; // For findOne endpoint
}
