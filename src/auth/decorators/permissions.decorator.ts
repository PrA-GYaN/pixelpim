import { SetMetadata } from '@nestjs/common';

export interface PermissionRequirement {
  resource: string;
  action: string;
}

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: PermissionRequirement[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
