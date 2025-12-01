import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Gets the effective user ID for data queries
 * - For OWNER: returns their own ID
 * - For STAFF: returns their owner's ID
 * - For ADMIN: returns null (can access all)
 * 
 * The effectiveUserId is set automatically by EffectiveUserInterceptor
 * Use this in controllers to get the correct userId for filtering data
 */
export const EffectiveUserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): number | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.effectiveUserId !== undefined ? request.effectiveUserId : null;
  },
);
