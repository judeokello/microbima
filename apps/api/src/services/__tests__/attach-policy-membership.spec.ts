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
    const upsertParent = jest.fn();
    const tx = {
      policyMemberDependant: { upsert: upsertDependant },
      policyMemberParent: { upsert: upsertParent },
      policyBeneficiary: { upsert: upsertBeneficiary },
    };
    const service = buildService(tx);

    await service.attachPolicyMembership(
      tx as never,
      {
        policyId: 'pol-2',
        customerId: 'cust-1',
        dependantIds: ['dep-new'],
        parentIds: [],
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
    expect(upsertParent).not.toHaveBeenCalled();
    expect(upsertBeneficiary).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { policyId: 'pol-2' },
        create: expect.objectContaining({ beneficiaryId: 'ben-1', percentage: 100 }),
      })
    );
  });

  it('attaches no dependants when the list is empty', async () => {
    const upsertDependant = jest.fn();
    const upsertParent = jest.fn();
    const tx = {
      policyMemberDependant: { upsert: upsertDependant },
      policyMemberParent: { upsert: upsertParent },
      policyBeneficiary: { upsert: jest.fn() },
      dependant: { findMany: jest.fn() },
    };
    const service = buildService(tx);

    await service.attachPolicyMembership(
      tx as never,
      { policyId: 'pol-2', customerId: 'cust-1', dependantIds: [], parentIds: [] },
      'corr'
    );

    expect(tx.dependant.findMany).not.toHaveBeenCalled();
    expect(upsertDependant).not.toHaveBeenCalled();
    expect(upsertParent).not.toHaveBeenCalled();
  });

  it('attaches listed parents with pending member numbers', async () => {
    const upsertParent = jest.fn();
    const tx = {
      policyMemberDependant: { upsert: jest.fn() },
      policyMemberParent: { upsert: upsertParent },
      policyBeneficiary: { upsert: jest.fn() },
    };
    const service = buildService(tx);

    await service.attachPolicyMembership(
      tx as never,
      {
        policyId: 'pol-2',
        customerId: 'cust-1',
        dependantIds: [],
        parentIds: ['parent-1'],
      },
      'corr'
    );

    expect(upsertParent).toHaveBeenCalledTimes(1);
    expect(upsertParent).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          policyId_customerParentId: { policyId: 'pol-2', customerParentId: 'parent-1' },
        },
      })
    );
  });

  it('attaches all live parents when parentIds is omitted', async () => {
    const upsertParent = jest.fn();
    const findMany = jest.fn().mockResolvedValue([
      { id: 'parent-a', relationship: 'MOTHER', createdAt: new Date('2026-01-01') },
    ]);
    const tx = {
      policyMemberDependant: { upsert: jest.fn() },
      policyMemberParent: { upsert: upsertParent },
      policyBeneficiary: { upsert: jest.fn() },
      dependant: { findMany: jest.fn().mockResolvedValue([]) },
      customerParent: { findMany },
    };
    const service = buildService(tx);

    await service.attachPolicyMembership(
      tx as never,
      { policyId: 'pol-2', customerId: 'cust-1' },
      'corr'
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerId: 'cust-1', deletedAt: null },
      })
    );
    expect(upsertParent).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          policyId_customerParentId: { policyId: 'pol-2', customerParentId: 'parent-a' },
        },
      })
    );
  });
});
