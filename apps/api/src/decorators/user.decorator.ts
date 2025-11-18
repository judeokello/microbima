import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../types/express';

/**
 * User Decorator
 *
 * Extracts the authenticated user from the request object
 * This decorator can be used in controllers to access the authenticated user
 *
 * Usage:
 * @Get()
 * async getData(@User() user: AuthenticatedUser) {
 *   // user contains the authenticated user from the request
 * }
 */
export const User = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user; // Set by SupabaseAuthMiddleware
  },
);

/**
 * User ID Decorator
 *
 * Extracts just the user ID from the authenticated user
 *
 * Usage:
 * @Get()
 * async getData(@UserId() userId: string) {
 *   // userId contains the user ID from the authenticated user
 * }
 */
export const UserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;
    return user?.id;
  },
);

