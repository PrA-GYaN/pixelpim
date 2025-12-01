import { IsNotEmpty, IsString, IsBoolean, IsOptional } from 'class-validator';

export class AssignPermissionDto {
  @IsString()
  @IsNotEmpty()
  resource: string;

  @IsString()
  @IsNotEmpty()
  action: string;

  @IsBoolean()
  @IsOptional()
  granted?: boolean = true;
}
