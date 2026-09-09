import 'reflect-metadata';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProductManagementController } from '../product-management.controller';
import { BAAuthorizationGuard, BAUser } from '../../../guards/ba-authorization.guard';

jest.mock('@sentry/nestjs', () => ({
  captureException: jest.fn(),
}));

describe('ProductManagementController scheme RBAC', () => {
  let guard: BAAuthorizationGuard;
  const proto = ProductManagementController.prototype;

  const admin: BAUser = { id: 'admin-1', roles: ['registration_admin'] };
  const care: BAUser = { id: 'care-1', roles: ['customer_care'] };

  const readableHandlers = [
    proto.getAllSchemesWithCounts,
    proto.getSchemeById,
    proto.getSchemeCustomers,
    proto.getSchemeContacts,
    proto.listPostpaidSchemePayments,
    proto.listPostpaidSchemePaymentMembers,
  ];

  const restrictedHandlers = [
    proto.createScheme,
    proto.updateScheme,
    proto.updatePackageSchemeWaitingPeriod,
    proto.createSchemeContact,
    proto.updateSchemeContact,
    proto.deleteSchemeContact,
    proto.lookupPostpaidMpesaTransactionReference,
    proto.validatePostpaidSchemePayment,
    proto.createPostpaidSchemePayment,
  ];

  function createContext(handler: object, user: BAUser): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => ProductManagementController,
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    guard = new BAAuthorizationGuard(new Reflector(), {} as PrismaService);
  });

  it('allows customer_care GET scheme, customers, contacts, and payments', async () => {
    for (const handler of readableHandlers) {
      await expect(guard.canActivate(createContext(handler, care))).resolves.toBe(true);
    }
  });

  it('forbids customer_care scheme, contact, and payment mutations', async () => {
    for (const handler of restrictedHandlers) {
      await expect(guard.canActivate(createContext(handler, care))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    }
  });

  it('allows registration_admin scheme reads and mutations', async () => {
    for (const handler of [...readableHandlers, ...restrictedHandlers]) {
      await expect(guard.canActivate(createContext(handler, admin))).resolves.toBe(true);
    }
  });
});
