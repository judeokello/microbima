import { ForbiddenException } from '@nestjs/common';
import { ValidationException } from '../exceptions/validation.exception';
import { ErrorCodes } from '../enums/error-codes.enum';
import { AppRoles } from './roles.util';

/** Throws if caller lacks setup_admin (for thin unit tests / service guards). */
export function assertSetupAdmin(roles: string[] | null | undefined): void {
  if (!roles?.includes(AppRoles.SETUP_ADMIN)) {
    throw new ForbiddenException('Insufficient permissions');
  }
}

/**
 * Only the bootstrap (root) user may add or remove setup_admin on a user.
 */
export function assertCanGrantSetupAdmin(params: {
  actorIsRoot: boolean;
  rolesBeingSet: string[];
  previousRoles?: string[];
}): void {
  const previousRoles = params.previousRoles ?? [];
  const hadSetupAdmin = previousRoles.includes(AppRoles.SETUP_ADMIN);
  const hasSetupAdmin = params.rolesBeingSet.includes(AppRoles.SETUP_ADMIN);

  if (hadSetupAdmin !== hasSetupAdmin && !params.actorIsRoot) {
    throw ValidationException.forField(
      'roles',
      'Only the root user may grant or revoke setup_admin',
      ErrorCodes.AUTHORIZATION_ERROR
    );
  }
}
