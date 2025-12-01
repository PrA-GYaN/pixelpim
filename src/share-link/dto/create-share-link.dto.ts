import { IsArray, IsOptional, IsNumber } from 'class-validator';

export class CreateShareLinkDto {
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  assetIds?: number[];

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  assetGroupIds?: number[];
}
