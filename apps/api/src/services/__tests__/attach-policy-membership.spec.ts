/// <reference types="jest" />
import { PolicyService } from '../policy.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentAccountNumberService } from '../payment-account-number.service';
import { PaymentMessagingService } from '../../modules/messaging/payment-messaging.service';
import { PolicyLifecycleMessagingService } from '../../modules/messaging/policy-lifecycle-messaging.service';

function buildService(tx: Record<string, unknown>) {
  return new PolicyService(
    { $transaction: (fn: (client: unknown) => unknown) => fn(tx) } as unknown as PrismaService,
    {} as PaymentAccountNumberService,
    {} as PaymentMessagingService,
    {} as PolicyLifecycleMessagingService,
    { onPolicyActivated: jest.fn() } as never
  );
}

describe('PolicyService.attachPolicyMembership', () => {
  it('attaches only the listed dependants and one beneficiary', async () => {
    const upsertDependant = jest.fn();
    const upsertBeneficiary = jest.fn();
    const tx = {
      policyMemberDependant: { upsert: upsertDependant },
      policyBeneficiary: { upsert: upsertBeneficiary },
    };
    const service = buildService(tx);

    await service.attachPolicyMembership(
      tx as never,
      {
        policyId: 'pol-2',
        customerId: 'cust-1',
        dependantIds: ['dep-new'],
        beneficiaryId: 'ben-1',
      },
      'corr'
    );

    expect(upsertDependant).toHaveBeenCalledTimes(1);
    expect(upsertDependant).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { policyId_dependantId: { policyId: 'pol-2', dependantId: 'dep-new' } },
      })
    );
    expect(upsertBeneficiary).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { policyId: 'pol-2' },
        create: expect.objectContaining({ beneficiaryId: 'ben-1', percentage: 100 }),
      })
    );
  });

  it('attaches no dependants when the list is empty', async () => {
    const upsertDependant = jest.fn();
    const tx = {
      policyMemberDependant: { upsert: upsertDependant },
      policyBeneficiary: { upsert: jest.fn() },
      dependant: { findMany: jest.fn() },
    };
    const service = buildService(tx);

    await service.attachPolicyMembership(
      tx as never,
      { policyId: 'pol-2', customerId: 'cust-1', dependantIds: [] },
      'corr'
    );

    expect(tx.dependant.findMany).not.toHaveBeenCalled();
    expect(upsertDependant).not.toHaveBeenCalled();
  });
});
