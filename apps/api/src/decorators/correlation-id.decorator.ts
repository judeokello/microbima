import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Correlation ID Decorator
 * 
 * Extracts the correlation ID from the request object
 * This decorator can be used in controllers and services to access the correlation ID
 * 
 * Usage:
 * @Get()
 * async getData(@CorrelationId() correlationId: string) {
 *   // correlationId contains the correlation ID from the request
 * }
 */
export const CorrelationId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.correlationId; // Will be present due to middleware validation
  },
);
