/// <reference types="jest" />
import { computeAnnualPremium, computeInstallmentPremium } from '../insurance-installment.util';

describe('computeInstallmentPremium (lookup-only)', () => {
  it('looks up monthly/annual rates without daily×cadence', () => {
    expect(
      computeInstallmentPremium({
        frequency: 'MONTHLY',
        daily: 56,
        weekly: 339,
        lookupRates: { daily: 56, weekly: 339, monthly: 1470, annually: 17645 },
      })
    ).toBe(1470);

    expect(
      computeInstallmentPremium({
        frequency: 'ANNUALLY',
        daily: 56,
        weekly: 339,
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
        lookupRates: { daily: 56, weekly: 339, monthly: 1470, annually: 17645 },
      })
    ).toBe(0);
  });

  it('does not extrapolate monthly from daily even if pricingMode=extrapolate is passed', () => {
    expect(
      computeInstallmentPremium({
        frequency: 'MONTHLY',
        daily: 10,
        weekly: 70,
        pricingMode: 'extrapolate',
      })
    ).toBe(0);
  });

  it('does not use weekly-only extrapolate shortcut without lookup weekly', () => {
    expect(
      computeInstallmentPremium({
        frequency: 'WEEKLY',
        daily: 10,
        weekly: 70,
        pricingMode: 'extrapolate',
      })
    ).toBe(70);
  });
});

describe('computeAnnualPremium (lookup-only)', () => {
  it('prefers annually band from lookup rates', () => {
    expect(
      computeAnnualPremium({
        daily: 84,
        lookupRates: { daily: 84, weekly: 586, annually: 30660 },
      })
    ).toBe(30660);
  });

  it('does not fall back to daily × 365', () => {
    expect(
      computeAnnualPremium({
        daily: 63,
        pricingMode: 'extrapolate',
      })
    ).toBe(0);
  });
});
