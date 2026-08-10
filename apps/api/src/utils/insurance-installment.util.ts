/**
 * Installment premium helpers (mirrors agent-registration insurance-installment.ts).
 * Kept in API for unit testing of extrapolate vs lookup pricing modes.
 */

export const PAYMENT_CADENCE_DAYS: Record<string, number> = {
  DAILY: 1,
  WEEKLY: 7,
  MONTHLY: 31,
  QUARTERLY: 90,
  ANNUALLY: 365,
};

export type PricingMode = 'extrapolate' | 'lookup';

export type PricingRateBand = {
  daily?: number;
  weekly?: number;
  monthly?: number;
  quarterly?: number;
  annually?: number;
};

export function cadenceDaysForFrequency(frequency: string, customDays?: number): number {
  if (frequency === 'CUSTOM') {
    return customDays != null && customDays > 0 ? customDays : 0;
  }
  return PAYMENT_CADENCE_DAYS[frequency] ?? 0;
}

function lookupRateForFrequency(frequency: string, rates: PricingRateBand): number | null {
  switch (frequency) {
    case 'DAILY':
      return rates.daily ?? null;
    case 'WEEKLY':
      return rates.weekly ?? null;
    case 'MONTHLY':
      return rates.monthly ?? null;
    case 'QUARTERLY':
      return rates.quarterly ?? null;
    case 'ANNUALLY':
      return rates.annually ?? null;
    default:
      return null;
  }
}

/**
 * Lookup-only installment premium from stored rate band for the selected frequency.
 * Missing/invalid rates return 0 (do not invent amounts via daily × cadence).
 */
export function computeInstallmentPremium(params: {
  frequency: string;
  daily?: number;
  weekly?: number;
  customDays?: number;
  /** @deprecated Ignored — pricing is always lookup-only. */
  pricingMode?: PricingMode;
  lookupRates?: PricingRateBand;
}): number {
  const { frequency, daily = 0, weekly = 0, lookupRates } = params;
  const rates = lookupRates ?? { daily, weekly };
  const amount = lookupRateForFrequency(frequency, rates);
  if (amount == null || amount <= 0) {
    return 0;
  }
  return Math.round(amount * 100) / 100;
}

/**
 * Annual premium for Products / Payment summary (not the selected-frequency installment).
 * Requires stored `annually` band; returns 0 if missing (lookup-only).
 */
export function computeAnnualPremium(params: {
  daily?: number;
  /** @deprecated Ignored — pricing is always lookup-only. */
  pricingMode?: PricingMode;
  lookupRates?: PricingRateBand;
}): number {
  const { lookupRates } = params;
  const annuallyFromBand = lookupRates?.annually;
  if (annuallyFromBand != null && annuallyFromBand > 0) {
    return Math.round(annuallyFromBand * 100) / 100;
  }
  return 0;
}
