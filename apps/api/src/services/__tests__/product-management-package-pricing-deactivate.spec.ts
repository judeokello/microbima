/// <reference types="jest" />
import { PaymentFrequency, PackagePricingCategoryKind } from '@prisma/client';
import { ProductManagementService } from '../product-management.service';
import { PackagePricingService } from '../package-pricing/package-pricing.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentAccountNumberService } from '../payment-account-number.service';
import { SupabaseService } from '../supabase.service';
import { PACKAGE_PRICING_INCOMPLETE_DEACTIVATE_WARNING } from '../package-pricing/package-pricing.constants';
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

describe('ProductManagementService - auto-deactivate on incomplete pricing (US3)', () => {
  const prismaMock = {
    package: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    packagePlan: {
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
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

  describe('createPackagePlan', () => {
    it('deactivates active package and returns warning when new plan leaves pricing incomplete', async () => {
      prismaMock.package.findUnique.mockResolvedValue({ id: 10, isActive: true });
      prismaMock.packagePlan.findFirst.mockResolvedValue(null);
      prismaMock.packagePlan.create.mockResolvedValue({
        id: 2,
        name: 'Platinum',
        description: null,
        isActive: true,
      });
      loadPricingCompletenessInput.mockResolvedValue({
        plans: [
          { id: 1, name: 'Silver', isActive: true },
          { id: 2, name: 'Platinum', isActive: true },
        ],
        categories: [{ key: 'member_only', kind: 'MEMBER_ONLY', maxMembers: null }],
        enabledFrequencies: [PaymentFrequency.DAILY, PaymentFrequency.ANNUALLY],
        rates: [
          {
            packagePlanId: 1,
            categoryKey: 'member_only',
            frequency: PaymentFrequency.DAILY,
            amount: 56,
          },
        ],
      });
      prismaMock.package.update.mockResolvedValue({ id: 10, isActive: false });

      const result = await service.createPackagePlan(
        10,
        { name: 'Platinum' },
        'user-1',
        'corr-1'
      );

      expect(prismaMock.package.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { isActive: false },
      });
      expect(result.warning).toBe(PACKAGE_PRICING_INCOMPLETE_DEACTIVATE_WARNING);
      expect(result.packageIsActive).toBe(false);
    });

    it('does not deactivate when pricing remains complete', async () => {
      prismaMock.package.findUnique.mockResolvedValue({ id: 10, isActive: true });
      prismaMock.packagePlan.findFirst.mockResolvedValue(null);
      prismaMock.packagePlan.create.mockResolvedValue({
        id: 2,
        name: 'Platinum',
        description: null,
        isActive: true,
      });
      loadPricingCompletenessInput.mockResolvedValue({
        plans: [
          { id: 1, name: 'Silver', isActive: true },
          { id: 2, name: 'Platinum', isActive: true },
        ],
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
          {
            packagePlanId: 2,
            categoryKey: 'member_only',
            frequency: PaymentFrequency.DAILY,
            amount: 75,
          },
          {
            packagePlanId: 2,
            categoryKey: 'member_only',
            frequency: PaymentFrequency.ANNUALLY,
            amount: 23639,
          },
        ],
      });

      const result = await service.createPackagePlan(
        10,
        { name: 'Platinum' },
        'user-1',
        'corr-1'
      );

      expect(prismaMock.package.update).not.toHaveBeenCalled();
      expect(result.warning).toBeUndefined();
      expect(result.packageIsActive).toBe(true);
    });
  });

  describe('updatePackage payment frequencies', () => {
    it('deactivates when enabling a frequency expands required cells without rates', async () => {
      const existing = {
        id: 10,
        isActive: true,
        slug: 'test',
        name: 'Test',
        description: 'd',
        underwriterId: 1,
        logoPath: null,
        createdBy: 'u',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.package.findUnique.mockResolvedValue(existing);
      prismaMock.packagePlan.count.mockResolvedValue(1);

      const updatedPkg = {
        ...existing,
        isActive: true,
        underwriter: { id: 1, name: 'UW' },
        packagePaymentFrequencies: [
          { frequency: PaymentFrequency.DAILY, installmentCount: 313 },
          { frequency: PaymentFrequency.WEEKLY, installmentCount: 45 },
        ],
      };

      prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          package: {
            update: jest.fn().mockResolvedValue(updatedPkg),
            findUniqueOrThrow: jest.fn().mockResolvedValue(updatedPkg),
          },
          packagePaymentFrequency: {
            deleteMany: jest.fn(),
            createMany: jest.fn(),
          },
        };
        return fn(tx);
      });

      loadPricingCompletenessInput.mockResolvedValue({
        plans: [{ id: 1, name: 'Silver', isActive: true }],
        categories: [{ key: 'member_only', kind: 'MEMBER_ONLY', maxMembers: null }],
        enabledFrequencies: [PaymentFrequency.DAILY, PaymentFrequency.WEEKLY],
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
      prismaMock.package.update.mockResolvedValue({ id: 10, isActive: false });

      const result = await service.updatePackage(
        10,
        {
          paymentFrequencies: [
            { frequency: PaymentFrequency.DAILY, installmentCount: 313 },
            { frequency: PaymentFrequency.WEEKLY, installmentCount: 45 },
          ],
        },
        'corr-1'
      );

      expect(prismaMock.package.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { isActive: false },
      });
      expect(result.warning).toBe(PACKAGE_PRICING_INCOMPLETE_DEACTIVATE_WARNING);
      expect(result.isActive).toBe(false);
    });
  });
});

describe('PackagePricingService.createCategory auto-deactivate (US3)', () => {
  const prismaMock = {
    package: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    packagePricingCategory: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  };

  const service = new PackagePricingService(prismaMock as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deactivates active package when new category leaves pricing incomplete', async () => {
    prismaMock.package.findUnique
      .mockResolvedValueOnce({ id: 10, isActive: true })
      .mockResolvedValueOnce({
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
          {
            id: 2,
            key: 'up_to_5',
            displayName: 'M(5)',
            kind: PackagePricingCategoryKind.UP_TO_N,
            maxMembers: 5,
            sortOrder: 1,
          },
        ],
        packagePlans: [
          {
            id: 1,
            name: 'Silver',
            isActive: true,
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
      });
    prismaMock.packagePricingCategory.findMany.mockResolvedValue([
      {
        key: 'member_only',
        kind: PackagePricingCategoryKind.MEMBER_ONLY,
        maxMembers: null,
      },
    ]);
    prismaMock.packagePricingCategory.create.mockResolvedValue({
      id: 2,
      key: 'up_to_5',
      displayName: 'M(5)',
      kind: PackagePricingCategoryKind.UP_TO_N,
      maxMembers: 5,
      sortOrder: 1,
    });
    prismaMock.package.update.mockResolvedValue({ id: 10, isActive: false });

    const result = await service.createCategory(
      10,
      {
        kind: PackagePricingCategoryKindDto.UP_TO_N,
        display: 'M(5)',
        maxMembers: 5,
      },
      'user-1'
    );

    expect(prismaMock.package.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { isActive: false },
    });
    expect(result.warning).toBe(PACKAGE_PRICING_INCOMPLETE_DEACTIVATE_WARNING);
    expect(result.isActive).toBe(false);
    expect(result.isPricingComplete).toBe(false);
  });
});
