import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * Global interceptor that automatically sets effectiveUserId in the request
 * This interceptor runs after guards and sets the effectiveUserId based on user role:
 * - ADMIN: null (can access all data)
 * - OWNER: their own user ID
 * - STAFF: their owner's ID
 * 
 * This eliminates the need to manually handle effectiveUserId in each controller method.
 */
@Injectable()
export class EffectiveUserInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user) {
      if (user.role === 'ADMIN') {
        request.effectiveUserId = null; // ADMIN can access all
      } else if (user.role === 'OWNER') {
        request.effectiveUserId = user.id;
      } else if (user.role === 'STAFF') {
        request.effectiveUserId = user.ownerId;
      }
    }

    return next.handle();
  }
}
