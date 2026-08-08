import { CampaignAudienceService } from '../campaign-audience.service';
import { PlaceholderRendererService } from '../../rendering/placeholder-renderer.service';
import { CampaignCandidate } from '../campaign.types';

function cand(partial: Partial<CampaignCandidate> & Pick<CampaignCandidate, 'normalizedAddress' | 'contentHash' | 'renderedBody'>): CampaignCandidate {
  return {
    channel: 'SMS',
    customerId: null,
    policyId: null,
    schemeId: null,
    contributingSchemeIds: [],
    customerName: null,
    renderedSubject: null,
    placeholderValues: {},
    softSkip: null,
    blockingError: null,
    ...partial,
  };
}

describe('CampaignAudienceService dedupe fixtures (US7 / SC-005 / SC-006)', () => {
  let service: CampaignAudienceService;
  let prisma: {
    scheme: { findMany: jest.Mock };
    package: { findMany: jest.Mock };
    packageScheme: { findMany: jest.Mock };
    packageSchemeCustomer: { findMany: jest.Mock };
    schemeContact: { findMany: jest.Mock };
    customer: { findMany: jest.Mock; findFirst: jest.Mock };
    policy: { findMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      scheme: { findMany: jest.fn() },
      package: { findMany: jest.fn() },
      packageScheme: { findMany: jest.fn() },
      packageSchemeCustomer: { findMany: jest.fn() },
      schemeContact: { findMany: jest.fn() },
      customer: { findMany: jest.fn(), findFirst: jest.fn() },
      policy: { findMany: jest.fn() },
    };
    service = new CampaignAudienceService(prisma as never, new PlaceholderRendererService());
  });

  it('SC-005: identical multi-scheme body → one send; unions contributingSchemeIds', async () => {
    prisma.scheme.findMany.mockResolvedValue([
      { id: 1, isActive: true, schemeName: 'A' },
      { id: 2, isActive: true, schemeName: 'B' },
    ]);
    prisma.package.findMany.mockResolvedValue([{ id: 10, isActive: true, name: 'Pkg' }]);
    prisma.packageScheme.findMany.mockResolvedValue([
      { id: 100, schemeId: 1, packageId: 10 },
      { id: 101, schemeId: 2, packageId: 10 },
    ]);
    const customer = {
      id: 'c1',
      firstName: 'Ann',
      lastName: 'A',
      email: null,
      phoneNumber: '254700000001',
      status: 'ACTIVE',
      isTestUser: false,
    };
    prisma.packageSchemeCustomer.findMany.mockResolvedValue([
      { customerId: 'c1', packageSchemeId: 100, customer },
      { customerId: 'c1', packageSchemeId: 101, customer },
    ]);
    prisma.policy.findMany.mockResolvedValue([
      {
        id: 'p1',
        customerId: 'c1',
        policyNumber: 'POL-1',
        status: 'ACTIVE',
        packagePlan: { packageId: 10, package: { id: 10, name: 'Pkg' } },
      },
    ]);

    const result = await service.expand({
      channel: 'SMS',
      modes: ['SCHEME_CUSTOMERS'],
      schemeIds: [1, 2],
      packageIds: [10],
      customerStatuses: ['ACTIVE'],
      policyStatuses: ['ACTIVE'],
      body: 'Hi {first_name}',
      subject: null,
      supportNumbers: { general_support_number: '1', medical_support_number: '2' },
    });

    const deduped = service.dedupeByAddressAndContent(result.candidates);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].normalizedAddress).toBe('254700000001');
    expect(deduped[0].contributingSchemeIds.sort()).toEqual([1, 2]);
  });

  it('SC-006: differing policy placeholders → two sends for same phone', async () => {
    prisma.scheme.findMany.mockResolvedValue([{ id: 1, isActive: true, schemeName: 'A' }]);
    prisma.package.findMany.mockResolvedValue([{ id: 10, isActive: true, name: 'Pkg' }]);
    prisma.packageScheme.findMany.mockResolvedValue([{ id: 100, schemeId: 1, packageId: 10 }]);
    prisma.packageSchemeCustomer.findMany.mockResolvedValue([
      {
        customerId: 'c1',
        packageSchemeId: 100,
        customer: {
          id: 'c1',
          firstName: 'Ann',
          lastName: 'A',
          email: null,
          phoneNumber: '254700000001',
          status: 'ACTIVE',
          isTestUser: false,
        },
      },
    ]);
    prisma.policy.findMany.mockResolvedValue([
      {
        id: 'p1',
        customerId: 'c1',
        policyNumber: 'POL-1',
        status: 'ACTIVE',
        packagePlan: { packageId: 10, package: { id: 10, name: 'Pkg' } },
      },
      {
        id: 'p2',
        customerId: 'c1',
        policyNumber: 'POL-2',
        status: 'ACTIVE',
        packagePlan: { packageId: 10, package: { id: 10, name: 'Pkg' } },
      },
    ]);

    const result = await service.expand({
      channel: 'SMS',
      modes: ['SCHEME_CUSTOMERS'],
      schemeIds: [1],
      packageIds: [10],
      customerStatuses: ['ACTIVE'],
      policyStatuses: ['ACTIVE'],
      body: 'Policy {policy_number}',
      subject: null,
      supportNumbers: { general_support_number: '1', medical_support_number: '2' },
    });

    const deduped = service.dedupeByAddressAndContent(result.candidates);
    expect(deduped).toHaveLength(2);
    expect(deduped.map((c) => c.renderedBody).sort()).toEqual(['Policy POL-1', 'Policy POL-2']);
  });

  it('overlapping scheme-contact + scheme-customer identical content → one send', () => {
    const fromCustomer = cand({
      normalizedAddress: '254700000001',
      contentHash: 'same',
      renderedBody: 'Hello',
      customerId: 'c1',
      schemeId: 1,
      contributingSchemeIds: [1],
    });
    const fromContact = cand({
      normalizedAddress: '254700000001',
      contentHash: 'same',
      renderedBody: 'Hello',
      customerId: null,
      schemeId: 1,
      contributingSchemeIds: [1],
      customerName: 'Scheme Contact',
    });
    const deduped = service.dedupeByAddressAndContent([fromCustomer, fromContact]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].customerId).toBe('c1');
    expect(deduped[0].contributingSchemeIds).toEqual([1]);
  });
});
