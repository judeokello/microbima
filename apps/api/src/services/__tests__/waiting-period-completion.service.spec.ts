import { PolicyStatus } from '@prisma/client';
import { WaitingPeriodCompletionService } from '../waiting-period-completion.service';

describe('WaitingPeriodCompletionService', () => {
  const asOf = new Date('2026-03-01T01:00:00.000Z');
  const correlationId = 'cid-daily';

  function policy(params: {
    id: string;
    startDate: Date;
    days: number;
    enrolled?: boolean;
  }) {
    return {
      id: params.id,
      customerId: `cust-${params.id}`,
      packageId: 1,
      startDate: params.startDate,
      productName: 'MfanisiGo',
      lctMemberSyncTargets: params.enrolled
        ? [{ pendingAction: null, lastSentAt: new Date('2026-01-01T00:00:00.000Z') }]
        : [],
    };
  }

  function build(policies: ReturnType<typeof policy>[], daysByCustomer: Record<string, number>) {
    const onPolicyActivated = jest.fn().mockResolvedValue(undefined);
    const enqueue = jest.fn().mockResolvedValue(undefined);
    const notificationCreate = jest.fn().mockResolvedValue({ id: 'n1' });
    const prisma = {
      policy: {
        findMany: jest.fn().mockResolvedValue(policies),
      },
      packageSchemeCustomer: {
        findMany: jest.fn().mockResolvedValue(
          policies.map((item) => ({
            customerId: item.customerId,
            packageScheme: {
              packageId: item.packageId,
              generalSchemeWaitingPeriod: daysByCustomer[item.customerId],
            },
          })),
        ),
      },
      policyLifecycleNotification: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: notificationCreate,
      },
    };
    const service = new WaitingPeriodCompletionService(
      prisma as never,
      { onPolicyActivated } as never,
      { enqueue } as never,
      { getSnapshot: jest.fn().mockResolvedValue({ general_support_number: '0746907934' }) } as never,
    );
    return { service, prisma, onPolicyActivated, enqueue, notificationCreate };
  }

  it('loads only active policies, so a same-morning suspension is already excluded', async () => {
    const { service, prisma } = build([], {});
    await service.evaluate(asOf, correlationId);
    expect(prisma.policy.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: PolicyStatus.ACTIVE,
          customer: { isTestUser: false },
        }),
      }),
    );
  });

  it('enrolls and texts when the access date is this UTC day', async () => {
    const today = policy({
      id: 'today',
      startDate: new Date('2026-01-30T00:00:00.000Z'),
      days: 30,
    });
    const { service, onPolicyActivated, enqueue, notificationCreate } = build([today], {
      'cust-today': 30,
    });

    const result = await service.evaluate(asOf, correlationId);

    expect(result).toEqual({ lctEnrolled: 1, smsQueued: 1 });
    expect(onPolicyActivated).toHaveBeenCalledWith('today', correlationId);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: 'waiting_period_ended',
        policyId: 'today',
        placeholderValues: expect.objectContaining({
          product_name: 'MfanisiGo',
          general_support_number: '0746907934',
        }),
      }),
    );
    expect(notificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          policyId: 'today',
          scheduleKey: 'WAITING_PERIOD_ENDED',
          templateKey: 'waiting_period_ended',
        }),
      }),
    );
  });

  it('enrolls an earlier access date without sending the ended SMS', async () => {
    const earlier = policy({
      id: 'earlier',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      days: 30,
    });
    const { service, onPolicyActivated, enqueue } = build([earlier], { 'cust-earlier': 30 });

    const result = await service.evaluate(asOf, correlationId);

    expect(result).toEqual({ lctEnrolled: 1, smsQueued: 0 });
    expect(onPolicyActivated).toHaveBeenCalledWith('earlier', correlationId);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('skips zero-day policies and policies already sent to LCT', async () => {
    const zero = policy({
      id: 'zero',
      startDate: new Date('2026-03-01T00:00:00.000Z'),
      days: 0,
    });
    const sent = policy({
      id: 'sent',
      startDate: new Date('2026-01-30T00:00:00.000Z'),
      days: 30,
      enrolled: true,
    });
    const { service, onPolicyActivated, enqueue } = build([zero, sent], {
      'cust-zero': 0,
      'cust-sent': 30,
    });

    const result = await service.evaluate(asOf, correlationId);

    expect(result.lctEnrolled).toBe(0);
    expect(onPolicyActivated).not.toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ policyId: 'sent' }),
    );
  });
});
