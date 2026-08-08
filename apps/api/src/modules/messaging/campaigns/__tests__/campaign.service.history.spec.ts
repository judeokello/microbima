import { CampaignService } from '../campaign.service';

describe('CampaignService history (US5)', () => {
  let service: CampaignService;
  let prisma: {
    messagingCampaign: { findUnique: jest.Mock; findMany: jest.Mock; count: jest.Mock };
    messagingDelivery: { count: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      messagingCampaign: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn().mockResolvedValue(1),
      },
      messagingDelivery: {
        count: jest.fn(),
      },
    };
    service = new CampaignService(
      prisma as never,
      { getSnapshot: jest.fn() } as never,
      {} as never,
      { isEmptyBody: jest.fn() } as never,
    );
  });

  it('aggregates targeted / handedOff / receiptConfirmed on get', async () => {
    prisma.messagingCampaign.findUnique.mockResolvedValue({
      id: 'c1',
      name: 'N',
      requestedName: 'N',
      channel: 'SMS',
      templateKey: 'admin_template_sms',
      status: 'COMPLETED',
      subjectWithPlaceholders: null,
      bodyWithPlaceholders: 'Hi',
      audienceSnapshot: {},
      targetedCount: 10,
      dispatchStartsAt: null,
      dispatchStartedAt: null,
      completedAt: new Date(),
      cancelledAt: null,
      cancelledBy: null,
      createdBy: 'admin',
      createdAt: new Date(),
      preflightErrors: [],
      preflightSkips: [],
      auditEvents: [
        {
          eventType: 'DELAY_STARTED',
          actorUserId: 'admin',
          payload: {},
          createdAt: new Date(),
        },
      ],
    });
    prisma.messagingDelivery.count
      .mockResolvedValueOnce(7) // handedOff
      .mockResolvedValueOnce(4); // receiptConfirmed

    const detail = await service.getById('c1');
    expect(detail.progress).toEqual({
      targetedCount: 10,
      handedOffCount: 7,
      receiptConfirmedCount: 4,
    });
    expect(detail.auditEvents?.length).toBe(1);
  });

  it('EMAIL fixture may have receiptConfirmed=0 with handedOff > 0 (FR-037)', async () => {
    prisma.messagingCampaign.findUnique.mockResolvedValue({
      id: 'c2',
      name: 'E',
      requestedName: 'E',
      channel: 'EMAIL',
      templateKey: 'admin_template_email',
      status: 'COMPLETED',
      subjectWithPlaceholders: 'Hi',
      bodyWithPlaceholders: '<p>Hi</p>',
      audienceSnapshot: {},
      targetedCount: 5,
      dispatchStartsAt: null,
      dispatchStartedAt: null,
      completedAt: new Date(),
      cancelledAt: null,
      cancelledBy: null,
      createdBy: 'admin',
      createdAt: new Date(),
      preflightErrors: null,
      preflightSkips: null,
      auditEvents: [],
    });
    prisma.messagingDelivery.count
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(0);

    const detail = await service.getById('c2');
    expect(detail.progress.handedOffCount).toBe(5);
    expect(detail.progress.receiptConfirmedCount).toBe(0);
  });

  it('lists campaigns newest first with progress', async () => {
    prisma.messagingCampaign.findMany.mockResolvedValue([
      {
        id: 'c1',
        name: 'N',
        requestedName: 'N',
        channel: 'SMS',
        templateKey: 'admin_template_sms',
        status: 'DELAYED',
        subjectWithPlaceholders: null,
        bodyWithPlaceholders: 'Hi',
        audienceSnapshot: {},
        targetedCount: 3,
        dispatchStartsAt: new Date(),
        dispatchStartedAt: null,
        completedAt: null,
        cancelledAt: null,
        cancelledBy: null,
        createdBy: 'admin',
        createdAt: new Date(),
      },
    ]);
    prisma.messagingDelivery.count.mockResolvedValue(0);

    const list = await service.list({ page: 1, pageSize: 20 });
    expect(list.total).toBe(1);
    expect(list.data[0].progress.targetedCount).toBe(3);
    expect(prisma.messagingCampaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
    );
  });
});
