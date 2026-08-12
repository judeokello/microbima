/// <reference types="jest" />
import { PaymentFrequency, PackagePricingCategoryKind } from '@prisma/client';
import { ProductManagementService } from '../product-management.service';
import { PackagePricingService } from '../package-pricing/package-pricing.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentAccountNumberService } from '../payment-account-number.service';
import { SupabaseService } from '../supabase.service';
import { ValidationException } from '../../exceptions/validation.exception';
import { PackagePricingCategoryKindDto } from '../../dto/packages/package-pricing.dto';

jest.mock('../package-pricing/package-pricing.service', () => {
  const actual = jest.requireActual('../package-pricing/package-pricing.service');
  return {
    ...actual,
    loadPricingCompletenessInput: jest.fn(),
  };
});

const { loadPricingCompletenessInput } = jest.requireMock(
  '../package-pricing/package-pricing.service'
);

describe('ProductManagementService - package pricing activate gate', () => {
  const prismaMock = {
    package: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    packagePlan: {
      count: jest.fn(),
    },
    packagePaymentFrequency: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const service = new ProductManagementService(
    prismaMock as unknown as PrismaService,
    {} as PaymentAccountNumberService,
    {} as SupabaseService
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updatePackage activation', () => {
    it('rejects activate when pricing incomplete', async () => {
      prismaMock.package.findUnique.mockResolvedValue({
        id: 10,
        isActive: false,
      });
      prismaMock.packagePlan.count.mockResolvedValue(1);
      loadPricingCompletenessInput.mockResolvedValue({
        plans: [{ id: 1, name: 'Silver', isActive: true }],
        categories: [{ key: 'member_only', kind: 'MEMBER_ONLY', maxMembers: null }],
        enabledFrequencies: [PaymentFrequency.DAILY],
        rates: [],
      });

      await expect(
        service.updatePackage(10, { isActive: true }, 'corr-1')
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('allows activate when pricing complete', async () => {
      const updatedPkg = {
        id: 10,
        name: 'Boda',
        slug: 'mfanisi-boda',
        description: 'desc',
        underwriterId: 1,
        underwriter: { id: 1, name: 'UW' },
        isActive: true,
        logoPath: null,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        packagePaymentFrequencies: [{ frequency: PaymentFrequency.DAILY, installmentCount: 313 }],
      };

      prismaMock.package.findUnique.mockResolvedValue({
        id: 10,
        isActive: false,
      });
      prismaMock.packagePlan.count.mockResolvedValue(1);
      loadPricingCompletenessInput.mockResolvedValue({
        plans: [{ id: 1, name: 'Silver', isActive: true }],
        categories: [{ key: 'member_only', kind: 'MEMBER_ONLY', maxMembers: null }],
        enabledFrequencies: [PaymentFrequency.DAILY],
        rates: [
          {
            packagePlanId: 1,
            categoryKey: 'member_only',
            frequency: PaymentFrequency.DAILY,
            amount: 56,
          },
          {
            packagePlanId: 1,
            categoryKey: 'member_only',
            frequency: PaymentFrequency.ANNUALLY,
            amount: 17645,
          },
        ],
      });

      prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          package: {
            update: jest.fn().mockResolvedValue(updatedPkg),
          },
        };
        return fn(tx);
      });

      const result = await service.updatePackage(10, { isActive: true }, 'corr-1');
      expect(result.isActive).toBe(true);
    });
  });

  describe('putPricing leaves isActive unchanged (via PackagePricingService)', () => {
    it('complete save does not auto-activate', async () => {
      const pricingPrisma = {
        package: {
          findUnique: jest
            .fn()
            .mockResolvedValueOnce({ id: 10 })
            .mockResolvedValue({
              id: 10,
              slug: 'test',
              isActive: false,
              packagePaymentFrequencies: [{ frequency: PaymentFrequency.DAILY }],
              packagePricingCategories: [
                {
                  id: 1,
                  key: 'member_only',
                  displayName: 'M',
                  kind: PackagePricingCategoryKind.MEMBER_ONLY,
                  maxMembers: null,
                  sortOrder: 0,
                },
              ],
              packagePlans: [
                {
                  id: 1,
                  name: 'Silver',
                  isActive: true,
                  sortOrder: 0,
                  rates: [
                    {
                      frequency: PaymentFrequency.DAILY,
                      amount: 56,
                      packagePricingCategory: { key: 'member_only' },
                    },
                    {
                      frequency: PaymentFrequency.ANNUALLY,
                      amount: 17645,
                      packagePricingCategory: { key: 'member_only' },
                    },
                  ],
                },
              ],
            }),
        },
        packagePlan: {
          findMany: jest.fn().mockResolvedValue([{ id: 1, name: 'Silver' }]),
        },
        $transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            packagePricingCategory: {
              findMany: jest.fn().mockResolvedValue([]),
              upsert: jest.fn().mockResolvedValue({ id: 1, key: 'member_only' }),
            },
            packagePlanRate: { upsert: jest.fn() },
          };
          return fn(tx);
        }),
      };

      const svc = new PackagePricingService(pricingPrisma as unknown as PrismaService);
      const result = await svc.putPricing(
        10,
        {
          categories: [
            { key: 'member_only', display: 'M', kind: PackagePricingCategoryKindDto.MEMBER_ONLY },
          ],
          plans: {
            silver: {
              planId: 1,
              rates: {
                member_only: {
                  daily: 56,
                  annually: 17645,
                },
              },
            },
          },
        },
        'user-1'
      );

      expect(result.isPricingComplete).toBe(true);
      expect(result.isActive).toBe(false);
    });
  });
});
