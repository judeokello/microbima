import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  PackagePricingCategoryKind,
  PaymentFrequency,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ValidationException } from '../../exceptions/validation.exception';
import { ErrorCodes } from '../../enums/error-codes.enum';
import {
  CreatePricingCategoryRequestDto,
  PackagePricingCategoryKindDto,
  PutPackagePricingRequestDto,
  SuggestFillRequestDto,
} from '../../dto/packages/package-pricing.dto';
import { evaluatePackagePricingCompleteness } from './package-pricing-completeness';
import { PACKAGE_PRICING_INCOMPLETE_DEACTIVATE_WARNING } from './package-pricing.constants';
import {
  PACKAGE_PRICING_FREQUENCIES,
  rateBandKeyForFrequency,
  suggestFillFromLowerBand,
} from '../../utils/package-pricing-cadence.util';
import { PricingRateBand } from '../../utils/insurance-installment.util';

export type PackagePricingData = {
  packageId: number;
  packageSlug: string | null;
  isPricingComplete: boolean;
  isActive: boolean;
  enabledFrequencies: string[];
  categories: Array<{
    id: number;
    key: string;
    display: string;
    kind: PackagePricingCategoryKind;
    maxMembers: number | null;
    sortOrder: number;
  }>;
  plans: Record<
    string,
    {
      planId: number;
      name: string;
      isActive: boolean;
      rates: Record<string, PricingRateBand>;
    }
  >;
};

const FREQ_TO_BAND: Record<string, keyof PricingRateBand> = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  ANNUALLY: 'annually',
};

const BAND_TO_FREQ: Record<keyof PricingRateBand, PaymentFrequency> = {
  daily: PaymentFrequency.DAILY,
  weekly: PaymentFrequency.WEEKLY,
  monthly: PaymentFrequency.MONTHLY,
  quarterly: PaymentFrequency.QUARTERLY,
  annually: PaymentFrequency.ANNUALLY,
};

type LoadedPackage = {
  id: number;
  slug: string | null;
  isActive: boolean;
  packagePlans: Array<{
    id: number;
    name: string;
    isActive: boolean;
    rates: Array<{
      frequency: PaymentFrequency;
      amount: Prisma.Decimal;
      packagePricingCategory: { key: string };
    }>;
  }>;
  packagePricingCategories: Array<{
    id: number;
    key: string;
    displayName: string;
    kind: PackagePricingCategoryKind;
    maxMembers: number | null;
    sortOrder: number;
  }>;
  packagePaymentFrequencies: Array<{ frequency: PaymentFrequency }>;
};

