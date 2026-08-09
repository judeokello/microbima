import { CampaignAudienceService } from '../campaign-audience.service';
import { PlaceholderRendererService } from '../../rendering/placeholder-renderer.service';
import { ValidationException } from '../../../../exceptions/validation.exception';

describe('CampaignAudienceService', () => {
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
    service = new CampaignAudienceService(prisma as any, new PlaceholderRendererService());
  });

  describe('normalizePhone (FR-021b)', () => {
    it('normalizes to 254… form', () => {
      expect(service.normalizePhone('0722123456')).toBe('254722123456');
      expect(service.normalizePhone('+254722123456')).toBe('254722123456');
    });

    it('returns null for malformed phones (soft-skip)', () => {
      expect(service.normalizePhone('not-a-phone')).toBeNull();
      expect(service.normalizePhone('')).toBeNull();
    });
  });

  describe('normalizeEmail (FR-021b)', () => {
    it('trims and lowercases', () => {
      expect(service.normalizeEmail('  Jane@Example.COM ')).toBe('jane@example.com');
    });

    it('returns null for malformed emails', () => {
      expect(service.normalizeEmail('not-an-email')).toBeNull();
      expect(service.normalizeEmail('')).toBeNull();
    });
  });

  describe('assertSelectableSchemesAndPackages (FR-017a / FR-018a)', () => {
    it('rejects inactive schemes', async () => {
      prisma.scheme.findMany.mockResolvedValue([{ id: 1, isActive: false, schemeName: 'Old' }]);
      prisma.package.findMany.mockResolvedValue([]);
      await expect(service.assertSelectableSchemesAndPackages([1], [])).rejects.toBeInstanceOf(
        ValidationException,
      );
    });

    it('rejects inactive packages', async () => {
      prisma.scheme.findMany.mockResolvedValue([{ id: 1, isActive: true, schemeName: 'S' }]);
      prisma.package.findMany.mockResolvedValue([{ id: 10, isActive: false, name: 'Pkg' }]);
      await expect(service.assertSelectableSchemesAndPackages([1], [10])).rejects.toBeInstanceOf(
        ValidationException,
      );
    });

    it('allows active schemes and packages', async () => {
      prisma.scheme.findMany.mockResolvedValue([{ id: 1, isActive: true, schemeName: 'S' }]);
      prisma.package.findMany.mockResolvedValue([{ id: 10, isActive: true, name: 'Pkg' }]);
      await expect(service.assertSelectableSchemesAndPackages([1], [10])).resolves.toBeUndefined();
    });
  });

  describe('expand + dedupe', () => {
    it('unions multi-scheme customers and expands (customer, policy) before dedupe', async () => {
      prisma.scheme.findMany.mockResolvedValue([
        { id: 1, isActive: true, schemeName: 'A' },
        { id: 2, isActive: true, schemeName: 'B' },
      ]);
      prisma.package.findMany.mockResolvedValue([{ id: 10, isActive: true, name: 'Pkg' }]);
      prisma.packageScheme.findMany.mockResolvedValue([
        { id: 100, schemeId: 1, packageId: 10 },
        { id: 101, schemeId: 2, packageId: 10 },
      ]);
      prisma.packageSchemeCustomer.findMany.mockResolvedValue([
        {
          customerId: 'c1',
          packageSchemeId: 100,
          customer: {
            id: 'c1',
            firstName: 'Ann',
            lastName: 'A',
            email: 'ann@ex.com',
            phoneNumber: '254700000001',
            status: 'ACTIVE',
            isTestUser: false,
          },
        },
        {
          customerId: 'c1',
          packageSchemeId: 101,
          customer: {
            id: 'c1',
            firstName: 'Ann',
            lastName: 'A',
            email: 'ann@ex.com',
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
      ]);

      const result = await service.expand({
        channel: 'SMS',
        modes: ['SCHEME_CUSTOMERS'],
        schemeIds: [1, 2],
        packageIds: [10],
        customerStatuses: ['ACTIVE'],
        policyStatuses: ['ACTIVE'],
        body: 'Hi {first_name} {policy_number}',
        subject: null,
        supportNumbers: { general_support_number: '1', medical_support_number: '2' },
      });

      expect(result.candidates.length).toBeGreaterThanOrEqual(1);
      // Same phone + same resolved content → one after dedupe
      const deduped = service.dedupeByAddressAndContent(result.candidates);
      expect(deduped).toHaveLength(1);
      expect(deduped[0].normalizedAddress).toBe('254700000001');
    });

    it('ignores customer status when expanding scheme customers', async () => {
      prisma.scheme.findMany.mockResolvedValue([{ id: 1, isActive: true, schemeName: 'A' }]);
      prisma.package.findMany.mockResolvedValue([{ id: 10, isActive: true, name: 'Pkg' }]);
      prisma.packageScheme.findMany.mockResolvedValue([{ id: 100, schemeId: 1, packageId: 10 }]);
      prisma.packageSchemeCustomer.findMany.mockResolvedValue([
        {
          customerId: 'cinactive',
          packageSchemeId: 100,
          customer: {
            id: 'cinactive',
            firstName: 'Ina',
            lastName: 'C',
            email: null,
            phoneNumber: '254700000088',
            status: 'INACTIVE',
            isTestUser: false,
          },
        },
      ]);
      prisma.policy.findMany.mockResolvedValue([
        {
          id: 'pi',
          customerId: 'cinactive',
          policyNumber: 'I-1',
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
        body: 'Hi {first_name}',
        subject: null,
        supportNumbers: { general_support_number: '1', medical_support_number: '2' },
      });

      expect(result.candidates.some((c) => c.customerId === 'cinactive')).toBe(true);
    });

    it('expands packages-only audience via policy package match', async () => {
      prisma.scheme.findMany.mockResolvedValue([]);
      prisma.package.findMany.mockResolvedValue([{ id: 10, isActive: true, name: 'Pkg' }]);
      prisma.policy.findMany.mockResolvedValue([
        {
          id: 'p-only',
          customerId: 'c-only',
          policyNumber: 'PO-1',
          status: 'ACTIVE',
          packagePlan: { packageId: 10, package: { id: 10, name: 'Pkg' } },
        },
      ]);
      prisma.customer.findMany.mockResolvedValue([
        {
          id: 'c-only',
          firstName: 'Pat',
          lastName: 'Only',
          email: null,
          phoneNumber: '254700000077',
          status: 'SUSPENDED',
          isTestUser: false,
        },
      ]);

      const result = await service.expand({
        channel: 'SMS',
        modes: ['SCHEME_CUSTOMERS'],
        schemeIds: [],
        packageIds: [10],
        customerStatuses: [],
        policyStatuses: ['ACTIVE'],
        body: 'Hi {first_name}',
        subject: null,
        supportNumbers: { general_support_number: '1', medical_support_number: '2' },
      });

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].customerId).toBe('c-only');
      expect(result.candidates[0].packageId).toBe(10);
      expect(result.candidates[0].schemeId).toBeNull();
    });

    it('includes isTestUser customers (FR-019)', async () => {
      prisma.scheme.findMany.mockResolvedValue([{ id: 1, isActive: true, schemeName: 'A' }]);
      prisma.package.findMany.mockResolvedValue([{ id: 10, isActive: true, name: 'Pkg' }]);
      prisma.packageScheme.findMany.mockResolvedValue([{ id: 100, schemeId: 1, packageId: 10 }]);
      prisma.packageSchemeCustomer.findMany.mockResolvedValue([
        {
          customerId: 'ctest',
          packageSchemeId: 100,
          customer: {
            id: 'ctest',
            firstName: 'Testy',
            lastName: 'T',
            email: null,
            phoneNumber: '254700000099',
            status: 'ACTIVE',
            isTestUser: true,
          },
        },
      ]);
      prisma.policy.findMany.mockResolvedValue([
        {
          id: 'pt',
          customerId: 'ctest',
          policyNumber: 'T-1',
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
        body: 'Hi {first_name}',
        subject: null,
        supportNumbers: { general_support_number: '1', medical_support_number: '2' },
      });

      expect(result.candidates.some((c) => c.customerId === 'ctest')).toBe(true);
    });

    it('emits candidates for both scheme contact phones', async () => {
      prisma.scheme.findMany.mockResolvedValue([{ id: 1, isActive: true, schemeName: 'A' }]);
      prisma.package.findMany.mockResolvedValue([]);
      prisma.schemeContact.findMany.mockResolvedValue([
        {
          id: 9,
          schemeId: 1,
          firstName: 'Bob',
          otherName: null,
          phoneNumber: '0722000001',
          phoneNumber2: '0722000002',
          email: 'bob@ex.com',
        },
      ]);
      prisma.customer.findFirst.mockResolvedValue(null);

      const result = await service.expand({
        channel: 'SMS',
        modes: ['SCHEME_CONTACTS'],
        schemeIds: [1],
        packageIds: [],
        customerStatuses: [],
        policyStatuses: [],
        body: 'Hello',
        subject: null,
        supportNumbers: { general_support_number: '1', medical_support_number: '2' },
      });

      const phones = result.candidates.map((c) => c.normalizedAddress).sort();
      expect(phones).toEqual(['254722000001', '254722000002']);
    });

    it('resolves pasted phones and keeps unmatched as sendable', async () => {
      prisma.scheme.findMany.mockResolvedValue([]);
      prisma.package.findMany.mockResolvedValue([]);
      prisma.customer.findFirst
        .mockResolvedValueOnce({
          id: 'c9',
          firstName: 'Pat',
          lastName: 'E',
          email: null,
          phoneNumber: '254733333333',
          status: 'ACTIVE',
          isTestUser: false,
        })
        .mockResolvedValueOnce(null);

      const result = await service.expand({
        channel: 'SMS',
        modes: ['PASTE_LIST'],
        schemeIds: [],
        packageIds: [],
        customerStatuses: [],
        policyStatuses: [],
        pasteList: ['0733333333', '0700111222'],
        body: 'Ping',
        subject: null,
        supportNumbers: { general_support_number: '1', medical_support_number: '2' },
      });

      expect(result.candidates).toHaveLength(2);
      expect(result.candidates.find((c) => c.normalizedAddress === '254733333333')?.customerId).toBe(
        'c9',
      );
      expect(
        result.candidates.find((c) => c.normalizedAddress === '254700111222')?.customerId,
      ).toBeNull();
    });

    it('content-hash dedupe keeps distinct resolved bodies for same phone', () => {
      const a = {
        channel: 'SMS' as const,
        normalizedAddress: '254700000001',
        customerId: 'c1',
        policyId: 'p1',
        schemeId: 1,
        contributingSchemeIds: [1],
        packageId: null,
        contributingPackageIds: [],
        customerName: 'Ann',
        renderedSubject: null as string | null,
        renderedBody: 'Hi Ann POL-1',
        contentHash: 'hash-a',
        placeholderValues: {},
        softSkip: null as string | null,
        blockingError: null as string | null,
      };
      const b = { ...a, policyId: 'p2', renderedBody: 'Hi Ann POL-2', contentHash: 'hash-b' };
      const same = { ...a, policyId: 'p3' }; // same contentHash → drop
      expect(service.dedupeByAddressAndContent([a, b, same])).toHaveLength(2);
    });
  });
});
