import { CampaignService } from '../campaign.service';
import { ValidationException } from '../../../../exceptions/validation.exception';
import { CampaignComposeRequestDto, AudienceModeDto, CampaignChannelDto } from '../../../../dto/messaging/campaign.dto';

describe('CampaignService.preview (SMS)', () => {
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

  const baseDto = (): CampaignComposeRequestDto => ({
    name: 'August SMS',
    channel: CampaignChannelDto.SMS,
    body: 'Hi {first_name}',
    audience: {
      modes: [AudienceModeDto.SCHEME_CUSTOMERS],
      schemeIds: [1],
      packageIds: [10],
      customerStatuses: ['ACTIVE'],
      policyStatuses: ['ACTIVE'],
    },
  });

  beforeEach(() => {
    prisma = {
      scheme: {
        findMany: jest.fn().mockResolvedValue([{ id: 1, schemeName: 'Scheme A' }]),
      },
      package: {
        findMany: jest.fn().mockResolvedValue([{ id: 10, name: 'Pkg' }]),
      },
      messagingCampaign: {},
      messagingDelivery: { count: jest.fn() },
    };
    systemSettings = {
      getSnapshot: jest.fn().mockResolvedValue({
        campaignConfirmThreshold: 20,
        campaignSmsDelaySeconds: 120,
        campaignEmailDelaySeconds: 180,
        campaignIdempotencyWindowMinutes: 10,
        general_support_number: '0746907934',
        medical_support_number: '0113569606',
      }),
    };
    preflightService = {
      isEmptyBody: jest.fn((channel: string, body: string) => !body || !String(body).trim()),
      computePerSchemeCounts: jest.fn(
        (
          schemes: Array<{ id: number; schemeName: string }>,
          sendable: Array<{ schemeId?: number | null; contributingSchemeIds?: number[] }>,
        ) =>
          schemes.map((s) => ({
            schemeId: s.id,
            schemeName: s.schemeName,
            recipientCount: sendable.filter((c) =>
              (c.contributingSchemeIds ?? (c.schemeId != null ? [c.schemeId] : [])).includes(s.id),
            ).length,
          })),
      ),
      computePerPackageCounts: jest.fn(
        (
          packages: Array<{ id: number; name: string }>,
          sendable: Array<{ packageId?: number | null; contributingPackageIds?: number[] }>,
        ) =>
          packages.map((p) => ({
            packageId: p.id,
            packageName: p.name,
            recipientCount: sendable.filter((c) =>
              (c.contributingPackageIds ?? (c.packageId != null ? [c.packageId] : [])).includes(p.id),
            ).length,
          })),
      ),
      run: jest.fn().mockResolvedValue({
        sendable: [
          {
            channel: 'SMS',
            normalizedAddress: '254700000001',
            customerId: 'c1',
            policyId: 'p1',
            schemeId: 1,
            contributingSchemeIds: [1],
            packageId: 10,
            contributingPackageIds: [10],
            customerName: 'Ann',
            renderedSubject: null,
            renderedBody: 'Hi Ann',
            contentHash: 'h1',
            placeholderValues: { first_name: 'Ann' },
            softSkip: null,
            blockingError: null,
          },
        ],
        blockingErrors: [],
        softSkips: [],
        sample: {
          channel: 'SMS',
          normalizedAddress: '254700000001',
          customerId: 'c1',
          policyId: 'p1',
          schemeId: 1,
          customerName: 'Ann',
          renderedSubject: null,
          renderedBody: 'Hi Ann',
          contentHash: 'h1',
          placeholderValues: { first_name: 'Ann' },
          softSkip: null,
          blockingError: null,
        },
        sendableCount: 1,
        largeAudienceWarning: false,
        characterCount: 14,
        smsSegmentCount: 1,
        bodyForPersist: 'Hi {first_name}',
        subjectForPersist: null,
      }),
    };
    audienceService = { contentHash: jest.fn().mockReturnValue('hash') };
    service = new CampaignService(
      prisma,
      systemSettings as any,
      audienceService as any,
      preflightService as any,
    );
  });

  it('returns counts, sample, and no largeAudienceWarning under 5000', async () => {
    const preview = await service.preview(baseDto(), 'admin-1');
    expect(preview.sendableCount).toBe(1);
    expect(preview.largeAudienceWarning).toBe(false);
    expect(preview.requiresNameConfirmation).toBe(false);
    expect(preview.sample?.renderedBody).toBe('Hi Ann');
    expect(preview.perSchemeCounts[0].recipientCount).toBe(1);
  });

  it('sets largeAudienceWarning at ≥5000', async () => {
    preflightService.run.mockResolvedValue({
      ...preflightService.run.mock.results[0]?.value,
      sendable: Array.from({ length: 5000 }, (_, i) => ({
        channel: 'SMS',
        normalizedAddress: `2547${String(i).padStart(8, '0')}`,
        customerId: `c${i}`,
        policyId: null,
        schemeId: 1,
        customerName: 'X',
        renderedSubject: null,
        renderedBody: 'Hi',
        contentHash: `h${i}`,
        placeholderValues: {},
        softSkip: null,
        blockingError: null,
      })),
      sendableCount: 5000,
      largeAudienceWarning: true,
      sample: null,
      blockingErrors: [],
      softSkips: [],
      characterCount: 2,
      smsSegmentCount: 1,
      bodyForPersist: 'Hi',
      subjectForPersist: null,
    });
    // Fix mock to return proper object
    preflightService.run.mockResolvedValue({
      sendable: [{ schemeId: 1, normalizedAddress: '254700000001' }],
      blockingErrors: [],
      softSkips: [],
      sample: null,
      sendableCount: 5000,
      largeAudienceWarning: true,
      characterCount: 2,
      smsSegmentCount: 1,
      bodyForPersist: 'Hi',
      subjectForPersist: null,
    });
    const preview = await service.preview({ ...baseDto(), body: 'Hi' }, 'admin-1');
    expect(preview.largeAudienceWarning).toBe(true);
    expect(preview.sendableCount).toBe(5000);
  });

  it('422 on empty SMS body', async () => {
    await expect(service.preview({ ...baseDto(), body: '   ' }, 'admin-1')).rejects.toBeInstanceOf(
      ValidationException,
    );
  });

  it('422 when scheme-customer filters missing', async () => {
    await expect(
      service.preview(
        {
          ...baseDto(),
          audience: {
            modes: [AudienceModeDto.SCHEME_CUSTOMERS],
            schemeIds: [1],
          },
        },
        'admin-1',
      ),
    ).rejects.toBeInstanceOf(ValidationException);
  });
});
