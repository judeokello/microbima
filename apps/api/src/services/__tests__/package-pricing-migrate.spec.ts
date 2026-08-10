/// <reference types="jest" />
import { PackagePricingCategoryKind, PaymentFrequency } from '@prisma/client';
import {
  flattenLegacyRatesForPlan,
  mapLegacyCategoryKey,
  mapLegacyJsonCategories,
  mapLegacyJsonToDropInShape,
  mapLegacyPlanRates,
  type LegacyProductPricingJson,
} from '../package-pricing/package-pricing-migrate.util';

const bodaJson: LegacyProductPricingJson = {
  packageSlug: 'mfanisi-boda',
  pricingMode: 'lookup',
  plans: {
    silver: {
      name: 'Silver',
      categories: {
        member_only: {
          display: 'M',
          daily: 56,
          weekly: 392,
          monthly: 1765,
          annually: 17645,
        },
        up_to_5: {
          display: 'M(5)',
          daily: 99,
          weekly: 695,
          monthly: 3129,
          annually: 31293,
        },
        up_to_8: {
          display: 'M(8)',
          daily: 123,
          weekly: 861,
          monthly: 3869,
          annually: 38686,
        },
      },
      additional_spouse: {
        daily: 12,
        weekly: 84,
        monthly: 379,
        annually: 3789,
      },
    },
    gold: {
      name: 'Gold',
      categories: {
        member_only: {
          display: 'M',
          daily: 75,
          weekly: 525,
          monthly: 2364,
          annually: 23639,
        },
        up_to_5: {
          display: 'M(5)',
          daily: 136,
          weekly: 953,
          monthly: 4287,
          annually: 42875,
        },
        up_to_8: {
          display: 'M(8)',
          daily: 169,
          weekly: 1186,
          monthly: 5337,
          annually: 53373,
        },
      },
      additional_spouse: {
        daily: 17,
        weekly: 119,
        monthly: 537,
        annually: 5368,
      },
    },
  },
};

describe('package-pricing migration mapping', () => {
  it('maps legacy category keys to kinds and maxMembers', () => {
    expect(mapLegacyCategoryKey('member_only')).toEqual({
      kind: PackagePricingCategoryKind.MEMBER_ONLY,
      maxMembers: null,
    });
    expect(mapLegacyCategoryKey('up_to_5')).toEqual({
      kind: PackagePricingCategoryKind.UP_TO_N,
      maxMembers: 5,
    });
    expect(mapLegacyCategoryKey('up_to_8')).toEqual({
      kind: PackagePricingCategoryKind.UP_TO_N,
      maxMembers: 8,
    });
    expect(mapLegacyCategoryKey('additional_spouse')).toEqual({
      kind: PackagePricingCategoryKind.ADDITIONAL_SPOUSE,
      maxMembers: null,
    });
  });

  it('collects categories from JSON including additional_spouse', () => {
    const categories = mapLegacyJsonCategories(bodaJson);
    expect(categories.map((c) => c.key)).toEqual([
      'member_only',
      'up_to_5',
      'up_to_8',
      'additional_spouse',
    ]);
    expect(categories.find((c) => c.key === 'up_to_5')).toMatchObject({
      kind: PackagePricingCategoryKind.UP_TO_N,
      maxMembers: 5,
      display: 'M(5)',
    });
  });

  it('maps plan rates including additional_spouse band', () => {
    const rates = mapLegacyPlanRates(bodaJson.plans.silver);
    expect(rates.member_only).toMatchObject({
      daily: 56,
      weekly: 392,
      monthly: 1765,
      annually: 17645,
    });
    expect(rates.additional_spouse).toMatchObject({
      daily: 12,
      weekly: 84,
      monthly: 379,
      annually: 3789,
    });
  });

  it('flattens rates to frequency rows for DB upsert', () => {
    const rows = flattenLegacyRatesForPlan('silver', mapLegacyPlanRates(bodaJson.plans.silver));
    expect(rows).toContainEqual({
      planKey: 'silver',
      categoryKey: 'member_only',
      frequency: PaymentFrequency.MONTHLY,
      amount: 1765,
    });
    expect(rows).toContainEqual({
      planKey: 'silver',
      categoryKey: 'additional_spouse',
      frequency: PaymentFrequency.ANNUALLY,
      amount: 3789,
    });
  });

  it('produces drop-in shape without pricingMode', () => {
    const mapped = mapLegacyJsonToDropInShape(bodaJson);
    expect(mapped).not.toHaveProperty('pricingMode');
    expect(mapped.packageSlug).toBe('mfanisi-boda');
    expect(mapped.plans.silver.rates.up_to_5.monthly).toBe(3129);
    expect(mapped.categories.some((c) => c.kind === PackagePricingCategoryKind.MEMBER_ONLY)).toBe(
      true
    );
  });
});
