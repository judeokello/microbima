/// <reference types="jest" />
import { PaymentFrequency } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { ProductManagementService } from '../product-management.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentAccountNumberService } from '../payment-account-number.service';
import { SupabaseService } from '../supabase.service';
import { ValidationException } from '../../exceptions/validation.exception';

describe('ProductManagementService - package slug & payment frequencies', () => {
  const prismaMock = {
    package: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    scheme: {
      findFirst: jest.fn(),
    },
    packagePaymentFrequency: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findUnique: jest.fn(),
    },
    policyNumberSequence: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const paymentAccountNumberServiceMock = {
    generateForScheme: jest.fn(),
  };

  const supabaseServiceMock = {
    getUserDisplayName: jest.fn(),
  };

  const service = new ProductManagementService(
    prismaMock as unknown as PrismaService,
    paymentAccountNumberServiceMock as unknown as PaymentAccountNumberService,
    supabaseServiceMock as unknown as SupabaseService
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPackage validation', () => {
    it('rejects missing payment frequencies', async () => {
      await expect(
        service.createPackage(
          {
            name: 'MfanisiBoda',
            slug: 'mfanisi-boda',
            description: 'Boda product',
            paymentFrequencies: [],
          },
          'user-1',
          'corr-1'
        )
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('rejects CUSTOM frequency on package create', async () => {
      await expect(
        service.createPackage(
          {
            name: 'MfanisiBoda',
            slug: 'mfanisi-boda',
            description: 'Boda product',
            paymentFrequencies: [
              { frequency: PaymentFrequency.CUSTOM, installmentCount: 10 },
            ],
          },
          'user-1',
          'corr-1'
        )
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('rejects invalid slug format', async () => {
      await expect(
        service.createPackage(
          {
            name: 'MfanisiBoda',
            slug: 'Mfanisi_Boda',
            description: 'Boda product',
            paymentFrequencies: [
              { frequency: PaymentFrequency.DAILY, installmentCount: 313 },
            ],
          },
          'user-1',
          'corr-1'
        )
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('rejects out-of-range weekly installment count', async () => {
      await expect(
        service.createPackage(
          {
            name: 'MfanisiBoda',
            slug: 'mfanisi-boda',
            description: 'Boda product',
            paymentFrequencies: [
              { frequency: PaymentFrequency.WEEKLY, installmentCount: 53 },
            ],
          },
          'user-1',
          'corr-1'
        )
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('rejects duplicate slug', async () => {
      prismaMock.package.findFirst
        .mockResolvedValueOnce(null) // name check
        .mockResolvedValueOnce({ id: 99 }); // slug conflict

      await expect(
        service.createPackage(
          {
            name: 'MfanisiBoda',
            slug: 'mfanisi-boda',
            description: 'Boda product',
            paymentFrequencies: [
              { frequency: PaymentFrequency.DAILY, installmentCount: 313 },
            ],
          },
          'user-1',
          'corr-1'
        )
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('maps primary-key unique conflicts to package field (not name)', async () => {
      prismaMock.package.findFirst.mockResolvedValue(null);
      const pkConflict = new PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`id`)',
        { code: 'P2002', clientVersion: '6.19.0', meta: { target: ['id'] } }
      );
      prismaMock.$transaction.mockRejectedValue(pkConflict);

      await expect(
        service.createPackage(
          {
            name: 'MfanisiBoda',
            slug: 'mfanisi-boda',
            description: 'Boda product',
            underwriterId: 1,
            paymentFrequencies: [
              { frequency: PaymentFrequency.DAILY, installmentCount: 313 },
            ],
          },
          'user-1',
          'corr-1'
        )
      ).rejects.toMatchObject({
        errorDetails: {
          package: 'A package with this id already exists',
        },
      });
    });

    it('creates package with slug and frequency rows', async () => {
      prismaMock.package.findFirst.mockResolvedValue(null);

      const createdPkg = {
        id: 10,
        name: 'MfanisiBoda',
        slug: 'mfanisi-boda',
        description: 'Boda product',
        underwriterId: 1,
        underwriter: { id: 1, name: 'UW' },
        isActive: false,
        logoPath: null,
        createdBy: 'user-1',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        packagePaymentFrequencies: [
          { frequency: PaymentFrequency.DAILY, installmentCount: 313 },
          { frequency: PaymentFrequency.WEEKLY, installmentCount: 52 },
        ],
      };

      prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          package: {
            create: jest.fn().mockResolvedValue(createdPkg),
            findUniqueOrThrow: jest.fn().mockResolvedValue(createdPkg),
          },
          packagePaymentFrequency: {
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
            createMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
          packagePricingCategory: {
            create: jest.fn().mockResolvedValue({ id: 1, key: 'member_only' }),
          },
          policyNumberSequence: {
            create: jest.fn().mockResolvedValue({ packageId: 10, lastSequence: 0 }),
          },
        };
        return fn(tx);
      });

      const result = await service.createPackage(
        {
          name: 'MfanisiBoda',
          slug: 'MFANISI-BODA',
          description: 'Boda product',
          underwriterId: 1,
          paymentFrequencies: [
            { frequency: PaymentFrequency.DAILY, installmentCount: 313 },
            { frequency: PaymentFrequency.WEEKLY, installmentCount: 52 },
          ],
        },
        'user-1',
        'corr-1'
      );

      expect(result.slug).toBe('mfanisi-boda');
      expect(result.paymentFrequencies).toEqual([
        { frequency: PaymentFrequency.DAILY, installmentCount: 313 },
        { frequency: PaymentFrequency.WEEKLY, installmentCount: 52 },
      ]);
    });
  });

  describe('updatePackage validation', () => {
    it('rejects CUSTOM frequency on package update', async () => {
      prismaMock.package.findUnique.mockResolvedValue({
        id: 10,
        name: 'MfanisiBoda',
        slug: 'mfanisi-boda',
        isActive: false,
      });

      await expect(
        service.updatePackage(
          10,
          {
            paymentFrequencies: [
              { frequency: PaymentFrequency.CUSTOM, installmentCount: 10 },
            ],
          },
          'corr-1'
        )
      ).rejects.toBeInstanceOf(ValidationException);
    });
  });

  describe('createScheme postpaid frequency vs package', () => {
    it('rejects postpaid frequency not supported by package', async () => {
      prismaMock.scheme.findFirst.mockResolvedValue(null);
      prismaMock.packagePaymentFrequency.findUnique.mockResolvedValue(null);

      await expect(
        service.createScheme(
          {
            schemeName: 'Boda Drivers',
            description: 'Postpaid scheme',
            isPostpaid: true,
            frequency: PaymentFrequency.QUARTERLY,
            packageId: 10,
            generalSchemeWaitingPeriod: 0,
          },
          'user-1',
          'corr-1'
        )
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('rejects CUSTOM for postpaid schemes', async () => {
      prismaMock.scheme.findFirst.mockResolvedValue(null);

      await expect(
        service.createScheme(
          {
            schemeName: 'Boda Drivers',
            description: 'Postpaid scheme',
            isPostpaid: true,
            frequency: PaymentFrequency.CUSTOM,
            paymentCadence: 10,
            packageId: 10,
            generalSchemeWaitingPeriod: 0,
          },
          'user-1',
          'corr-1'
        )
      ).rejects.toBeInstanceOf(ValidationException);
    });
  });
});
