/// <reference types="jest" />
import {
  computeInstallmentPremium,
  productPricingPath,
} from '../insurance-installment';

describe('computeInstallmentPremium', () => {
  it('extrapolates non-weekly from daily × cadence', () => {
    expect(
      computeInstallmentPremium({
        frequency: 'MONTHLY',
        daily: 10,
        weekly: 70,
        pricingMode: 'extrapolate',
      })
    ).toBe(310);
  });

  it('uses weekly table rate in extrapolate mode', () => {
    expect(
      computeInstallmentPremium({
        frequency: 'WEEKLY',
        daily: 10,
        weekly: 70,
        pricingMode: 'extrapolate',
      })
    ).toBe(70);
  });

  it('looks up monthly/annual rates without daily×cadence', () => {
    expect(
      computeInstallmentPremium({
        frequency: 'MONTHLY',
        daily: 56,
        weekly: 339,
        pricingMode: 'lookup',
        lookupRates: { daily: 56, weekly: 339, monthly: 1470, annually: 17645 },
      })
    ).toBe(1470);

    expect(
      computeInstallmentPremium({
        frequency: 'ANNUALLY',
        daily: 56,
        weekly: 339,
        pricingMode: 'lookup',
        lookupRates: { daily: 56, weekly: 339, monthly: 1470, annually: 17645 },
      })
    ).toBe(17645);
  });

  it('returns 0 for lookup frequency without a rate', () => {
    expect(
      computeInstallmentPremium({
        frequency: 'QUARTERLY',
        daily: 56,
        weekly: 339,
        pricingMode: 'lookup',
        lookupRates: { daily: 56, weekly: 339, monthly: 1470, annually: 17645 },
      })
    ).toBe(0);
  });
});

describe('productPricingPath', () => {
  it('builds the public path', () => {
    expect(productPricingPath('mfanisi-boda')).toBe('/product-pricing/mfanisi-boda-pricing.json');
  });
});
