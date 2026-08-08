import { ConflictException } from '@nestjs/common';
import { CampaignService } from '../campaign.service';

describe('CampaignService.cancel (US4)', () => {
  let service: CampaignService;
  let prisma: {
    messagingCampaign: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    messagingDelivery: {
      updateMany: jest.Mock;
      count: jest.Mock;
    };
    messagingCampaignAuditEvent: { create: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      messagingCampaign: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      messagingDelivery: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(0),
      },
      messagingCampaignAuditEvent: { create: jest.fn() },
    };
    service = new CampaignService(
      prisma as never,
      { getSnapshot: jest.fn() } as never,
      {} as never,
      { isEmptyBody: jest.fn() } as never,
    );
  });

  it('cancels DELAYED → CANCELLED with no delivery handoffs', async () => {
    prisma.messagingCampaign.findUnique.mockResolvedValue({
      id: 'c1',
      status: 'DELAYED',
      targetedCount: 0,
      name: 'X',
      requestedName: 'X',
      channel: 'SMS',
      templateKey: 'admin_template_sms',
      subjectWithPlaceholders: null,
      bodyWithPlaceholders: 'Hi',
      audienceSnapshot: {},
      dispatchStartsAt: new Date(),
      dispatchStartedAt: null,
      completedAt: null,
      cancelledAt: null,
      cancelledBy: null,
      createdBy: 'admin',
      createdAt: new Date(),
    });
    prisma.messagingCampaign.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'c1',
      name: 'X',
      requestedName: 'X',
      channel: 'SMS',
      templateKey: 'admin_template_sms',
      status: data.status,
      subjectWithPlaceholders: null,
      bodyWithPlaceholders: 'Hi',
      audienceSnapshot: {},
      targetedCount: 0,
      dispatchStartsAt: new Date(),
      dispatchStartedAt: null,
      completedAt: data.completedAt,
      cancelledAt: data.cancelledAt,
      cancelledBy: data.cancelledBy,
      createdBy: 'admin',
      createdAt: new Date(),
    }));

    const result = await service.cancel('c1', 'admin-1');
    expect(result.status).toBe('CANCELLED');
    expect(prisma.messagingDelivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          campaignId: 'c1',
          status: { in: ['PENDING', 'RETRY_WAIT'] },
        }),
        data: { status: 'CANCELLED' },
      }),
    );
  });

  it('cancels DISPATCHING PENDING only; leaves SENT untouched (updateMany filter)', async () => {
    prisma.messagingCampaign.findUnique.mockResolvedValue({
      id: 'c2',
      status: 'DISPATCHING',
      targetedCount: 10,
      name: 'Y',
      requestedName: 'Y',
      channel: 'SMS',
      templateKey: 'admin_template_sms',
      subjectWithPlaceholders: null,
      bodyWithPlaceholders: 'Hi',
      audienceSnapshot: {},
      dispatchStartsAt: new Date(),
      dispatchStartedAt: new Date(),
      completedAt: null,
      cancelledAt: null,
      cancelledBy: null,
      createdBy: 'admin',
      createdAt: new Date(),
    });
    prisma.messagingCampaign.update.mockResolvedValue({
      id: 'c2',
      name: 'Y',
      requestedName: 'Y',
      channel: 'SMS',
      templateKey: 'admin_template_sms',
      status: 'CANCELLED',
      subjectWithPlaceholders: null,
      bodyWithPlaceholders: 'Hi',
      audienceSnapshot: {},
      targetedCount: 10,
      dispatchStartsAt: new Date(),
      dispatchStartedAt: new Date(),
      completedAt: new Date(),
      cancelledAt: new Date(),
      cancelledBy: 'admin-1',
      createdBy: 'admin',
      createdAt: new Date(),
    });
    prisma.messagingDelivery.updateMany.mockResolvedValue({ count: 3 });

    await service.cancel('c2', 'admin-1');
    expect(prisma.messagingDelivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          campaignId: 'c2',
          status: { in: ['PENDING', 'RETRY_WAIT'] },
        },
      }),
    );
  });

  it('rejects cancel when already COMPLETED', async () => {
    prisma.messagingCampaign.findUnique.mockResolvedValue({
      id: 'c3',
      status: 'COMPLETED',
    });
    await expect(service.cancel('c3', 'admin-1')).rejects.toBeInstanceOf(ConflictException);
  });
});
