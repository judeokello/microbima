/// <reference types="jest" />
import { PolicyService } from '../policy.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentAccountNumberService } from '../payment-account-number.service';
import { PaymentMessagingService } from '../../modules/messaging/payment-messaging.service';
import { PolicyLifecycleMessagingService } from '../../modules/messaging/policy-lifecycle-messaging.service';
import { Prisma } from '@prisma/client';

function buildService() {
  const lifecycleMessaging = {
    suppressPendingActivationReminders: jest.fn().mockResolvedValue(undefined),
  };
  const lctSyncService = {
    onPolicyActivated: jest.fn().mockResolvedValue(undefined),
  };
  const service = new PolicyService(
    {} as PrismaService,
    {} as PaymentAccountNumberService,
    {} as PaymentMessagingService,
    lifecycleMessaging as unknown as PolicyLifecycleMessagingService,
    lctSyncService as never
  );
  return { service, lifecycleMessaging, lctSyncService };
}

const policyBase = {
  id: 'pol-1',
  customerId: 'cust-1',
  packageId: 6,
  createdAt: new Date('2026-09-08T10:00:00.000Z'),
  status: 'PENDING_ACTIVATION',
  policyNumber: 'MP/MFGBL/002',
  startDate: new Date('2026-09-01T00:00:00.000Z'),
  endDate: new Date('2027-08-31T00:00:00.000Z'),
  nominalPaymentPeriodEndDate: null,
  expectedInstallmentCount: null,
  paymentCadence: 30,
  customer: { dependants: [] },
};

describe('PolicyService.generateMemberNumberForPolicy', () => {
  it('strips [DIS] prefixes before extracting the policy sequence', async () => {
    const { service } = buildService();
    const tx = {
      package: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1,
          memberNumberFormat:
            'MFG{auto-increasing-policy-number}-{auto-increasing-member-number}',
          policyNumberFormat: 'MP/MFG/{auto-increasing-policy-number}',
        }),
      },
    };

    const memberNumber = await service.generateMemberNumberForPolicy(
      1,
      '[DIS]MP/MFG/300',
      tx as unknown as Prisma.TransactionClient,
      'corr-dis',
      0
    );

    expect(memberNumber).toBe('MFG300-00');
  });

  it('strips [DIS2] prefixes the same way', async () => {
    const { service } = buildService();
    const tx = {
      package: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1,
          memberNumberFormat:
            'MFG{auto-increasing-policy-number}-{auto-increasing-member-number}',
          policyNumberFormat: 'MP/MFG/{auto-increasing-policy-number}',
        }),
      },
    };

    const memberNumber = await service.generateMemberNumberForPolicy(
      1,
      '[DIS2]MP/MFG/291',
      tx as unknown as Prisma.TransactionClient,
      'corr-dis2',
      3
    );

    expect(memberNumber).toBe('MFG291-03');
  });
});

describe('PolicyService.activatePolicy first vs additional product', () => {
  function buildTx(siblings: Array<{ packageId: number; createdAt: Date }>) {
    return {
      policy: {
        findUnique: jest.fn().mockResolvedValue(policyBase),
        findMany: jest.fn().mockResolvedValue(siblings),
        update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
          ...policyBase,
          ...data,
        })),
      },
      packageSchemeCustomer: {
        findFirst: jest.fn().mockResolvedValue({
          packageScheme: { scheme: { isPostpaid: true } },
        }),
      },
      policyMemberPrincipal: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 1 }),
      },
      package: {
        findUnique: jest.fn().mockResolvedValue({
          id: 6,
          memberNumberFormat:
            'MFGBL{auto-increasing-policy-number}-{auto-increasing-member-number}',
          policyNumberFormat: 'MP/MFGBL/{auto-increasing-policy-number}',
          parentsSupported: true,
        }),
      },
      policyMemberDependant: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      policyMemberParent: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      customer: {
        findUnique: jest.fn().mockResolvedValue({ status: 'PENDING_ACTIVATION' }),
        update: jest.fn(),
      },
    };
  }

  it('copies the live household onto a first-product policy before numbering', async () => {
    const { service } = buildService();
    const tx = buildTx([]);
    const attachSpy = jest
      .spyOn(service, 'attachPolicyMembership')
      .mockResolvedValue(undefined);

    await service.activatePolicy(
      'pol-1',
      'corr-first',
      tx as unknown as Prisma.TransactionClient
    );

    expect(attachSpy).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        policyId: 'pol-1',
        customerId: 'cust-1',
      }),
      'corr-first'
    );
    expect(attachSpy.mock.calls[0][1].dependantIds).toBeUndefined();
    expect(attachSpy.mock.calls[0][1].parentIds).toBeUndefined();
  });

  it('does not copy the rest of the household for an additional product', async () => {
    const { service } = buildService();
    const tx = buildTx([
      { packageId: 1, createdAt: new Date('2026-08-01T00:00:00.000Z') },
    ]);
    const attachSpy = jest
      .spyOn(service, 'attachPolicyMembership')
      .mockResolvedValue(undefined);

    await service.activatePolicy(
      'pol-1',
      'corr-additional',
      tx as unknown as Prisma.TransactionClient
    );

    expect(attachSpy).not.toHaveBeenCalled();
    expect(tx.policyMemberDependant.findMany).toHaveBeenCalled();
  });

  it('numbers live dependants that were never written to policy_member_dependants', async () => {
    const { service } = buildService();
    const liveDependant = {
      id: 'dep-spouse',
      relationship: 'SPOUSE',
      createdAt: new Date('2026-09-08T10:00:00.000Z'),
    };
    const attached: Array<{ dependant: typeof liveDependant }> = [];
    const tx = {
      ...buildTx([]),
      dependant: {
        findMany: jest.fn().mockResolvedValue([liveDependant]),
      },
      customerParent: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      policyMemberDependant: {
        upsert: jest.fn().mockImplementation(async () => {
          attached.push({ dependant: liveDependant });
        }),
        findMany: jest.fn().mockImplementation(async () => attached),
        update: jest.fn(),
      },
      policyMemberParent: {
        upsert: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
    };

    await service.activatePolicy(
      'pol-1',
      'corr-copy-family',
      tx as unknown as Prisma.TransactionClient
    );

    expect(tx.dependant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerId: 'cust-1', deletedAt: null },
      })
    );
    expect(tx.policyMemberDependant.upsert).toHaveBeenCalled();
    expect(tx.policyMemberDependant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { memberNumber: 'MFGBL002-01' },
      })
    );
  });

  it('does not attach parents on a first product that does not support them', async () => {
    const { service } = buildService();
    const tx = buildTx([]);
    tx.package.findUnique.mockResolvedValue({
      id: 6,
      memberNumberFormat:
        'MFGBL{auto-increasing-policy-number}-{auto-increasing-member-number}',
      policyNumberFormat: 'MP/MFGBL/{auto-increasing-policy-number}',
      parentsSupported: false,
    });
    const attachSpy = jest
      .spyOn(service, 'attachPolicyMembership')
      .mockResolvedValue(undefined);

    await service.activatePolicy(
      'pol-1',
      'corr-no-parents',
      tx as unknown as Prisma.TransactionClient
    );

    expect(attachSpy.mock.calls[0][1].parentIds).toEqual([]);
  });
});
