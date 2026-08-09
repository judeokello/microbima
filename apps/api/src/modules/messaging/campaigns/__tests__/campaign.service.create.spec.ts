import { CampaignService } from '../campaign.service';
import { ValidationException } from '../../../../exceptions/validation.exception';
import { CampaignComposeRequestDto, AudienceModeDto, CampaignChannelDto } from '../../../../dto/messaging/campaign.dto';

describe('CampaignService.create (SMS)', () => {
  let service: CampaignService;
  let prisma: any;
  let systemSettings: { getSnapshot: jest.Mock };
  let preflightService: {
    run: jest.Mock;
    isEmptyBody: jest.Mock;
    computePerSchemeCounts: jest.Mock;
    computePerPackageCounts: jest.Mock;
  };
  let audienceService: { contentHash: jest.Mock };

  const dto = (overrides: Partial<CampaignComposeRequestDto> = {}): CampaignComposeRequestDto => ({
    name: 'Send Me',
    channel: CampaignChannelDto.SMS,
    body: 'Hi {first_name}',
    audience: {
      modes: [AudienceModeDto.SCHEME_CUSTOMERS],
      schemeIds: [1],
      packageIds: [10],
      customerStatuses: ['ACTIVE'],
      policyStatuses: ['ACTIVE'],
    },
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      messagingCampaign: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }: any) => ({
          id: 'camp-1',
          ...data,
          createdAt: new Date('2026-08-08T00:00:00Z'),
          updatedAt: new Date('2026-08-08T00:00:00Z'),
          dispatchStartedAt: null,
          completedAt: null,
          cancelledAt: null,
          cancelledBy: null,
        })),
      },
      messagingDelivery: { count: jest.fn().mockResolvedValue(0) },
      scheme: { findMany: jest.fn().mockResolvedValue([]) },
      package: { findMany: jest.fn().mockResolvedValue([]) },
    };
    systemSettings = {
      getSnapshot: jest.fn().mockResolvedValue({
        campaignConfirmThreshold: 20,
        campaignSmsDelaySeconds: 120,
        campaignEmailDelaySeconds: 180,
        campaignIdempotencyWindowMinutes: 10,
        general_support_number: '1',
        medical_support_number: '2',
      }),
    };
    preflightService = {
      isEmptyBody: jest.fn((_: string, body: string) => !body?.trim()),
      computePerSchemeCounts: jest.fn().mockReturnValue([]),
      computePerPackageCounts: jest.fn().mockReturnValue([]),
      run: jest.fn().mockResolvedValue({
        sendable: [{ customerId: 'c1', schemeId: 1, contributingSchemeIds: [1], normalizedAddress: '254700000001' }],
        blockingErrors: [],
        softSkips: [],
        sample: null,
        sendableCount: 1,
        largeAudienceWarning: false,
        characterCount: 10,
        smsSegmentCount: 1,
        bodyForPersist: 'Hi {first_name}',
        subjectForPersist: null,
      }),
    };
    audienceService = { contentHash: jest.fn().mockReturnValue('content-hash') };
    service = new CampaignService(
      prisma,
      systemSettings as any,
      audienceService as any,
      preflightService as any,
    );
  });

  it('creates DELAYED campaign with English template key and dispatchStartsAt', async () => {
    const created = await service.create(dto(), 'admin-1', { correlationId: 'corr-1' });
    expect(created.status).toBe('DELAYED');
    expect(created.templateKey).toBe('admin_template_sms');
    expect(created.dispatchStartsAt).toBeInstanceOf(Date);
    expect(prisma.messagingCampaign.create).toHaveBeenCalled();
  });

  it('requires confirmationName when sendableCount >= threshold', async () => {
    preflightService.run.mockResolvedValue({
      sendable: [],
      blockingErrors: [],
      softSkips: [],
      sample: null,
      sendableCount: 25,
      largeAudienceWarning: false,
      characterCount: 10,
      smsSegmentCount: 1,
      bodyForPersist: 'Hi',
      subjectForPersist: null,
    });
    await expect(service.create(dto({ body: 'Hi' }), 'admin-1')).rejects.toBeInstanceOf(
      ValidationException,
    );
    await expect(
      service.create(dto({ body: 'Hi', confirmationName: 'Send Me' }), 'admin-1'),
    ).resolves.toMatchObject({ status: 'DELAYED' });
  });

  it('returns existing campaign for Idempotency-Key', async () => {
    prisma.messagingCampaign.findUnique.mockResolvedValue({
      id: 'existing',
      name: 'Send Me',
      requestedName: 'Send Me',
      channel: 'SMS',
      templateKey: 'admin_template_sms',
      status: 'DELAYED',
      subjectWithPlaceholders: null,
      bodyWithPlaceholders: 'Hi',
      audienceSnapshot: {},
      targetedCount: 1,
      dispatchStartsAt: new Date(),
      dispatchStartedAt: null,
      completedAt: null,
      cancelledAt: null,
      cancelledBy: null,
      createdBy: 'admin-1',
      createdAt: new Date(),
    });
    const result = await service.create(dto(), 'admin-1', { idempotencyKey: 'key-1' });
    expect(result.id).toBe('existing');
    expect(prisma.messagingCampaign.create).not.toHaveBeenCalled();
  });

  it('assertImmutable rejects content updates after Send', () => {
    expect(() => service.assertImmutable('camp-1')).toThrow(ValidationException);
  });
});
