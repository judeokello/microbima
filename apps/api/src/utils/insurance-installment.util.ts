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
    case 'ANNUALLY':
      return rates.annually ?? null;
    default:
      return null;
  }
}

export function computeInstallmentPremium(params: {
  frequency: string;
  daily: number;
  weekly: number;
  customDays?: number;
  pricingMode?: PricingMode;
  lookupRates?: PricingRateBand;
}): number {
  const {
    frequency,
    daily,
    weekly,
    customDays,
    pricingMode = 'extrapolate',
    lookupRates,
  } = params;

  if (pricingMode === 'lookup') {
    const rates = lookupRates ?? { daily, weekly };
    const amount = lookupRateForFrequency(frequency, rates);
    if (amount == null || amount <= 0) {
      return 0;
    }
    return Math.round(amount * 100) / 100;
  }

  if (frequency === 'WEEKLY') {
    return weekly;
  }
  const cadence = cadenceDaysForFrequency(frequency, customDays);
  if (cadence <= 0 || daily <= 0) {
    return 0;
  }
  return Math.round(daily * cadence * 100) / 100;
}
