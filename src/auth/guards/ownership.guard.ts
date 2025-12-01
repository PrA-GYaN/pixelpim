import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * OwnershipGuard ensures data isolation by verifying user authentication.
 * The effectiveUserId is set by EffectiveUserInterceptor globally.
 * 
 * This guard should be used on routes that access user-owned resources
 * like products, assets, categories, etc.
 */
@Injectable()
export class OwnershipGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    return true;
  }
}
