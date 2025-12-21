import { IsArray, IsInt, ArrayNotEmpty, ArrayMinSize } from 'class-validator';

export class BulkAttachToFamilyDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  productIds: number[];

  @IsInt()
  familyId: number;
}

export class BulkAttachToFamilyResponseDto {
  success: boolean;
  attached: number;
  failed: number;
  errors: Array<{ productId: number; error: string }>;
}
