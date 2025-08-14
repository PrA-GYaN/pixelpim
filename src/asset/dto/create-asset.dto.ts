import { IsNotEmpty, IsString, IsOptional, IsInt } from 'class-validator';

export class CreateAssetDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsInt()
  assetGroupId?: number;
}
