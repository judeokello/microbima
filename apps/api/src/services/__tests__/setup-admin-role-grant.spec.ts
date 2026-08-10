/// <reference types="jest" />
import { assertCanGrantSetupAdmin } from '../../utils/setup-admin-role.util';
import { AppRoles } from '../../utils/roles.util';
import { ValidationException } from '../../exceptions/validation.exception';

describe('assertCanGrantSetupAdmin', () => {
  it('allows root user to grant setup_admin', () => {
    expect(() =>
      assertCanGrantSetupAdmin({
        actorIsRoot: true,
        rolesBeingSet: [AppRoles.REGISTRATION_ADMIN, AppRoles.SETUP_ADMIN],
        previousRoles: [AppRoles.REGISTRATION_ADMIN],
      })
    ).not.toThrow();
  });

  it('allows root user to revoke setup_admin', () => {
    expect(() =>
      assertCanGrantSetupAdmin({
        actorIsRoot: true,
        rolesBeingSet: [AppRoles.REGISTRATION_ADMIN],
        previousRoles: [AppRoles.REGISTRATION_ADMIN, AppRoles.SETUP_ADMIN],
      })
    ).not.toThrow();
  });

  it('allows non-root when setup_admin unchanged', () => {
    expect(() =>
      assertCanGrantSetupAdmin({
        actorIsRoot: false,
        rolesBeingSet: [AppRoles.REGISTRATION_ADMIN, AppRoles.SETUP_ADMIN],
        previousRoles: [AppRoles.REGISTRATION_ADMIN, AppRoles.SETUP_ADMIN],
      })
    ).not.toThrow();
  });

  it('rejects non-root granting setup_admin', () => {
    expect(() =>
      assertCanGrantSetupAdmin({
        actorIsRoot: false,
        rolesBeingSet: [AppRoles.REGISTRATION_ADMIN, AppRoles.SETUP_ADMIN],
        previousRoles: [AppRoles.REGISTRATION_ADMIN],
      })
    ).toThrow(ValidationException);
  });

  it('rejects non-root revoking setup_admin', () => {
    expect(() =>
      assertCanGrantSetupAdmin({
        actorIsRoot: false,
        rolesBeingSet: [AppRoles.REGISTRATION_ADMIN],
        previousRoles: [AppRoles.REGISTRATION_ADMIN, AppRoles.SETUP_ADMIN],
      })
    ).toThrow(ValidationException);
  });

  it('rejects non-root creating user with setup_admin', () => {
    expect(() =>
      assertCanGrantSetupAdmin({
        actorIsRoot: false,
        rolesBeingSet: [AppRoles.BRAND_AMBASSADOR, AppRoles.SETUP_ADMIN],
        previousRoles: [],
      })
    ).toThrow(ValidationException);
  });
});
