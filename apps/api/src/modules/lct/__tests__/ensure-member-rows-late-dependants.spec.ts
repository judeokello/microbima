import { DependantRelationship, PolicyStatus } from '@prisma/client';
import { LctSyncService } from '../lct-sync.service';
import { PolicyService } from '../../../services/policy.service';

describe('LctSyncService.ensureMemberRowsForLateDependants', () => {
  const correlationId = 'test-ensure-pmd';

  function buildService(deps: {
    prisma: any;
    policyService: Partial<PolicyService>;
  }) {
    return new LctSyncService(
      deps.prisma,
      deps.policyService as PolicyService
    );
  }

  it('creates missing PMD rows with sequences after existing dependants (Joseph-style)', async () => {
    const create = jest.fn().mockResolvedValue({});
    const generateMemberNumberForPolicy = jest
      .fn()
      .mockResolvedValueOnce('MFG192-02')
      .mockResolvedValueOnce('MFG192-03');

    const prisma = {
      policy: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'pol-1',
          packageId: 1,
          policyNumber: 'MP/MFG/192',
          status: PolicyStatus.SUSPENDED,
          customer: {
            dependants: [
              {
                id: 'simon',
                relationship: DependantRelationship.CHILD,
              },
              {
                id: 'brian',
                relationship: DependantRelationship.CHILD,
              },
              {
                id: 'already',
                relationship: DependantRelationship.CHILD,
              },
            ],
            policyMemberPrincipals: [{ id: 'pmp' }],
          },
        }),
      },
      policyMemberDependant: {
        findMany: jest.fn().mockResolvedValue([{ dependantId: 'already' }]),
        create,
      },
    };

    const orderDependantsForMemberNumbers = jest.fn((deps: any[]) => deps) as any;
    const service = buildService({
      prisma,
      policyService: {
        orderDependantsForMemberNumbers,
        generateMemberNumberForPolicy,
      },
    });

    await service.ensureMemberRowsForLateDependants('pol-1', correlationId);

    expect(orderDependantsForMemberNumbers).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'simon' }),
        expect.objectContaining({ id: 'brian' }),
      ])
    );
    expect(generateMemberNumberForPolicy).toHaveBeenNthCalledWith(
      1,
      1,
      'MP/MFG/192',
      prisma,
      correlationId,
      2
    );
    expect(generateMemberNumberForPolicy).toHaveBeenNthCalledWith(
      2,
      1,
      'MP/MFG/192',
      prisma,
      correlationId,
      3
    );
    expect(create).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledWith({
      data: {
        dependantId: 'simon',
        policyId: 'pol-1',
        memberNumber: 'MFG192-02',
      },
    });
  });

  it('no-ops when principal member row is missing (not yet activated)', async () => {
    const create = jest.fn();
    const prisma = {
      policy: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'pol-1',
          packageId: 1,
          policyNumber: null,
          status: PolicyStatus.PENDING_ACTIVATION,
          customer: {
            dependants: [{ id: 'd1', relationship: DependantRelationship.CHILD }],
            policyMemberPrincipals: [],
          },
        }),
      },
      policyMemberDependant: { findMany: jest.fn(), create },
    };

    const service = buildService({
      prisma,
      policyService: {
        orderDependantsForMemberNumbers: jest.fn(),
        generateMemberNumberForPolicy: jest.fn(),
      },
    });

    await service.ensureMemberRowsForLateDependants('pol-1', correlationId);
    expect(create).not.toHaveBeenCalled();
  });

  it('no-ops when all dependants already have PMD rows', async () => {
    const create = jest.fn();
    const prisma = {
      policy: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'pol-1',
          packageId: 1,
          policyNumber: 'MP/MFG/290',
          status: PolicyStatus.ACTIVE,
          customer: {
            dependants: [{ id: 'kailani', relationship: DependantRelationship.CHILD }],
            policyMemberPrincipals: [{ id: 'pmp' }],
          },
        }),
      },
      policyMemberDependant: {
        findMany: jest.fn().mockResolvedValue([{ dependantId: 'kailani' }]),
        create,
      },
    };

    const service = buildService({
      prisma,
      policyService: {
        orderDependantsForMemberNumbers: jest.fn((d: any[]) => d) as any,
        generateMemberNumberForPolicy: jest.fn(),
      },
    });

    await service.ensureMemberRowsForLateDependants('pol-1', correlationId);
    expect(create).not.toHaveBeenCalled();
  });
});
