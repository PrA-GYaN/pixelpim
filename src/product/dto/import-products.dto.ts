import { IsNotEmpty, IsString } from 'class-validator';

export class ImportProductsDto {
  @IsString()
  @IsNotEmpty()
  mapping: string; // JSON string mapping: { sku: "SKU Column", name: "Product Name Column", price: "Price Column" }
}

export class ImportProductsResponseDto {
  totalRows: number;
  successCount: number;
  failedRows: Array<{ row: number; error: string }>;;
}

export class ImportProgressDto {
  processed: number;
  total: number;
  successCount: number;
  failedCount: number;
  percentage: number;
  status: 'processing' | 'completed' | 'error';
  message?: string;
  failedRows?: Array<{ row: number; error: string; sku?: string; productName?: string }>;
}
