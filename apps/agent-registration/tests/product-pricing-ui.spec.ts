/// <reference types="jest" />
import {
  computeInstallmentPremium,
  computeNominalHorizonFromToday,
  isFrequencySupportedByPackage,
  isPricingSubmitBlocked,
  nextInstallmentPremiumFormValue,
  packageFrequencySelectOptions,
  resolveModifyExpectedInstallmentCount,
} from '../src/lib/insurance-installment';
import { mapPackagePricingToUi } from '../src/lib/package-pricing-ui';
import type { PackagePricingData } from '../src/lib/api';

describe('product-pricing UI helpers', () => {
  it('blocks submit when pricing is missing or errored', () => {
    expect(isPricingSubmitBlocked('Missing price setup', { plans: {} })).toBe(true);
    expect(isPricingSubmitBlocked(null, null)).toBe(true);
    expect(isPricingSubmitBlocked(null, { plans: {} })).toBe(false);
  });

  it('exposes only package-configured frequencies', () => {
    const opts = packageFrequencySelectOptions([
      { frequency: 'DAILY', installmentCount: 276 },
      { frequency: 'WEEKLY', installmentCount: 39 },
    ]);
    expect(opts.map((o) => o.frequency)).toEqual(['DAILY', 'WEEKLY']);
    expect(opts.some((o) => o.frequency === 'CUSTOM')).toBe(false);
  });

  it('copies prior expectedInstallmentCount when frequency unchanged', () => {
    expect(
      resolveModifyExpectedInstallmentCount({
        selectedFrequency: 'WEEKLY',
        priorFrequency: 'WEEKLY',
        priorExpectedInstallmentCount: 39,
        packageFrequencies: [
          { frequency: 'WEEKLY', installmentCount: 52 },
          { frequency: 'DAILY', installmentCount: 276 },
        ],
      })
    ).toBe(39);
  });

  it('snapshots from package when frequency changes', () => {
    expect(
      resolveModifyExpectedInstallmentCount({
        selectedFrequency: 'DAILY',
        priorFrequency: 'WEEKLY',
        priorExpectedInstallmentCount: 39,
        packageFrequencies: [
          { frequency: 'WEEKLY', installmentCount: 39 },
          { frequency: 'DAILY', installmentCount: 276 },
        ],
      })
    ).toBe(276);
  });

  it('detects unsupported frequency', () => {
    expect(
      isFrequencySupportedByPackage('QUARTERLY', [{ frequency: 'DAILY', installmentCount: 276 }])
    ).toBe(false);
    expect(
      isFrequencySupportedByPackage('DAILY', [{ frequency: 'DAILY', installmentCount: 276 }])
    ).toBe(true);
  });

  it('maps API pricing to UI shape without pricingMode', () => {
    const apiData: PackagePricingData = {
      packageId: 1,
      packageSlug: 'mfanisi-boda',
      isPricingComplete: true,
      isActive: true,
      categories: [
        { key: 'member_only', display: 'M', kind: 'MEMBER_ONLY' },
        { key: 'additional_spouse', display: 'Spouse', kind: 'ADDITIONAL_SPOUSE' },
      ],
      plans: {
        silver: {
          planId: 10,
          name: 'Silver',
          rates: {
            member_only: { daily: 56, monthly: 1765, annually: 17645 },
            additional_spouse: { daily: 12, annually: 3789 },
          },
        },
      },
    };
    const ui = mapPackagePricingToUi(apiData);
    expect(ui).not.toHaveProperty('pricingMode');
    expect(ui.plans.silver.categories.member_only.monthly).toBe(1765);
    expect(ui.plans.silver.additional_spouse.daily).toBe(12);
  });
});

describe('insurance-installment (lookup-only)', () => {
  it('uses table monthly rate from lookupRates', () => {
    expect(
      computeInstallmentPremium({
        frequency: 'MONTHLY',
        daily: 56,
        weekly: 339,
        lookupRates: { daily: 56, weekly: 339, monthly: 1470, annually: 17645 },
      })
    ).toBe(1470);
  });

  it('returns 0 when lookup band missing for frequency', () => {
    expect(
      computeInstallmentPremium({
        frequency: 'MONTHLY',
        daily: 10,
        weekly: 70,
      })
    ).toBe(0);
  });

  it('computes nominal horizon from installment count', () => {
    const start = new Date(Date.UTC(2025, 0, 1, 0, 0, 0));
    const end = computeNominalHorizonFromToday(3, 7, start);
    expect(end.toISOString()).toBe('2025-01-15T00:00:00.000Z');
  });

  it('returns next premium string when calculated installment changes', () => {
    expect(
      nextInstallmentPremiumFormValue('', {
        frequency: 'DAILY',
        daily: 56,
        weekly: 339,
        lookupRates: { daily: 56 },
      })
    ).toBe('56');
  });

  it('returns null when premium form value already matches calculated installment', () => {
    expect(
      nextInstallmentPremiumFormValue('1470', {
        frequency: 'MONTHLY',
        daily: 56,
        weekly: 339,
        lookupRates: { daily: 56, weekly: 339, monthly: 1470, annually: 17645 },
      })
    ).toBeNull();
  });
});
