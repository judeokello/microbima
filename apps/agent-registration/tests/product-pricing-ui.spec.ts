/// <reference types="jest" />
import {
  computeInstallmentPremium,
  computeNominalHorizonFromToday,
  isFrequencySupportedByPackage,
  isPricingSubmitBlocked,
  packageFrequencySelectOptions,
  productPricingPath,
  resolveModifyExpectedInstallmentCount,
} from '../src/lib/insurance-installment';

describe('product-pricing UI helpers', () => {
  it('builds pricing file path from slug', () => {
    expect(productPricingPath('mfanisi-boda')).toBe('/product-pricing/mfanisi-boda-pricing.json');
  });

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
});

describe('insurance-installment (UI pricing modes)', () => {
  it('lookup mode uses table monthly rate', () => {
    expect(
      computeInstallmentPremium({
        frequency: 'MONTHLY',
        daily: 56,
        weekly: 339,
        pricingMode: 'lookup',
        lookupRates: { daily: 56, weekly: 339, monthly: 1470, annually: 17645 },
      })
    ).toBe(1470);
  });

  it('extrapolate mode uses daily × cadence for monthly', () => {
    expect(
      computeInstallmentPremium({
        frequency: 'MONTHLY',
        daily: 10,
        weekly: 70,
        pricingMode: 'extrapolate',
      })
    ).toBe(310);
  });

  it('computes nominal horizon from installment count', () => {
    const start = new Date(Date.UTC(2025, 0, 1, 0, 0, 0));
    const end = computeNominalHorizonFromToday(3, 7, start);
    expect(end.toISOString()).toBe('2025-01-15T00:00:00.000Z');
  });
});
