import * as Sentry from '@sentry/nestjs';
import { CampaignService } from '../campaign.service';
import {
  AudienceModeDto,
  CampaignChannelDto,
  CampaignComposeRequestDto,
} from '../../../../dto/messaging/campaign.dto';

jest.mock('@sentry/nestjs', () => ({
  captureMessage: jest.fn(),
  captureException: jest.fn(),
}));

describe('CampaignService preflight persistence (US3)', () => {
  let service: CampaignService;
  let prisma: {
    messagingCampaign: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
    };
    messagingDelivery: { count: jest.Mock; findMany: jest.Mock };
    scheme: { findMany: jest.Mock };
    package: { findMany: jest.Mock };
  };
  let systemSettings: { getSnapshot: jest.Mock };
  let preflightService: {
    run: jest.Mock;
    isEmptyBody: jest.Mock;
    computePerSchemeCounts: jest.Mock;
    computePerPackageCounts: jest.Mock;
  };
  let audienceService: {
    contentHash: jest.Mock;
    normalizePhone: jest.Mock;
    normalizeEmail: jest.Mock;
  };

  const dto = (): CampaignComposeRequestDto => ({
    name: 'Policy Ping',
    channel: CampaignChannelDto.SMS,
    body: 'Hi {first_name} {policy_number}',
    audience: {
      modes: [AudienceModeDto.SCHEME_CUSTOMERS],
      schemeIds: [1],
      packageIds: [10],
      customerStatuses: ['ACTIVE'],
      policyStatuses: ['ACTIVE'],
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      messagingCampaign: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'camp-fail-1',
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
          dispatchStartedAt: null,
          completedAt: null,
          cancelledAt: null,
          cancelledBy: null,
        })),
      },
      messagingDelivery: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn() },
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
      isEmptyBody: jest.fn().mockReturnValue(false),
      computePerSchemeCounts: jest.fn().mockReturnValue([]),
      computePerPackageCounts: jest.fn().mockReturnValue([]),
      run: jest.fn(),
    };
    audienceService = {
      contentHash: jest.fn().mockReturnValue('h'),
      normalizePhone: jest.fn().mockReturnValue(null),
      normalizeEmail: jest.fn().mockReturnValue(null),
    };
    service = new CampaignService(
      prisma as never,
      systemSettings as never,
      audienceService as never,
      preflightService as never,
    );
  });

  it('preview with blocking errors creates no campaign row and returns error rows', async () => {
    preflightService.run.mockResolvedValue({
      sendable: [],
      blockingErrors: [
        {
          customerName: 'Ann',
          phone: '254700000001',
          email: null,
          customerId: 'c1',
          error: 'Missing placeholder: policy_number',
        },
      ],
      softSkips: [],
      sample: null,
      sendableCount: 0,
      largeAudienceWarning: false,
      characterCount: 10,
      smsSegmentCount: 1,
      bodyForPersist: 'Hi {first_name} {policy_number}',
      subjectForPersist: null,
    });

    const preview = await service.preview(dto(), 'admin-1');
    expect(preview.blockingErrors).toHaveLength(1);
    expect(prisma.messagingCampaign.create).not.toHaveBeenCalled();
  });

  it('Send with blocking errors saves FAILED_PREFLIGHT renamed _failedX and frees original name', async () => {
    preflightService.run.mockResolvedValue({
      sendable: [],
      blockingErrors: [
        {
          customerName: 'Ann',
          phone: '254700000001',
          customerId: 'c1',
          error: 'Missing placeholder: policy_number',
        },
      ],
      softSkips: [],
      sample: null,
      sendableCount: 0,
      largeAudienceWarning: false,
      characterCount: 10,
      smsSegmentCount: 1,
      bodyForPersist: 'Hi {first_name} {policy_number}',
      subjectForPersist: null,
    });

    const created = await service.create(dto(), 'admin-1');
    expect(created.status).toBe('FAILED_PREFLIGHT');
    expect(created.name).toBe('Policy Ping_failed1');
    expect(created.requestedName).toBe('Policy Ping');
    expect(created.progress.targetedCount).toBe(0);
    expect((created as { _failedPreflight?: boolean })._failedPreflight).toBe(true);
    expect(Sentry.captureMessage).toHaveBeenCalled();
  });

  it('soft-skips alone do not Sentry; successful DELAYED create does not Sentry', async () => {
    preflightService.run.mockResolvedValue({
      sendable: [{ normalizedAddress: '254700000001', schemeId: 1 }],
      blockingErrors: [],
      softSkips: [{ customerName: 'Bob', phone: null, error: 'Missing phone' }],
      sample: null,
      sendableCount: 1,
      largeAudienceWarning: false,
      characterCount: 10,
      smsSegmentCount: 1,
      bodyForPersist: 'Hi',
      subjectForPersist: null,
    });

    const created = await service.create({ ...dto(), body: 'Hi' }, 'admin-1');
    expect(created.status).toBe('DELAYED');
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });
});
