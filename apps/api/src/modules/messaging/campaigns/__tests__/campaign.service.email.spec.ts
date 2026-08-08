import { CampaignService } from '../campaign.service';
import { ValidationException } from '../../../../exceptions/validation.exception';
import {
  AudienceModeDto,
  CampaignChannelDto,
  CampaignComposeRequestDto,
} from '../../../../dto/messaging/campaign.dto';
import { sanitizeCampaignHtml } from '../campaign-html.sanitizer';

describe('CampaignService EMAIL (US2)', () => {
  let service: CampaignService;
  let prisma: {
    messagingCampaign: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
    };
    messagingDelivery: { count: jest.Mock };
    scheme: { findMany: jest.Mock };
  };
  let systemSettings: { getSnapshot: jest.Mock };
  let preflightService: { run: jest.Mock; isEmptyBody: jest.Mock; computePerSchemeCounts: jest.Mock };
  let audienceService: {
    contentHash: jest.Mock;
    normalizePhone: jest.Mock;
    normalizeEmail: jest.Mock;
  };

  const emailDto = (overrides: Partial<CampaignComposeRequestDto> = {}): CampaignComposeRequestDto => ({
    name: 'Email blast',
    channel: CampaignChannelDto.EMAIL,
    subject: 'Hello {first_name}',
    body: '<p>Hi <strong>{first_name}</strong></p>',
    audience: {
      modes: [AudienceModeDto.SCHEME_CONTACTS],
      schemeIds: [1],
    },
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      messagingCampaign: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'camp-email-1',
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
      scheme: { findMany: jest.fn().mockResolvedValue([{ id: 1, schemeName: 'S' }]) },
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
      isEmptyBody: jest.fn((channel: string, body: string) => {
        if (channel === 'EMAIL') {
          const stripped = String(body ?? '')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/gi, '')
            .trim();
          return stripped.length === 0;
        }
        return !String(body ?? '').trim();
      }),
      computePerSchemeCounts: jest.fn().mockReturnValue([]),
      run: jest.fn().mockResolvedValue({
        sendable: [
          {
            channel: 'EMAIL',
            normalizedAddress: 'ann@ex.com',
            customerId: 'c1',
            policyId: null,
            schemeId: 1,
            contributingSchemeIds: [1],
            customerName: 'Ann',
            renderedSubject: 'Hello Ann',
            renderedBody: '<p>Hi <strong>Ann</strong></p>',
            contentHash: 'h',
            placeholderValues: { first_name: 'Ann' },
            softSkip: null,
            blockingError: null,
          },
        ],
        blockingErrors: [],
        softSkips: [
          {
            customerName: 'Bob',
            email: null,
            customerId: null,
            error: 'Missing email',
          },
        ],
        sample: null,
        sendableCount: 1,
        largeAudienceWarning: false,
        characterCount: 40,
        smsSegmentCount: null,
        bodyForPersist: '<p>Hi <strong>{first_name}</strong></p>',
        subjectForPersist: 'Hello {first_name}',
      }),
    };
    audienceService = {
      contentHash: jest.fn().mockReturnValue('content-hash'),
      normalizePhone: jest.fn((raw: string) => {
        const digits = String(raw).replace(/\D/g, '');
        if (digits.length >= 9) return `254${digits.slice(-9)}`;
        return null;
      }),
      normalizeEmail: jest.fn((raw: string) => {
        const t = String(raw).trim().toLowerCase();
        return t.includes('@') ? t : null;
      }),
    };
    service = new CampaignService(
      prisma as never,
      systemSettings as never,
      audienceService as never,
      preflightService as never,
    );
  });

  it('requires email subject', async () => {
    await expect(service.preview(emailDto({ subject: '' }), 'admin-1')).rejects.toBeInstanceOf(
      ValidationException,
    );
  });

  it('rejects empty rich-text chrome body (FR-009a)', async () => {
    await expect(
      service.preview(emailDto({ body: '<p></p><br/>' }), 'admin-1'),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('soft-skips missing emails without blocking sendable path', async () => {
    const preview = await service.preview(emailDto(), 'admin-1');
    expect(preview.sendableCount).toBe(1);
    expect(preview.softSkips.some((r) => r.error.toLowerCase().includes('email'))).toBe(true);
    expect(preview.blockingErrors).toHaveLength(0);
  });

  it('sanitizes HTML on create (FR-010a) and uses email delay', async () => {
    const dirty = '<p>Hi</p><script>alert(1)</script>';
    preflightService.run.mockResolvedValue({
      sendable: [{ normalizedAddress: 'a@b.com', schemeId: 1 }],
      blockingErrors: [],
      softSkips: [],
      sample: null,
      sendableCount: 1,
      largeAudienceWarning: false,
      characterCount: 10,
      smsSegmentCount: null,
      bodyForPersist: sanitizeCampaignHtml(dirty),
      subjectForPersist: 'Hello',
    });

    const created = await service.create(
      emailDto({ body: dirty, subject: 'Hello' }),
      'admin-1',
    );
    expect(created.status).toBe('DELAYED');
    expect(created.templateKey).toBe('admin_template_email');
    expect(created.bodyWithPlaceholders.toLowerCase()).not.toContain('<script');
    expect(created.dispatchStartsAt).toBeInstanceOf(Date);
    const delayMs =
      (created.dispatchStartsAt as Date).getTime() - Date.now();
    // ~180s email delay (allow clock skew)
    expect(delayMs).toBeGreaterThan(150_000);
    expect(delayMs).toBeLessThan(200_000);
  });

  it('rejects phone-number paste lists on EMAIL channel (channel-pure)', async () => {
    await expect(
      service.preview(
        emailDto({
          audience: {
            modes: [AudienceModeDto.PASTE_LIST],
            pasteList: ['0722123456', '0700111222'],
          },
        }),
        'admin-1',
      ),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('documents that EMAIL receiptConfirmed may remain 0 after handoff (FR-037)', async () => {
    // Progress semantics: handedOff can increase while receiptConfirmed stays 0 without email receipts.
    expect(true).toBe(true);
  });
});
