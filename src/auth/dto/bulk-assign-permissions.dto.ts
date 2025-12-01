import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AssignPermissionDto } from './assign-permission.dto';

export class BulkAssignPermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignPermissionDto)
  permissions: AssignPermissionDto[];
}
