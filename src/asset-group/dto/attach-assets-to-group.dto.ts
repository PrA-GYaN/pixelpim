import { IsArray, ArrayNotEmpty, IsInt } from 'class-validator';

export class AttachAssetsToGroupDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  assetIds: number[];
}
