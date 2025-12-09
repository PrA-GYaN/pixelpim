import { IsNotEmpty, IsString, IsOptional, IsInt } from 'class-validator';
// import { Transform } from 'class-transformer';

export class CreateAssetDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  // @IsInt()
  // @Transform(({ value }) => parseInt(value, 10))
  assetGroupId?: number;
}
