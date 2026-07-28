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

export function cadenceDaysForFrequency(frequency: string, customDays?: number): number {
  if (frequency === 'CUSTOM') {
    return customDays != null && customDays > 0 ? customDays : 0;
  }
  return PAYMENT_CADENCE_DAYS[frequency] ?? 0;
}

/**
 * Installment amount stored on Policy.premium.
 * WEEKLY uses the pricing-table weekly rate; all other frequencies use daily × cadence days.
 */
export function computeInstallmentPremium(params: {
  frequency: string;
  daily: number;
  weekly: number;
  customDays?: number;
}): number {
  const { frequency, daily, weekly, customDays } = params;
  if (frequency === 'WEEKLY') {
    return weekly;
  }
  const cadence = cadenceDaysForFrequency(frequency, customDays);
  if (cadence <= 0 || daily <= 0) {
    return 0;
  }
  return Math.round(daily * cadence * 100) / 100;
}
