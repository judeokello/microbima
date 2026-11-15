import { LctPendingAction, LctSubjectType, PolicyStatus } from '@prisma/client';
import { LctSyncService } from '../lct-sync.service';

describe('LctSyncService waiting-period gate', () => {
  const correlationId = 'cid-wait';
  const futureStart = new Date('2099-01-01T00:00:00.000Z');

  function build(waitingDays: number) {
    const upsert = jest.fn().mockResolvedValue({ id: 't1' });
    const update = jest.fn().mockResolvedValue({});
    const policy = {
      id: 'pol-1',
      status: PolicyStatus.ACTIVE,
      customerId: 'cust-1',
      packageId: 1,
      startDate: futureStart,
      policyNumber: 'P1',
      customer: {
        id: 'cust-1',
        isTestUser: false,
        firstName: 'Ada',
        middleName: null,
        lastName: 'Lovelace',
        dateOfBirth: null,
        gender: null,
        phoneNumber: null,
        idNumber: null,
      },
    };
    const target = {
      id: 't1',
      policyId: 'pol-1',
      memberNumber: 'M1',
      subjectType: LctSubjectType.PRINCIPAL,
      dependantId: null,
      errorCode: null,
      pendingAction: null,
      pendingReasons: [],
      pendingSince: null,
      lastSentAt: null,
      lastSentAction: null,
    };
    const prisma = {
      policy: { findUnique: jest.fn().mockResolvedValue(policy) },
      packageSchemeCustomer: {
        findFirst: jest.fn().mockResolvedValue({
          packageScheme: { generalSchemeWaitingPeriod: waitingDays },
        }),
      },
      lctMemberSyncTarget: {
        count: jest.fn().mockResolvedValue(0),
        upsert,
        findMany: jest.fn().mockResolvedValue([target]),
        findUnique: jest.fn().mockResolvedValue(target),
        update,
      },
      policyMemberPrincipal: {
        findFirst: jest.fn().mockResolvedValue({ memberNumber: 'M1', policyId: 'pol-1' }),
      },
      policyMemberDependant: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new LctSyncService(prisma as never, {
      orderDependantsForMemberNumbers: jest.fn((rows: unknown[]) => rows),
      generateMemberNumberForPolicy: jest.fn(),
    } as never);
    return { service, upsert, update };
  }

  it('does not create LCT targets while a 30-day wait is still in the future', async () => {
    const { service, upsert, update } = build(30);
    await service.onPolicyActivated('pol-1', correlationId);
    expect(upsert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('enrolls immediately when the waiting period is zero days', async () => {
    const { service, upsert, update } = build(0);
    await service.onPolicyActivated('pol-1', correlationId);
    expect(upsert).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pendingAction: LctPendingAction.ACTIVATE }),
      }),
    );
  });
});
