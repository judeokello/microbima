import { NotFoundException } from '@nestjs/common';
import { DependantRelationship } from '@prisma/client';
import { IdNumberRevealService } from '../id-number-reveal.service';
import { IdNumberEntityKind } from '../../dto/customers/reveal-id-number.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { ValidationException } from '../../exceptions/validation.exception';

describe('IdNumberRevealService', () => {
  const prismaMock = {
    agentRegistration: { findFirst: jest.fn() },
    customer: { findUnique: jest.fn() },
    dependant: { findFirst: jest.fn() },
    customerParent: { findFirst: jest.fn() },
    beneficiary: { findFirst: jest.fn() },
  };

  const service = new IdNumberRevealService(prismaMock as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the principal ID number for admins', async () => {
    prismaMock.customer.findUnique.mockResolvedValue({ idNumber: '12345678' });

    const result = await service.reveal({
      customerId: 'cust-1',
      entityKind: IdNumberEntityKind.CUSTOMER,
      entityId: undefined,
      userId: 'admin-1',
      userRoles: ['registration_admin'],
      correlationId: 'corr-1',
    });

    expect(result).toEqual({ idNumber: '12345678' });
    expect(prismaMock.agentRegistration.findFirst).not.toHaveBeenCalled();
  });

  it('hides existence from unauthorized users', async () => {
    await expect(
      service.reveal({
        customerId: 'cust-1',
        entityKind: IdNumberEntityKind.CUSTOMER,
        entityId: undefined,
        userId: 'user-1',
        userRoles: [],
        correlationId: 'corr-1',
      })
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prismaMock.customer.findUnique).not.toHaveBeenCalled();
  });

  it('allows a brand ambassador who registered the customer', async () => {
    prismaMock.agentRegistration.findFirst.mockResolvedValue({ id: 'reg-1' });
    prismaMock.customer.findUnique.mockResolvedValue({ idNumber: '87654321' });

    const result = await service.reveal({
      customerId: 'cust-1',
      entityKind: IdNumberEntityKind.CUSTOMER,
      entityId: undefined,
      userId: 'ba-1',
      userRoles: ['brand_ambassador'],
      correlationId: 'corr-1',
    });

    expect(result.idNumber).toBe('87654321');
  });

  it('requires entityId for a spouse', async () => {
    await expect(
      service.reveal({
        customerId: 'cust-1',
        entityKind: IdNumberEntityKind.SPOUSE,
        entityId: undefined,
        userId: 'admin-1',
        userRoles: ['registration_admin'],
        correlationId: 'corr-1',
      })
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('returns a child ID number for the matching dependant', async () => {
    prismaMock.dependant.findFirst.mockResolvedValue({ idNumber: '  99887766  ' });

    const result = await service.reveal({
      customerId: 'cust-1',
      entityKind: IdNumberEntityKind.CHILD,
      entityId: 'child-1',
      userId: 'admin-1',
      userRoles: ['customer_care'],
      correlationId: 'corr-1',
    });

    expect(prismaMock.dependant.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'child-1',
        customerId: 'cust-1',
        relationship: DependantRelationship.CHILD,
      },
      select: { idNumber: true },
    });
    expect(result.idNumber).toBe('99887766');
  });

  it('throws when the family member has no ID number', async () => {
    prismaMock.beneficiary.findFirst.mockResolvedValue({ idNumber: null });

    await expect(
      service.reveal({
        customerId: 'cust-1',
        entityKind: IdNumberEntityKind.BENEFICIARY,
        entityId: 'ben-1',
        userId: 'admin-1',
        userRoles: ['registration_admin'],
        correlationId: 'corr-1',
      })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