@Injectable()
export class PackagePricingService {
  private readonly logger = new Logger(PackagePricingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getPricing(packageId: number): Promise<PackagePricingData> {
    const pkg = await this.loadPackage(packageId);
    if (!pkg) {
      throw new NotFoundException(`Package with ID ${packageId} not found`);
    }
    return this.mapToPricingData(pkg as unknown as LoadedPackage);
  }

  async getPricingBySlug(slug: string): Promise<PackagePricingData> {
    const pkg = await this.prisma.package.findUnique({
      where: { slug },
      include: this.packageInclude(),
    });
    if (!pkg) {
      throw new NotFoundException(`Package with slug "${slug}" not found`);
    }
    return this.mapToPricingData(pkg as unknown as LoadedPackage);
  }

  async putPricing(
    packageId: number,
    body: PutPackagePricingRequestDto,
    userId: string
  ): Promise<PackagePricingData> {
    const existing = await this.prisma.package.findUnique({
      where: { id: packageId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException(`Package with ID ${packageId} not found`);
    }

    this.validateCategorySet(body.categories);
    this.validatePlansAndRates(body);

    const plans = await this.prisma.packagePlan.findMany({
      where: { packageId },
      select: { id: true, name: true },
    });
    const planByName = new Map(plans.map((p) => [p.name.toLowerCase(), p]));
    const planById = new Map(plans.map((p) => [p.id, p]));

    await this.prisma.$transaction(async (tx) => {
      const existingCategories = await tx.packagePricingCategory.findMany({
        where: { packageId },
      });
      const incomingKeys = new Set(body.categories.map((c) => c.key));

      for (const cat of existingCategories) {
        if (!incomingKeys.has(cat.key)) {
          await tx.packagePricingCategory.delete({ where: { id: cat.id } });
        }
      }

      const categoryIdByKey = new Map<string, number>();

      for (const cat of body.categories) {
        const kind = cat.kind as unknown as PackagePricingCategoryKind;
        const upserted = await tx.packagePricingCategory.upsert({
          where: { packageId_key: { packageId, key: cat.key } },
          create: {
            packageId,
            key: cat.key,
            displayName: cat.display,
            kind,
            maxMembers: cat.maxMembers ?? null,
            sortOrder: cat.sortOrder ?? 0,
            createdBy: userId,
            updatedBy: userId,
          },
          update: {
            displayName: cat.display,
            kind,
            maxMembers: cat.maxMembers ?? null,
            sortOrder: cat.sortOrder ?? 0,
            updatedBy: userId,
          },
        });
        categoryIdByKey.set(cat.key, upserted.id);
      }

      for (const [planKey, planPayload] of Object.entries(body.plans)) {
        let planId = planPayload.planId;
        if (planId != null) {
          if (!planById.has(planId)) {
            throw ValidationException.forField(
              `plans.${planKey}.planId`,
              `Plan ID ${planId} not found for this package`,
              ErrorCodes.VALIDATION_ERROR
            );
          }
        } else {
          const match = planByName.get(planKey.toLowerCase());
          if (!match) {
            throw ValidationException.forField(
              `plans.${planKey}`,
              `Plan "${planKey}" not found for this package`,
              ErrorCodes.VALIDATION_ERROR
            );
          }
          planId = match.id;
        }

        for (const [categoryKey, band] of Object.entries(planPayload.rates)) {
          const categoryId = categoryIdByKey.get(categoryKey);
          if (categoryId == null) {
            throw ValidationException.forField(
              `plans.${planKey}.rates.${categoryKey}`,
              `Unknown category key "${categoryKey}"`,
              ErrorCodes.VALIDATION_ERROR
            );
          }

          for (const freq of PACKAGE_PRICING_FREQUENCIES) {
            const bandKey = rateBandKeyForFrequency(freq);
            if (!bandKey) continue;
            const amount = band[bandKey];
            if (amount == null) continue;

            if (!(amount > 0)) {
              throw ValidationException.forField(
                `plans.${planKey}.rates.${categoryKey}.${bandKey}`,
                'Amount must be greater than 0',
                ErrorCodes.VALIDATION_ERROR
              );
            }

            await tx.packagePlanRate.upsert({
              where: {
                packagePlanId_packagePricingCategoryId_frequency: {
                  packagePlanId: planId,
                  packagePricingCategoryId: categoryId,
                  frequency: freq as PaymentFrequency,
                },
              },
              create: {
                packagePlanId: planId,
                packagePricingCategoryId: categoryId,
                frequency: freq as PaymentFrequency,
                amount,
                createdBy: userId,
                updatedBy: userId,
              },
              update: {
                amount,
                updatedBy: userId,
              },
            });
          }
        }
      }
    });

    return this.getPricing(packageId);
  }

  async createCategory(
    packageId: number,
    body: CreatePricingCategoryRequestDto,
    userId: string
  ): Promise<{
    isPricingComplete: boolean;
    isActive: boolean;
    warning?: string;
    category: PackagePricingData['categories'][0];
  }> {
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
      select: { id: true, isActive: true },
    });
    if (!pkg) {
      throw new NotFoundException(`Package with ID ${packageId} not found`);
    }

    const kind = body.kind as unknown as PackagePricingCategoryKind;
    const validationErrors: Record<string, string> = {};

    if (kind === PackagePricingCategoryKind.UP_TO_N) {
      if (body.maxMembers == null || body.maxMembers < 2) {
        validationErrors['maxMembers'] = 'maxMembers >= 2 is required for UP_TO_N';
      }
    }

    const key =
      body.key?.trim() ??
      this.deriveCategoryKey(kind, body.maxMembers ?? null);

    const existing = await this.prisma.packagePricingCategory.findMany({
      where: { packageId },
    });

    this.validateNewCategoryUniqueness(
      existing.map((c) => ({
        key: c.key,
        kind: c.kind,
        maxMembers: c.maxMembers,
      })),
      {
        key,
        kind: body.kind,
        maxMembers: body.maxMembers ?? null,
      },
      validationErrors
    );

    if (Object.keys(validationErrors).length > 0) {
      throw ValidationException.withMultipleErrors(validationErrors);
    }

    const maxSort = existing.reduce((m, c) => Math.max(m, c.sortOrder), -1);

    const created = await this.prisma.packagePricingCategory.create({
      data: {
        packageId,
        key,
        displayName: body.display,
        kind,
        maxMembers: kind === PackagePricingCategoryKind.UP_TO_N ? body.maxMembers! : null,
        sortOrder: body.sortOrder ?? maxSort + 1,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    const pricing = await this.getPricing(packageId);
    let isActive = pkg.isActive;
    let warning: string | undefined;

    if (pkg.isActive && !pricing.isPricingComplete) {
      await this.prisma.package.update({
        where: { id: packageId },
        data: { isActive: false },
      });
      isActive = false;
      warning = PACKAGE_PRICING_INCOMPLETE_DEACTIVATE_WARNING;
    }

    return {
      isPricingComplete: pricing.isPricingComplete,
      isActive,
      ...(warning ? { warning } : {}),
      category: {
        id: created.id,
        key: created.key,
        display: created.displayName,
        kind: created.kind,
        maxMembers: created.maxMembers,
        sortOrder: created.sortOrder,
      },
    };
  }

  async suggestFill(
    packageId: number,
    body: SuggestFillRequestDto
  ): Promise<{ planId: number; categoryKey: string; suggested: PricingRateBand }> {
    const pkg = await this.loadPackage(packageId);
    if (!pkg) {
      throw new NotFoundException(`Package with ID ${packageId} not found`);
    }

    const plan = pkg.packagePlans.find((p) => p.id === body.planId);
    if (!plan) {
      throw ValidationException.forField(
        'planId',
        `Plan ID ${body.planId} not found for this package`,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const category = pkg.packagePricingCategories.find((c) => c.key === body.categoryKey);
    if (!category) {
      throw ValidationException.forField(
        'categoryKey',
        `Category "${body.categoryKey}" not found`,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const currentBand = this.ratesToBand(
      plan.rates.filter((r) => r.packagePricingCategory.key === body.categoryKey)
    );

    const enabledFrequencies = pkg.packagePaymentFrequencies.map((f) => f.frequency);
    const suggested = suggestFillFromLowerBand({
      rates: currentBand,
      enabledFrequencies,
      overwriteFilled: body.overwriteFilled ?? false,
    });

    return {
      planId: body.planId,
      categoryKey: body.categoryKey,
      suggested,
    };
  }

  private packageInclude(): Prisma.PackageInclude {
    return {
      packagePlans: {
        include: {
          rates: {
            include: {
              packagePricingCategory: { select: { key: true } },
            },
          },
        },
        orderBy: { name: 'asc' },
      },
      packagePricingCategories: { orderBy: { sortOrder: 'asc' } },
      packagePaymentFrequencies: { orderBy: { frequency: 'asc' } },
    };
  }

  private async loadPackage(packageId: number): Promise<LoadedPackage | null> {
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
      include: this.packageInclude(),
    });
    return pkg as unknown as LoadedPackage | null;
  }

  private mapToPricingData(pkg: LoadedPackage): PackagePricingData {
    const enabledFrequencies = pkg.packagePaymentFrequencies
      .map((f) => f.frequency)
      .filter((f) => f !== PaymentFrequency.CUSTOM);

    const categories = pkg.packagePricingCategories.map((c) => ({
      id: c.id,
      key: c.key,
      display: c.displayName,
      kind: c.kind,
      maxMembers: c.maxMembers,
      sortOrder: c.sortOrder,
    }));

    const completeness = evaluatePackagePricingCompleteness({
      plans: pkg.packagePlans.map((p) => ({
        id: p.id,
        name: p.name,
        isActive: p.isActive,
      })),
      categories: categories.map((c) => ({
        key: c.key,
        kind: c.kind,
        maxMembers: c.maxMembers,
      })),
      enabledFrequencies,
      rates: pkg.packagePlans.flatMap((plan) =>
        plan.rates.map((r) => ({
          packagePlanId: plan.id,
          categoryKey: r.packagePricingCategory.key,
          frequency: r.frequency,
          amount: Number(r.amount),
        }))
      ),
    });

    const plans: PackagePricingData['plans'] = {};
    for (const plan of pkg.packagePlans) {
      const ratesByCategory: Record<string, PricingRateBand> = {};
      for (const cat of pkg.packagePricingCategories) {
        const band = this.ratesToBand(
          plan.rates.filter((r) => r.packagePricingCategory.key === cat.key)
        );
        if (Object.keys(band).length > 0) {
          ratesByCategory[cat.key] = band;
        }
      }
      plans[plan.name.toLowerCase()] = {
        planId: plan.id,
        name: plan.name,
        isActive: plan.isActive,
        rates: ratesByCategory,
      };
    }

    return {
      packageId: pkg.id,
      packageSlug: pkg.slug,
      isPricingComplete: completeness.isPricingComplete,
      isActive: pkg.isActive,
      enabledFrequencies,
      categories,
      plans,
    };
  }

  private ratesToBand(
    rates: Array<{ frequency: PaymentFrequency; amount: Prisma.Decimal }>
  ): PricingRateBand {
    const band: PricingRateBand = {};
    for (const rate of rates) {
      if (rate.frequency === PaymentFrequency.CUSTOM) continue;
      const key = FREQ_TO_BAND[rate.frequency];
      if (key) {
        band[key] = Number(rate.amount);
      }
    }
    return band;
  }

  private deriveCategoryKey(
    kind: PackagePricingCategoryKind,
    maxMembers: number | null
  ): string {
    switch (kind) {
      case PackagePricingCategoryKind.MEMBER_ONLY:
        return 'member_only';
      case PackagePricingCategoryKind.ADDITIONAL_SPOUSE:
        return 'additional_spouse';
      case PackagePricingCategoryKind.UP_TO_N:
        return `up_to_${maxMembers}`;
      default:
        return 'category';
    }
  }

  private validateNewCategoryUniqueness(
    existing: Array<{ key: string; kind: string; maxMembers?: number | null }>,
    incoming: { key: string; kind: PackagePricingCategoryKindDto; maxMembers?: number | null },
    validationErrors: Record<string, string>,
    prefix = ''
  ): void {
    this.validateCategoryCollection([...existing, incoming], validationErrors, prefix);
  }

  private validateCategoryCollection(
    categories: Array<{ key: string; kind: PackagePricingCategoryKindDto | string; maxMembers?: number | null }>,
    validationErrors: Record<string, string>,
    prefix = ''
  ): void {
    const field = (name: string) => (prefix ? `${prefix}.${name}` : name);

    const memberOnly = categories.filter(
      (c) => c.kind === PackagePricingCategoryKindDto.MEMBER_ONLY
    );
    if (memberOnly.length > 1) {
      validationErrors[field('kind')] = 'At most one MEMBER_ONLY category is allowed';
    }

    const spouse = categories.filter(
      (c) => c.kind === PackagePricingCategoryKindDto.ADDITIONAL_SPOUSE
    );
    if (spouse.length > 1) {
      validationErrors[field('kind')] = 'At most one ADDITIONAL_SPOUSE category is allowed';
    }

    const upToNs = categories.filter(
      (c) => c.kind === PackagePricingCategoryKindDto.UP_TO_N
    );
    const maxMembersSeen = new Set<number>();
    for (const cat of upToNs) {
      if (cat.maxMembers == null || cat.maxMembers < 2) continue;
      if (maxMembersSeen.has(cat.maxMembers)) {
        validationErrors[field('maxMembers')] =
          `Duplicate Up to N maxMembers ${cat.maxMembers}`;
      }
      maxMembersSeen.add(cat.maxMembers);
    }

    const keysSeen = new Set<string>();
    for (const cat of categories) {
      if (keysSeen.has(cat.key)) {
        validationErrors[field('key')] = `Duplicate category key "${cat.key}"`;
      }
      keysSeen.add(cat.key);
    }
  }

  private validateCategorySet(
    categories: PutPackagePricingRequestDto['categories']
  ): void {
    const validationErrors: Record<string, string> = {};

    for (const cat of categories.filter(
      (c) => c.kind === PackagePricingCategoryKindDto.UP_TO_N
    )) {
      if (cat.maxMembers == null || cat.maxMembers < 2) {
        validationErrors[`categories.${cat.key}.maxMembers`] =
          'maxMembers >= 2 is required for UP_TO_N';
      }
    }

    this.validateCategoryCollection(categories, validationErrors, 'categories');

    if (Object.keys(validationErrors).length > 0) {
      throw ValidationException.withMultipleErrors(validationErrors);
    }
  }

  private validatePlansAndRates(body: PutPackagePricingRequestDto): void {
    const validationErrors: Record<string, string> = {};

    for (const [planKey, planPayload] of Object.entries(body.plans)) {
      for (const [categoryKey, band] of Object.entries(planPayload.rates)) {
        for (const [prop, value] of Object.entries(band)) {
          if (prop === 'custom' || prop === 'customDays') {
            validationErrors[`plans.${planKey}.rates.${categoryKey}.${prop}`] =
              'CUSTOM frequency is not allowed on pricing rates';
          }
          if (
            !['daily', 'weekly', 'monthly', 'quarterly', 'annually'].includes(prop)
          ) {
            validationErrors[`plans.${planKey}.rates.${categoryKey}.${prop}`] =
              `Invalid rate band key "${prop}"`;
          }
          if (value != null && typeof value === 'number' && value <= 0) {
            validationErrors[`plans.${planKey}.rates.${categoryKey}.${prop}`] =
              'Amount must be greater than 0';
          }
        }

        for (const freq of Object.keys(band) as Array<keyof PricingRateBand>) {
          if (!(freq in BAND_TO_FREQ)) {
            validationErrors[`plans.${planKey}.rates.${categoryKey}.${freq}`] =
              'CUSTOM frequency is not allowed on pricing rates';
          }
        }
      }
    }

    if (Object.keys(validationErrors).length > 0) {
      throw ValidationException.withMultipleErrors(validationErrors);
    }
  }
}

export async function loadPricingCompletenessInput(
  prisma: PrismaService,
  packageId: number
) {
  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
    include: {
      packagePlans: { select: { id: true, name: true, isActive: true } },
      packagePricingCategories: {
        select: { key: true, kind: true, maxMembers: true },
      },
      packagePaymentFrequencies: { select: { frequency: true } },
    },
  });

  if (!pkg) return null;

  const rates = await prisma.packagePlanRate.findMany({
    where: { packagePlan: { packageId } },
    select: {
      packagePlanId: true,
      frequency: true,
      amount: true,
      packagePricingCategory: { select: { key: true } },
    },
  });

  return {
    plans: pkg.packagePlans,
    categories: pkg.packagePricingCategories.map((c) => ({
      key: c.key,
      kind: c.kind,
      maxMembers: c.maxMembers,
    })),
    enabledFrequencies: pkg.packagePaymentFrequencies.map((f) => f.frequency),
    rates: rates.map((r) => ({
      packagePlanId: r.packagePlanId,
      categoryKey: r.packagePricingCategory.key,
      frequency: r.frequency,
      amount: Number(r.amount),
    })),
  };
}
