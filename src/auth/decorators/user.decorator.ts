import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extracts the authenticated user from the request.
 * The user object includes effectiveUserId for data isolation:
 * - For ADMIN: effectiveUserId is null (unrestricted access)
 * - For OWNER: effectiveUserId is their own ID
 * - For STAFF: effectiveUserId is their owner's ID
 */
export const User = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
