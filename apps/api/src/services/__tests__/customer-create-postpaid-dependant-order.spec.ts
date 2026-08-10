/// <reference types="jest" />
import { CustomerService } from '../customer.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PolicyService } from '../policy.service';
import { LctSyncService } from '../../modules/lct/lct-sync.service';
import { PaymentFrequency } from '@prisma/client';

/**
 * Sharon/Kailani regression: historical M-Pesa map/activate must run after dependants
 * are inserted so activatePolicy can create policy_member_dependants.
 */
describe('CustomerService.createCustomer — postpaid dependant order', () => {
  const correlationId = 'test-sharon-order';
  const callOrder: string[] = [];

  const createdCustomer = {
    id: 'cust-1',
    firstName: 'Sharon',
    middleName: null,
    lastName: 'Ng\'etich',
    email: null,
    phoneNumber: '0712345678',
    dateOfBirth: new Date('1990-01-01'),
    gender: 'FEMALE',
    idType: 'NATIONAL_ID',
    idNumber: '36783633',
    status: 'ACTIVE',
    onboardingStep: 'COMPLETE',
    createdByPartnerId: 1,
    createdBy: null,
    isTestUser: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let prismaMock: any;
  let policyServiceMock: any;
  let lctSyncServiceMock: any;
  let service: CustomerService;

  beforeEach(() => {
    jest.clearAllMocks();
    callOrder.length = 0;

    prismaMock = {
      partnerCustomer: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      customer: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(createdCustomer),
        delete: jest.fn(),
      },
      testCustomer: { findUnique: jest.fn().mockResolvedValue(null) },
      packageSchemeCustomer: {
        create: jest.fn().mockImplementation(async () => {
          callOrder.push('packageSchemeCustomer');
          return {};
        }),
      },
      packageScheme: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1,
          scheme: {
            isPostpaid: true,
            frequency: PaymentFrequency.MONTHLY,
            paymentCadence: 30,
          },
          package: { id: 1, name: 'Mfanisi Go' },
        }),
      },
      policy: {
        create: jest.fn().mockImplementation(async () => {
          callOrder.push('policy.create');
          return { id: 'postpaid-policy-1' };
        }),
      },
      dependant: {
        createMany: jest.fn().mockImplementation(async () => {
          callOrder.push('dependant.createMany');
          return { count: 1 };
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'dep-kailani',
            customerId: 'cust-1',
            firstName: 'Kailani',
            middleName: null,
            lastName: 'Chepkoech',
            dateOfBirth: new Date('2015-01-01'),
            gender: 'FEMALE',
            idType: null,
            idNumber: null,
            relationship: 'CHILD',
            isVerified: false,
            verifiedAt: null,
            verifiedBy: null,
            verificationRequired: false,
            createdByPartnerId: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      },
      beneficiary: { createMany: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
    };

    policyServiceMock = {
      resolveExpectedInstallmentCount: jest.fn().mockResolvedValue(12),
      mapUnmappedMpesaItemsToPolicy: jest.fn().mockImplementation(async () => {
        callOrder.push('mapUnmappedMpesa');
        return 1;
      }),
    };

    lctSyncServiceMock = {
      ensureMemberRowsForLateDependants: jest.fn().mockImplementation(async () => {
        callOrder.push('ensureMemberRows');
      }),
      upsertTargetsForPolicy: jest.fn().mockImplementation(async () => {
        callOrder.push('upsertTargets');
      }),
      onPolicyActivated: jest.fn().mockImplementation(async () => {
        callOrder.push('onPolicyActivated');
      }),
    };

    service = new CustomerService(
      prismaMock as unknown as PrismaService,
      {
        ensureCustomerPortalUser: jest.fn().mockResolvedValue({ ok: false, error: 'skip' }),
      } as any,
      {} as any,
      { enqueue: jest.fn() } as any,
      { getSnapshot: jest.fn().mockResolvedValue({}) } as any,
      {} as any,
      { customerPortal: { publicBaseUrl: 'http://localhost' } } as any,
      {} as any,
      policyServiceMock as unknown as PolicyService,
      lctSyncServiceMock as unknown as LctSyncService,
      {} as any
    );

    // Avoid portal/welcome side effects failing the test
    jest
      .spyOn(service as any, 'provisionPortalAndEnqueueWelcome')
      .mockResolvedValue(undefined);
  });

  it('defers historical map/activate until after dependants are inserted', async () => {
    await service.createCustomer(
      {
        principalMember: {
          firstName: 'Sharon',
          lastName: 'Ng\'etich',
          phoneNumber: '0712345678',
          dateOfBirth: '1990-01-01',
          gender: 'female',
          idType: 'national',
          idNumber: '36783633',
          partnerCustomerId: 'pc-sharon',
        },
        children: [
          {
            firstName: 'Kailani',
            lastName: 'Chepkoech',
            dateOfBirth: '2015-01-01',
            gender: 'female',
          },
        ],
        packageSchemeId: 1,
      } as any,
      1,
      correlationId,
      true
    );

    const dependantIdx = callOrder.indexOf('dependant.createMany');
    const mapIdx = callOrder.indexOf('mapUnmappedMpesa');
    const ensureIdx = callOrder.indexOf('ensureMemberRows');

    expect(dependantIdx).toBeGreaterThanOrEqual(0);
    expect(mapIdx).toBeGreaterThan(dependantIdx);
    expect(ensureIdx).toBeGreaterThan(mapIdx);
    expect(callOrder.indexOf('policy.create')).toBeLessThan(dependantIdx);
    expect(policyServiceMock.mapUnmappedMpesaItemsToPolicy).toHaveBeenCalledWith(
      'postpaid-policy-1',
      '36783633',
      correlationId,
      expect.anything(),
      { activateIfPending: true }
    );
    expect(lctSyncServiceMock.ensureMemberRowsForLateDependants).toHaveBeenCalledWith(
      'postpaid-policy-1',
      correlationId
    );
  });
});
