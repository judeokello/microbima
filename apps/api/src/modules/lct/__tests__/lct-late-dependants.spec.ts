/// <reference types="jest" />
import { PolicyStatus } from '@prisma/client';
import { LctSyncService } from '../lct-sync.service';

describe('LctSyncService.ensureMemberRowsForLateDependants', () => {
  const prisma = {
    policy: { findUnique: jest.fn() },
    policyMemberDependant: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  };
  const policyService = {
    orderDependantsForMemberNumbers: jest.fn((rows: Array<{ id: string }>) => rows),
    generateMemberNumberForPolicy: jest.fn().mockResolvedValue('MN-01'),
  };
  const service = new LctSyncService(prisma as never, policyService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips EXPIRED and TERMINATED policies', async () => {
    prisma.policy.findUnique.mockResolvedValue({
      id: 'p1',
      status: PolicyStatus.EXPIRED,
      policyNumber: 'P-1',
      packageId: 1,
      customer: {
        dependants: [{ id: 'd-new' }],
        policyMemberPrincipals: [{ id: 1 }],
      },
    });

    await service.ensureMemberRowsForLateDependants('p1', 'corr', undefined, ['d-new']);
    expect(prisma.policyMemberDependant.create).not.toHaveBeenCalled();

    prisma.policy.findUnique.mockResolvedValue({
      id: 'p2',
      status: PolicyStatus.TERMINATED,
      policyNumber: 'P-2',
      packageId: 1,
      customer: {
        dependants: [{ id: 'd-new' }],
        policyMemberPrincipals: [{ id: 1 }],
      },
    });
    await service.ensureMemberRowsForLateDependants('p2', 'corr', undefined, ['d-new']);
    expect(prisma.policyMemberDependant.create).not.toHaveBeenCalled();
  });

  it('only attaches newly added dependant IDs on occupying policies', async () => {
    prisma.policy.findUnique.mockResolvedValue({
      id: 'p1',
      status: PolicyStatus.ACTIVE,
      policyNumber: 'P-1',
      packageId: 1,
      customer: {
        dependants: [
          { id: 'old-child', relationship: 'CHILD', deletedAt: null },
          { id: 'new-child', relationship: 'CHILD', deletedAt: null },
        ],
        policyMemberPrincipals: [{ id: 1 }],
      },
    });
    prisma.policyMemberDependant.findMany.mockResolvedValue([{ dependantId: 'old-child' }]);

    await service.ensureMemberRowsForLateDependants('p1', 'corr', undefined, ['new-child']);

    expect(policyService.orderDependantsForMemberNumbers).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'new-child' }),
    ]);
    expect(prisma.policyMemberDependant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ dependantId: 'new-child', policyId: 'p1' }),
      })
    );
  });

  it('does not attach every customer dependant when no new IDs are provided', async () => {
    prisma.policy.findUnique.mockResolvedValue({
      id: 'p1',
      status: PolicyStatus.ACTIVE,
      policyNumber: 'P-1',
      packageId: 1,
      customer: {
        dependants: [{ id: 'policy-2-only', relationship: 'CHILD', deletedAt: null }],
        policyMemberPrincipals: [{ id: 1 }],
      },
    });
    prisma.policyMemberDependant.findMany.mockResolvedValue([]);

    await service.ensureMemberRowsForLateDependants('p1', 'corr');
    expect(prisma.policyMemberDependant.create).not.toHaveBeenCalled();
  });
});
