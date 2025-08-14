import { IsNotEmpty, IsString } from 'class-validator';

export class CreateAssetGroupDto {
  @IsNotEmpty()
  @IsString()
  groupName: string;
}
