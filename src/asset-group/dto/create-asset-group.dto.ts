import { IsNotEmpty, IsString, IsOptional, IsInt } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateAssetGroupDto {
  @IsNotEmpty()
  @IsString()
  groupName: string;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => value === null || value === undefined ? value : parseInt(value))
  parentGroupId?: number | null;
}
