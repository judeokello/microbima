import { SetMetadata, applyDecorators, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { BAAuthorizationGuard } from '../guards/ba-authorization.guard';
import { RootOnlyGuard } from '../guards/root-only.guard';

/**
 * Decorator to specify required roles for endpoint access
 */
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

/**
 * Decorator to allow Brand Ambassador access
 */
export const AllowBA = () => SetMetadata('allowBA', true);

/**
 * Decorator to require ownership of the resource
 */
export const RequireOwnership = () => SetMetadata('requireOwnership', true);

/**
 * Combined decorator for BA authorization with Swagger documentation
 */
export const BAAuth = (options?: {
  roles?: string[];
  allowBA?: boolean;
  requireOwnership?: boolean;
}) => {
  const decorators = [
    UseGuards(BAAuthorizationGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Unauthorized - invalid authentication' }),
    ApiForbiddenResponse({ description: 'Forbidden - insufficient permissions' }),
  ];

  if (options?.roles) {
    decorators.push(Roles(...options.roles));
  }

  if (options?.allowBA) {
    decorators.push(AllowBA());
  }

  if (options?.requireOwnership) {
    decorators.push(RequireOwnership());
  }

  return applyDecorators(...decorators);
};

/**
 * Decorator for admin-only endpoints
 */
export const AdminOnly = () => BAAuth({ roles: ['registration_admin', 'system_admin'] });

/**
 * Decorator for BA-only endpoints (with ownership requirement)
 */
export const BAOnly = () => BAAuth({ allowBA: true, requireOwnership: true });

/**
 * Decorator for mixed access (admins and BAs with ownership)
 */
export const AdminOrBA = () => BAAuth({
  roles: ['registration_admin', 'system_admin'],
  allowBA: true,
  requireOwnership: true
});

/**
 * Decorator for root-only endpoints (bootstrap user only).
 * Returns 404 for non-root users. Requires authentication (middleware).
 */
export const RootOnly = () =>
  applyDecorators(
    UseGuards(BAAuthorizationGuard, RootOnlyGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Unauthorized - invalid authentication' }),
    ApiNotFoundResponse({ description: 'Not found' })
  );
