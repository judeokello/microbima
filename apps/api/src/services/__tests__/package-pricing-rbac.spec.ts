/// <reference types="jest" />
import { ForbiddenException } from '@nestjs/common';
import { assertSetupAdmin } from '../../utils/setup-admin-role.util';
import { AppRoles } from '../../utils/roles.util';

describe('setup_admin RBAC helpers', () => {
  describe('assertSetupAdmin', () => {
    it('allows setup_admin role', () => {
      expect(() => assertSetupAdmin([AppRoles.SETUP_ADMIN])).not.toThrow();
    });

    it('allows when setup_admin combined with other roles', () => {
      expect(() =>
        assertSetupAdmin([AppRoles.REGISTRATION_ADMIN, AppRoles.SETUP_ADMIN])
      ).not.toThrow();
    });

    it('throws ForbiddenException for registration_admin without setup_admin', () => {
      expect(() => assertSetupAdmin([AppRoles.REGISTRATION_ADMIN])).toThrow(
        ForbiddenException
      );
    });

    it('throws ForbiddenException for empty roles', () => {
      expect(() => assertSetupAdmin([])).toThrow(ForbiddenException);
    });
  });
});
