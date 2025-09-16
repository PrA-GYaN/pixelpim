import { IsOptional, IsString, IsIn, IsNumber } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class GetNotificationsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Transform(({ value }) => value || 1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Transform(({ value }) => Math.min(value || 20, 100))
  limit?: number = 20;

  @IsOptional()
  @IsString()
  @IsIn(['product', 'attribute', 'attributeGroup', 'category', 'family', 'asset', 'assetGroup', 'productVariant', 'productAttribute'])
  entityType?: string;

  @IsOptional()
  @IsString()
  @IsIn(['created', 'updated', 'deleted', 'bulk_created', 'bulk_updated', 'bulk_deleted', 'linked', 'unlinked'])
  action?: string;
}
