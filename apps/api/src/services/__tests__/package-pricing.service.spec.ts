/// <reference types="jest" />
import { NotFoundException } from '@nestjs/common';
import {
  PackagePricingCategoryKind,
  PaymentFrequency,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PackagePricingService } from '../package-pricing/package-pricing.service';
import { ValidationException } from '../../exceptions/validation.exception';
import { PackagePricingCategoryKindDto } from '../../dto/packages/package-pricing.dto';

describe('PackagePricingService', () => {
  const prismaMock = {
    package: {
      findUnique: jest.fn(),
    },
    packagePlan: {
      findMany: jest.fn(),
    },
    packagePricingCategory: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
    },
    packagePlanRate: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const service = new PackagePricingService(prismaMock as unknown as PrismaService);

  const basePackage = {
    id: 10,
    slug: 'mfanisi-boda',
    isActive: false,
    maximumFamilySize: 8,
    packagePaymentFrequencies: [
      { frequency: PaymentFrequency.DAILY, installmentCount: 276 },
      { frequency: PaymentFrequency.WEEKLY, installmentCount: 39 },
      { frequency: PaymentFrequency.MONTHLY, installmentCount: 9 },
    ],
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
        id: 100,
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
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPricing', () => {
    it('maps drop-in shape without pricingMode', async () => {
      prismaMock.package.findUnique.mockResolvedValue(basePackage);

      const result = await service.getPricing(10);

      expect(result.packageId).toBe(10);
      expect(result.packageSlug).toBe('mfanisi-boda');
      expect(result).not.toHaveProperty('pricingMode');
      expect(result.plans.silver.rates.member_only).toEqual({
        daily: 56,
        annually: 17645,
      });
      expect(result.plans.silver.rates.member_only).not.toHaveProperty('DAILY');
      expect(result.enabledFrequencies).toEqual([
        PaymentFrequency.DAILY,
        PaymentFrequency.WEEKLY,
        PaymentFrequency.MONTHLY,
      ]);
      expect(result.installmentCounts).toEqual({
        DAILY: 276,
        WEEKLY: 39,
        MONTHLY: 9,
        ANNUALLY: 1,
      });
    });

    it('throws NotFoundException when package missing', async () => {
      prismaMock.package.findUnique.mockResolvedValue(null);
      await expect(service.getPricing(999)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('putPricing', () => {
    beforeEach(() => {
      prismaMock.package.findUnique
        .mockResolvedValueOnce({ id: 10 })
        .mockResolvedValue(basePackage);
      prismaMock.packagePlan.findMany.mockResolvedValue([
        { id: 100, name: 'Silver' },
      ]);
      prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          packagePricingCategory: {
            findMany: jest.fn().mockResolvedValue([]),
            upsert: jest.fn().mockResolvedValue({ id: 1, key: 'member_only' }),
            delete: jest.fn(),
          },
          packagePlanRate: {
            upsert: jest.fn(),
          },
        };
        return fn(tx);
      });
    });

    it('does not change isActive on save (FR-015)', async () => {
      const inactivePkg = { ...basePackage, isActive: false };
      prismaMock.package.findUnique.mockReset();
      prismaMock.package.findUnique
        .mockResolvedValueOnce({ id: 10 })
        .mockResolvedValue(inactivePkg);

      const result = await service.putPricing(
        10,
        {
          categories: [
            {
              key: 'member_only',
              display: 'M',
              kind: PackagePricingCategoryKindDto.MEMBER_ONLY,
              sortOrder: 0,
            },
          ],
          plans: {
            silver: {
              planId: 100,
              rates: {
                member_only: {
                  daily: 56,
                  weekly: 392,
                  monthly: 1765,
                  quarterly: 5295,
                  annually: 17645,
                },
              },
            },
          },
        },
        'user-1'
      );

      expect(result.isActive).toBe(false);
      expect(result.isPricingComplete).toBe(false);
    });

    it('rejects CUSTOM frequency on rate bands', async () => {
      prismaMock.package.findUnique.mockReset();
      prismaMock.package.findUnique.mockResolvedValue({ id: 10 });

      await expect(
        service.putPricing(
          10,
          {
            categories: [
              {
                key: 'member_only',
                display: 'M',
                kind: PackagePricingCategoryKindDto.MEMBER_ONLY,
              },
            ],
            plans: {
              silver: {
                planId: 100,
                rates: {
                  member_only: {
                    daily: 56,
                    custom: 99,
                  } as unknown as { daily: number; custom: number },
                },
              },
            },
          },
          'user-1'
        )
      ).rejects.toBeInstanceOf(ValidationException);
    });
  });

  describe('suggestFill', () => {
    it('uses UI rates when provided and installment counts for annual', async () => {
      prismaMock.package.findUnique.mockResolvedValue(basePackage);

      const result = await service.suggestFill(10, {
        planId: 100,
        categoryKey: 'member_only',
        rates: { daily: 90 },
      });

      expect(result.suggested.annually).toBe(24840);
      expect(result.suggested.weekly).toBe(Math.round(90 * (276 / 39)));
      expect(result.suggested.annually).not.toBe(90 * 365);
    });

    it('falls back to DB rates when UI rates omitted', async () => {
      prismaMock.package.findUnique.mockResolvedValue(basePackage);

      const result = await service.suggestFill(10, {
        planId: 100,
        categoryKey: 'member_only',
      });

      // DB has daily:56 and annually:17645 — does not overwrite annual; fills weekly
      expect(result.suggested.annually).toBe(17645);
      expect(result.suggested.weekly).toBe(Math.round(56 * (276 / 39)));
    });
  });
});
