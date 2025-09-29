import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * API Key Decorator
 *
 * Extracts the validated API key from the request
 * Can be used in controller methods to access the API key
 *
 * Usage: @ApiKey() apiKey: string
 */
export const ApiKey = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request['apiKey'];
  },
);

/**
 * Partner ID Decorator
 *
 * Extracts the partner ID from the API key
 * Can be used in controller methods to access the partner ID
 *
 * Usage: @PartnerId() partnerId: string
 *
 * Note: This will be enhanced to extract real partner ID from API key
 * when the ApiKeyService is fully implemented
 */
export const PartnerId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    // TODO: Extract partner ID from API key using ApiKeyService
    // For now, return a placeholder
    return request['partnerId'] || 'default-partner';
  },
);
