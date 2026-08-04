/// <reference types="jest" />
import { computeAnnualPremium, computeInstallmentPremium } from '../insurance-installment.util';

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

describe('computeAnnualPremium', () => {
  it('prefers annually band from lookup rates', () => {
    expect(
      computeAnnualPremium({
        daily: 84,
        pricingMode: 'extrapolate',
        lookupRates: { daily: 84, weekly: 586, annually: 30660 },
      })
    ).toBe(30660);
  });

  it('falls back to daily × 365 in extrapolate mode', () => {
    expect(
      computeAnnualPremium({
        daily: 63,
        pricingMode: 'extrapolate',
      })
    ).toBe(22995);
  });
});
