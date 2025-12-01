import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Role } from '@prisma/client';

export interface PermissionRequirement {
  resource: string;
  action: string;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<PermissionRequirement[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('Access denied: User not authenticated');
    }

    // ADMIN and OWNER have all permissions by default
    if (user.role === Role.ADMIN || user.role === Role.OWNER) {
      return true;
    }

    // STAFF must have explicit permissions
    if (user.role === Role.STAFF) {
      const userPermissions = await this.prisma.userPermission.findMany({
        where: {
          userId: user.id,
          granted: true,
        },
      });

      // Check if user has all required permissions
      for (const required of requiredPermissions) {
        const hasPermission = userPermissions.some(
          (perm) =>
            perm.resource === required.resource &&
            perm.action === required.action,
        );

        if (!hasPermission) {
          throw new ForbiddenException(
            `Access denied: Missing permission '${required.action}' on '${required.resource}'`,
          );
        }
      }

      return true;
    }

    throw new ForbiddenException('Access denied: Invalid role');
  }
}
