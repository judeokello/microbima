/**
 * Maps payment frequency to cadence days (must match API PAYMENT_CADENCE).
 * CUSTOM requires an explicit cadenceDays argument.
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

/**
 * Installment amount stored on Policy.premium.
 * - extrapolate: WEEKLY uses weekly rate; other frequencies use daily × cadence days.
 * - lookup: use table rate for the selected frequency (no daily×cadence).
 */
export function computeInstallmentPremium(params: {
  frequency: string;
  daily: number;
  weekly: number;
  customDays?: number;
  pricingMode?: PricingMode;
  /** Full rate band when pricingMode is lookup (category + spouse already summed by caller, or pass categoryRates + spouseRates). */
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

/** Path to package pricing JSON under public/. */
export function productPricingPath(packageSlug: string): string {
  return `/product-pricing/${packageSlug}-pricing.json`;
}

/** Nominal payment end if coverage/payments start on `fromDate` (UTC calendar day adds). */
export function computeNominalHorizonFromToday(
  expectedInstallmentCount: number,
  paymentCadence: number,
  fromDate: Date = new Date()
): Date {
  const steps = Math.max(0, expectedInstallmentCount - 1);
  const end = new Date(fromDate);
  end.setUTCDate(end.getUTCDate() + steps * paymentCadence);
  return end;
}
