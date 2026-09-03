/// <reference types="jest" />
import { PolicyService } from '../policy.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentAccountNumberService } from '../payment-account-number.service';
import { PaymentMessagingService } from '../../modules/messaging/payment-messaging.service';
import { PolicyLifecycleMessagingService } from '../../modules/messaging/policy-lifecycle-messaging.service';

describe('copyPolicyBeneficiaries', () => {
  const service = new PolicyService(
    {} as unknown as PrismaService,
    {} as unknown as PaymentAccountNumberService,
    { notifyMatchedPaymentSmsAsync: jest.fn() } as unknown as PaymentMessagingService,
    { suppressPendingActivationReminders: jest.fn() } as unknown as PolicyLifecycleMessagingService,
    { onPolicyActivated: jest.fn() } as never
  );

  it('copies the single join onto the new policy', async () => {
    const tx = {
      policyBeneficiary: {
        findUnique: jest.fn().mockResolvedValue({
          policyId: 'old',
          beneficiaryId: 'ben-1',
          percentage: 100,
        }),
        upsert: jest.fn(),
      },
    };

    await service.copyPolicyBeneficiaries(tx as never, 'old', 'new', 'corr');

    expect(tx.policyBeneficiary.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { policyId: 'new' },
        create: expect.objectContaining({
          policyId: 'new',
          beneficiaryId: 'ben-1',
          percentage: 100,
        }),
      })
    );
  });

  it('copies dependant stubs onto the replacement policy', async () => {
    const tx = {
      policyMemberDependant: {
        findMany: jest.fn().mockResolvedValue([{ dependantId: 'dep-1' }]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      policyBeneficiary: { upsert: jest.fn() },
    };

    await service.copyPolicyDependantStubs(tx as never, 'old', 'new', 'corr');

    expect(tx.policyMemberDependant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ policyId: 'new', dependantId: 'dep-1' }),
      })
    );
  });

  it('no-ops when the source policy has no join', async () => {
    const tx = {
      policyBeneficiary: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
      },
    };
    await service.copyPolicyBeneficiaries(tx as never, 'old', 'new', 'corr');
    expect(tx.policyBeneficiary.upsert).not.toHaveBeenCalled();
  });
});
