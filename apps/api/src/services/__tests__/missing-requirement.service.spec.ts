import { RegistrationEntityKind, RegistrationMissingStatus } from '@prisma/client';
import { MissingRequirementService } from '../missing-requirement.service';
import { MISSING_NOK_FIELD_PATH } from '../../modules/missing-requirements/completeness.util';

describe('MissingRequirementService.syncCustomerFromLiveData', () => {
  const prisma = {
    agentRegistration: { findFirst: jest.fn(), findUnique: jest.fn() },
    dependant: { findMany: jest.fn() },
    beneficiary: { findMany: jest.fn() },
    customerParent: { findMany: jest.fn() },
    missingRequirement: {
      findMany: jest.fn(),
      update: jest.fn(),
      createMany: jest.fn(),
      count: jest.fn(),
    },
    customer: { update: jest.fn() },
  };

  const service = new MissingRequirementService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.agentRegistration.findFirst.mockResolvedValue({
      id: 'reg-1',
      partnerId: 1,
    });
    prisma.dependant.findMany.mockResolvedValue([]);
    prisma.beneficiary.findMany.mockResolvedValue([]);
    prisma.customerParent.findMany.mockResolvedValue([]);
    prisma.missingRequirement.findMany.mockResolvedValue([]);
    prisma.missingRequirement.createMany.mockResolvedValue({ count: 1 });
    prisma.missingRequirement.count.mockResolvedValue(1);
    prisma.customer.update.mockResolvedValue({});
  });

  it('skips creating MRs when the customer has no agent registration', async () => {
    prisma.agentRegistration.findFirst.mockResolvedValue(null);
    prisma.missingRequirement.count.mockResolvedValue(0);

    const result = await service.syncCustomerFromLiveData('cust-1', 'user-1');

    expect(result.pendingCount).toBe(0);
    expect(prisma.missingRequirement.createMany).not.toHaveBeenCalled();
    expect(prisma.customer.update).toHaveBeenCalledWith({
      where: { id: 'cust-1' },
      data: { hasMissingRequirements: false },
    });
  });

  it('creates a missing-NOK placeholder when no beneficiary exists', async () => {
    const result = await service.syncCustomerFromLiveData('cust-1', 'user-1');

    expect(result.pendingCount).toBe(1);
    expect(prisma.missingRequirement.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          customerId: 'cust-1',
          registrationId: 'reg-1',
          entityKind: RegistrationEntityKind.BENEFICIARY,
          entityId: null,
          fieldPath: MISSING_NOK_FIELD_PATH,
          status: RegistrationMissingStatus.PENDING,
        }),
      ],
    });
    expect(prisma.customer.update).toHaveBeenCalledWith({
      where: { id: 'cust-1' },
      data: { hasMissingRequirements: true },
    });
  });

  it('resolves the missing-NOK placeholder and creates field MRs when a NOK is added', async () => {
    prisma.beneficiary.findMany.mockResolvedValue([
      {
        id: 'nok-1',
        firstName: 'Ann',
        lastName: 'Doe',
        idType: null,
        idNumber: null,
        phoneNumber: '0712345678',
        gender: 'FEMALE',
        relationship: 'sister',
      },
    ]);
    prisma.missingRequirement.findMany
      .mockResolvedValueOnce([
        {
          id: 'mr-placeholder',
          entityKind: RegistrationEntityKind.BENEFICIARY,
          entityId: null,
          fieldPath: MISSING_NOK_FIELD_PATH,
        },
      ])
      .mockResolvedValueOnce([]);
    prisma.missingRequirement.count.mockResolvedValue(2);

    await service.syncCustomerFromLiveData('cust-1', 'cs-user');

    expect(prisma.missingRequirement.update).toHaveBeenCalledWith({
      where: { id: 'mr-placeholder' },
      data: expect.objectContaining({
        status: RegistrationMissingStatus.RESOLVED,
        resolvedBy: 'cs-user',
      }),
    });
    const created = prisma.missingRequirement.createMany.mock.calls[0][0].data as Array<{
      fieldPath: string;
      entityId: string | null;
    }>;
    expect(created.some((row) => row.fieldPath === MISSING_NOK_FIELD_PATH)).toBe(false);
    expect(created).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entityId: 'nok-1', fieldPath: 'idType' }),
        expect.objectContaining({ entityId: 'nok-1', fieldPath: 'idNumber' }),
      ])
    );
  });

  it('recreates an MR when a previously complete spouse ID is blanked', async () => {
    prisma.beneficiary.findMany.mockResolvedValue([
      {
        id: 'nok-1',
        firstName: 'Ann',
        lastName: 'Doe',
        idType: 'NATIONAL_ID',
        idNumber: '87654321',
        phoneNumber: '0712345678',
        gender: 'FEMALE',
        relationship: 'sister',
      },
    ]);
    prisma.dependant.findMany.mockResolvedValue([
      {
        id: 'sp-1',
        relationship: 'SPOUSE',
        firstName: 'Jane',
        lastName: 'Doe',
        idType: 'NATIONAL_ID',
        idNumber: null,
        gender: 'FEMALE',
        dateOfBirth: new Date(Date.UTC(1990, 0, 15)),
      },
    ]);
    prisma.missingRequirement.findMany.mockResolvedValue([]);
    prisma.missingRequirement.count.mockResolvedValue(1);

    await service.syncCustomerFromLiveData('cust-1');

    expect(prisma.missingRequirement.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          entityKind: RegistrationEntityKind.SPOUSE,
          entityId: 'sp-1',
          fieldPath: 'idNumber',
        }),
      ],
    });
  });
});
