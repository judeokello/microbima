import { CampaignPreflightService } from '../campaign-preflight.service';
import { CampaignAudienceService } from '../campaign-audience.service';
import { stripHtmlToPlainText } from '../campaign-html.sanitizer';

describe('CampaignPreflightService', () => {
  let preflight: CampaignPreflightService;
  let audience: jest.Mocked<Pick<CampaignAudienceService, 'expand' | 'dedupeByAddressAndContent'>>;

  beforeEach(() => {
    audience = {
      expand: jest.fn(),
      dedupeByAddressAndContent: jest.fn((c) => c),
    };
    preflight = new CampaignPreflightService(audience as unknown as CampaignAudienceService);
  });

  it('classifies missing placeholders as blocking and missing address as soft-skip', async () => {
    audience.expand.mockResolvedValue({
      candidates: [
        {
          channel: 'SMS',
          normalizedAddress: '254700000001',
          customerId: 'c1',
          policyId: null,
          schemeId: 1,
          contributingSchemeIds: [1],
          customerName: 'Ann',
          renderedSubject: null,
          renderedBody: '',
          contentHash: '',
          placeholderValues: { first_name: 'Ann' },
          softSkip: null,
          blockingError: 'Missing placeholder: policy_number',
        },
        {
          channel: 'SMS',
          normalizedAddress: null,
          customerId: 'c2',
          policyId: 'p2',
          schemeId: 1,
          contributingSchemeIds: [1],
          customerName: 'Bob',
          renderedSubject: null,
          renderedBody: '',
          contentHash: '',
          placeholderValues: { first_name: 'Bob', policy_number: 'P2' },
          softSkip: 'Missing phone',
          blockingError: null,
        },
        {
          channel: 'SMS',
          normalizedAddress: '254700000003',
          customerId: 'c3',
          policyId: 'p3',
          schemeId: 1,
          contributingSchemeIds: [1],
          customerName: 'Cara',
          renderedSubject: null,
          renderedBody: 'Hi Cara P3',
          contentHash: 'h3',
          placeholderValues: { first_name: 'Cara', policy_number: 'P3' },
          softSkip: null,
          blockingError: null,
        },
      ],
      softSkipsFromExpand: [],
    });

    const result = await preflight.run({
      channel: 'SMS',
      modes: ['SCHEME_CUSTOMERS'],
      schemeIds: [1],
      packageIds: [10],
      customerStatuses: ['ACTIVE'],
      policyStatuses: ['ACTIVE'],
      body: 'Hi {first_name} {policy_number}',
      subject: null,
      supportNumbers: { general_support_number: '1', medical_support_number: '2' },
    });

    expect(result.blockingErrors.length).toBeGreaterThanOrEqual(1);
    expect(result.softSkips.some((r) => r.error.toLowerCase().includes('phone'))).toBe(true);
    expect(result.sendable).toHaveLength(1);
    expect(result.sendable[0].customerId).toBe('c3');
  });

  it('selects sample by customerId, policyId, normalizedAddress with nulls last (FR-029)', () => {
    const sample = preflight.selectSample([
      {
        channel: 'SMS',
        normalizedAddress: '254700000002',
        customerId: 'c2',
        policyId: 'p2',
        schemeId: 1,
        contributingSchemeIds: [1],
        customerName: 'B',
        renderedSubject: null,
        renderedBody: 'b',
        contentHash: 'hb',
        placeholderValues: {},
        softSkip: null,
        blockingError: null,
      },
      {
        channel: 'SMS',
        normalizedAddress: '254700000001',
        customerId: null,
        policyId: null,
        schemeId: null,
        contributingSchemeIds: [],
        customerName: null,
        renderedSubject: null,
        renderedBody: 'a',
        contentHash: 'ha',
        placeholderValues: {},
        softSkip: null,
        blockingError: null,
      },
      {
        channel: 'SMS',
        normalizedAddress: '254700000000',
        customerId: 'c1',
        policyId: 'p1',
        schemeId: 1,
        contributingSchemeIds: [1],
        customerName: 'A',
        renderedSubject: null,
        renderedBody: 'first',
        contentHash: 'hf',
        placeholderValues: {},
        softSkip: null,
        blockingError: null,
      },
    ]);

    expect(sample?.customerId).toBe('c1');
    expect(sample?.renderedBody).toBe('first');
  });

  it('treats empty HTML body as empty when stripped plain-text length is 0 (FR-009a)', () => {
    expect(preflight.isEmptyBody('EMAIL', '<p></p><br/>')).toBe(true);
    expect(preflight.isEmptyBody('EMAIL', '<p>Hi</p>')).toBe(false);
    expect(preflight.isEmptyBody('SMS', '   ')).toBe(true);
    expect(stripHtmlToPlainText('<p>&nbsp;</p>').trim().length).toBe(0);
  });

  it('per-scheme counts use contributingSchemeIds after combinable-mode dedupe (T070)', () => {
    const sendable = [
      {
        channel: 'SMS' as const,
        normalizedAddress: '254700000001',
        customerId: 'c1',
        policyId: 'p1',
        schemeId: 1,
        contributingSchemeIds: [1, 2],
        customerName: 'Ann',
        renderedSubject: null,
        renderedBody: 'Hi',
        contentHash: 'h',
        placeholderValues: {},
        softSkip: null,
        blockingError: null,
      },
      {
        channel: 'SMS' as const,
        normalizedAddress: '254700000099',
        customerId: null,
        policyId: null,
        schemeId: null,
        contributingSchemeIds: [],
        customerName: null,
        renderedSubject: null,
        renderedBody: 'Paste only',
        contentHash: 'hp',
        placeholderValues: {},
        softSkip: null,
        blockingError: null,
      },
    ];

    const counts = preflight.computePerSchemeCounts(
      [
        { id: 1, schemeName: 'Scheme A' },
        { id: 2, schemeName: 'Scheme B' },
      ],
      sendable,
    );

    expect(counts).toEqual([
      { schemeId: 1, schemeName: 'Scheme A', recipientCount: 1 },
      { schemeId: 2, schemeName: 'Scheme B', recipientCount: 1 },
    ]);
    // Paste-only recipient does not inflate scheme pills
    expect(counts.reduce((n, c) => n + c.recipientCount, 0)).toBe(2);
  });
});
