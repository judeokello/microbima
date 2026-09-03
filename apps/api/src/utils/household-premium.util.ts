import {
  additionalSpouseCount,
  resolveFamilyCategoryForHousehold,
  type PackagePricingBand,
} from './family-category.util';
import {
  computeAnnualPremium,
  computeInstallmentPremium,
  type PricingRateBand,
} from './insurance-installment.util';
import { DependantRelationship } from '@prisma/client';

export type HouseholdPremiumPricing = {
  categories: Array<{
    key: string;
    kind: string;
    maxMembers?: number | null;
  }>;
  plans: Record<
    string,
    {
      planId: number;
      rates: Record<string, PricingRateBand>;
    }
  >;
};

export type HouseholdPremiumOk = {
  ok: true;
  premium: number;
  annualPremium: number;
  categoryKey: string;
  extraSpouseCount: number;
};

export type HouseholdPremiumErr = { ok: false; reason: string };

export function computeHouseholdPremium(params: {
  pricing: HouseholdPremiumPricing;
  packagePlanId: number;
  frequency: string;
  dependants: Array<{ relationship: DependantRelationship; deletedAt?: Date | null }>;
}): HouseholdPremiumOk | HouseholdPremiumErr {
  const plan = Object.values(params.pricing.plans).find((p) => p.planId === params.packagePlanId);
  if (!plan) {
    return { ok: false, reason: 'Selected plan is not in package pricing' };
  }

  const bands: PackagePricingBand[] = params.pricing.categories.map((c) => ({
    key: c.key,
    kind: c.kind as PackagePricingBand['kind'],
    maxMembers: c.maxMembers ?? null,
  }));

  const householdSize = 1 + params.dependants.filter((d) => d.deletedAt == null).length;
  const resolved = resolveFamilyCategoryForHousehold(householdSize, bands);
  if (!resolved.ok) {
    return { ok: false, reason: 'Household is larger than this package allows' };
  }

  const categoryRates = plan.rates[resolved.categoryKey];
  if (!categoryRates) {
    return { ok: false, reason: 'No rates for the resolved family category' };
  }

  const extraSpouseCount = additionalSpouseCount(resolved.categoryKey, params.dependants);
  const spouseBand = params.pricing.categories.find((c) => c.kind === 'ADDITIONAL_SPOUSE');
  const spouseRates = spouseBand ? (plan.rates[spouseBand.key] ?? {}) : {};

  const lookupRates: PricingRateBand = {
    daily: (categoryRates.daily ?? 0) + extraSpouseCount * (spouseRates.daily ?? 0),
    weekly: (categoryRates.weekly ?? 0) + extraSpouseCount * (spouseRates.weekly ?? 0),
    monthly: (categoryRates.monthly ?? 0) + extraSpouseCount * (spouseRates.monthly ?? 0),
    quarterly: (categoryRates.quarterly ?? 0) + extraSpouseCount * (spouseRates.quarterly ?? 0),
    annually: (categoryRates.annually ?? 0) + extraSpouseCount * (spouseRates.annually ?? 0),
  };

  const premium = computeInstallmentPremium({
    frequency: params.frequency,
    daily: lookupRates.daily,
    weekly: lookupRates.weekly,
    lookupRates,
  });
  const annualPremium = computeAnnualPremium({
    daily: lookupRates.daily,
    lookupRates,
  });

  if (premium <= 0) {
    return { ok: false, reason: 'Could not resolve an installment premium for this frequency' };
  }

  return {
    ok: true,
    premium,
    annualPremium,
    categoryKey: resolved.categoryKey,
    extraSpouseCount,
  };
}
