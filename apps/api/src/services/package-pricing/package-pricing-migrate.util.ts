import { PackagePricingCategoryKind, PaymentFrequency } from '@prisma/client';
import { PricingRateBand } from '../../utils/insurance-installment.util';

/** Legacy static JSON shape under agent-registration/public/product-pricing/. */
export type LegacyProductPricingJson = {
  packageSlug: string;
  pricingMode?: string;
  plans: Record<
    string,
    {
      name: string;
      categories: Record<
        string,
        PricingRateBand & { display: string }
      >;
      additional_spouse: PricingRateBand;
    }
  >;
};

export type MappedPricingCategory = {
  key: string;
  display: string;
  kind: PackagePricingCategoryKind;
  maxMembers: number | null;
  sortOrder: number;
};

export type MappedPlanRates = Record<string, PricingRateBand>;

const BAND_KEYS: Array<keyof PricingRateBand> = [
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'annually',
];

const BAND_TO_FREQ: Record<keyof PricingRateBand, PaymentFrequency> = {
  daily: PaymentFrequency.DAILY,
  weekly: PaymentFrequency.WEEKLY,
  monthly: PaymentFrequency.MONTHLY,
  quarterly: PaymentFrequency.QUARTERLY,
  annually: PaymentFrequency.ANNUALLY,
};

/** Map legacy category key to DB kind + maxMembers. */
export function mapLegacyCategoryKey(key: string): {
  kind: PackagePricingCategoryKind;
  maxMembers: number | null;
} {
  if (key === 'member_only') {
    return { kind: PackagePricingCategoryKind.MEMBER_ONLY, maxMembers: null };
  }
  if (key === 'additional_spouse') {
    return { kind: PackagePricingCategoryKind.ADDITIONAL_SPOUSE, maxMembers: null };
  }
  const upToMatch = /^up_to_(\d+)$/.exec(key);
  if (upToMatch) {
    return {
      kind: PackagePricingCategoryKind.UP_TO_N,
      maxMembers: parseInt(upToMatch[1], 10),
    };
  }
  throw new Error(`Unknown legacy category key "${key}"`);
}

/** Collect unique categories from all plans in a legacy JSON file. */
export function mapLegacyJsonCategories(json: LegacyProductPricingJson): MappedPricingCategory[] {
  const byKey = new Map<string, MappedPricingCategory>();
  let sortOrder = 0;

  for (const plan of Object.values(json.plans)) {
    for (const [key, cat] of Object.entries(plan.categories)) {
      if (byKey.has(key)) continue;
      const { kind, maxMembers } = mapLegacyCategoryKey(key);
      byKey.set(key, {
        key,
        display: cat.display,
        kind,
        maxMembers,
        sortOrder: sortOrder++,
      });
    }

    if (!byKey.has('additional_spouse')) {
      byKey.set('additional_spouse', {
        key: 'additional_spouse',
        display: 'Additional spouse',
        kind: PackagePricingCategoryKind.ADDITIONAL_SPOUSE,
        maxMembers: null,
        sortOrder: sortOrder++,
      });
    }
  }

  return [...byKey.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Map one plan's legacy JSON block to category-keyed rate bands (includes additional_spouse). */
export function mapLegacyPlanRates(
  plan: LegacyProductPricingJson['plans'][string]
): MappedPlanRates {
  const rates: MappedPlanRates = {};

  for (const [key, cat] of Object.entries(plan.categories)) {
    rates[key] = pickRateBand(cat);
  }

  rates.additional_spouse = pickRateBand(plan.additional_spouse);

  return rates;
}

function pickRateBand(source: PricingRateBand): PricingRateBand {
  const band: PricingRateBand = {};
  for (const key of BAND_KEYS) {
    const value = source[key];
    if (value != null && value > 0) {
      band[key] = value;
    }
  }
  return band;
}

/** Flat rate rows for DB upsert: planKey × categoryKey × frequency × amount. */
export function flattenLegacyRatesForPlan(
  planKey: string,
  rates: MappedPlanRates
): Array<{
  planKey: string;
  categoryKey: string;
  frequency: PaymentFrequency;
  amount: number;
}> {
  const rows: Array<{
    planKey: string;
    categoryKey: string;
    frequency: PaymentFrequency;
    amount: number;
  }> = [];

  for (const [categoryKey, band] of Object.entries(rates)) {
    for (const bandKey of BAND_KEYS) {
      const amount = band[bandKey];
      if (amount == null || amount <= 0) continue;
      rows.push({
        planKey,
        categoryKey,
        frequency: BAND_TO_FREQ[bandKey],
        amount,
      });
    }
  }

  return rows;
}

/** Drop-in API shape check: no pricingMode on mapped output. */
export function mapLegacyJsonToDropInShape(json: LegacyProductPricingJson) {
  const categories = mapLegacyJsonCategories(json);
  const plans: Record<
    string,
    { name: string; rates: Record<string, PricingRateBand> }
  > = {};

  for (const [planKey, plan] of Object.entries(json.plans)) {
    plans[planKey] = {
      name: plan.name,
      rates: mapLegacyPlanRates(plan),
    };
  }

  return {
    packageSlug: json.packageSlug,
    categories,
    plans,
  };
}
