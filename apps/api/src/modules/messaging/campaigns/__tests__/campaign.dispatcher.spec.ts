import { CampaignDispatcher } from '../campaign.dispatcher';

describe('CampaignDispatcher', () => {
  let dispatcher: CampaignDispatcher;
  let prisma: any;
  let systemSettings: { getSnapshot: jest.Mock };
  let preflightService: { run: jest.Mock };

  beforeEach(() => {
    prisma = {
      messagingCampaign: {
        findMany: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'camp-1',
          channel: 'SMS',
          bodyWithPlaceholders: 'Hi {first_name}',
          subjectWithPlaceholders: null,
          audienceSnapshot: {
            modes: ['SCHEME_CUSTOMERS'],
            schemeIds: [1],
            packageIds: [10],
            customerStatuses: ['ACTIVE'],
            policyStatuses: ['ACTIVE'],
          },
          correlationId: 'corr',
        }),
      },
      messagingCampaignAuditEvent: { create: jest.fn() },
      messagingDelivery: { create: jest.fn().mockResolvedValue({ id: 'd1' }) },
      customer: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ phoneNumber: '254700000001', createdBy: 'creator-1' }),
      },
    };
    systemSettings = {
      getSnapshot: jest.fn().mockResolvedValue({
        smsMaxAttempts: 2,
        emailMaxAttempts: 5,
        general_support_number: '1',
        medical_support_number: '2',
      }),
    };
    preflightService = {
      run: jest.fn().mockResolvedValue({
        sendable: [
          {
            channel: 'SMS',
            normalizedAddress: '254700000001',
            customerId: 'c1',
            policyId: 'p1',
            schemeId: 1,
            customerName: 'Ann',
            renderedSubject: null,
            renderedBody: 'Hi Ann',
            contentHash: 'h',
            placeholderValues: { first_name: 'Ann' },
            softSkip: null,
            blockingError: null,
          },
        ],
      }),
    };
    const supabase = {
      getUserMessagingContacts: jest.fn().mockResolvedValue({ phone: '254711111111', email: 'a@b.com' }),
    };
    dispatcher = new CampaignDispatcher(
      prisma,
      systemSettings as any,
      preflightService as any,
      supabase as any,
    );
  });

  it('claims DELAYED campaign and creates PENDING pre-rendered deliveries with en language', async () => {
    await dispatcher.dispatchCampaign('camp-1');

    expect(prisma.messagingCampaign.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'camp-1', status: 'DELAYED' },
        data: expect.objectContaining({ status: 'DISPATCHING' }),
      }),
    );
    expect(prisma.messagingDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          campaignId: 'camp-1',
          status: 'PENDING',
          requestedLanguage: 'en',
          usedLanguage: 'en',
          templateKey: 'admin_template_sms',
          renderedBody: expect.stringContaining('Hi Ann'),
          recipientPhone: '254700000001',
        }),
      }),
    );
    expect(prisma.messagingCampaign.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'COMPLETED' }),
      }),
    );
  });

  it('creates admin_template_email deliveries with pre-rendered subject/HTML', async () => {
    prisma.messagingCampaign.findUnique.mockResolvedValue({
      id: 'camp-email',
      channel: 'EMAIL',
      bodyWithPlaceholders: '<p>Hi {first_name}</p>',
      subjectWithPlaceholders: 'Hello {first_name}',
      audienceSnapshot: {
        modes: ['SCHEME_CONTACTS'],
        schemeIds: [1],
      },
      correlationId: 'corr-e',
    });
    preflightService.run.mockResolvedValue({
      sendable: [
        {
          channel: 'EMAIL',
          normalizedAddress: 'ann@ex.com',
          customerId: 'c1',
          policyId: null,
          schemeId: 1,
          customerName: 'Ann',
          renderedSubject: 'Hello Ann',
          renderedBody: '<p>Hi Ann</p>',
          contentHash: 'he',
          placeholderValues: { first_name: 'Ann' },
          softSkip: null,
          blockingError: null,
        },
      ],
    });

    await dispatcher.dispatchCampaign('camp-email');

    expect(prisma.messagingDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          campaignId: 'camp-email',
          channel: 'EMAIL',
          templateKey: 'admin_template_email',
          renderedSubject: 'Hello Ann',
          renderedBody: '<p>Hi Ann</p>',
          recipientEmail: 'ann@ex.com',
          requestedLanguage: 'en',
          usedLanguage: 'en',
          status: 'PENDING',
        }),
      }),
    );
  });

  it('finalizes COMPLETED_WITH_FAILURES when some delivery creates fail', async () => {
    prisma.messagingDelivery.create
      .mockResolvedValueOnce({ id: 'd1' })
      .mockRejectedValueOnce(new Error('db fail'));
    preflightService.run.mockResolvedValue({
      sendable: [
        {
          channel: 'SMS',
          normalizedAddress: '254700000001',
          customerId: 'c1',
          policyId: null,
          schemeId: 1,
          customerName: 'A',
          renderedSubject: null,
          renderedBody: 'a',
          contentHash: 'a',
          placeholderValues: {},
          softSkip: null,
          blockingError: null,
        },
        {
          channel: 'SMS',
          normalizedAddress: '254700000002',
          customerId: 'c2',
          policyId: null,
          schemeId: 1,
          customerName: 'B',
          renderedSubject: null,
          renderedBody: 'b',
          contentHash: 'b',
          placeholderValues: {},
          softSkip: null,
          blockingError: null,
        },
      ],
    });

    await dispatcher.dispatchCampaign('camp-1');

    expect(prisma.messagingCampaign.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'COMPLETED_WITH_FAILURES' }),
      }),
    );
  });
});
