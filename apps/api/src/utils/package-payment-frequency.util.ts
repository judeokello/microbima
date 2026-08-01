import { PaymentFrequency } from '@prisma/client';

export const PACKAGE_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Frequencies that may be configured on a package (CUSTOM excluded). */
export const CONFIGURABLE_PACKAGE_FREQUENCIES: PaymentFrequency[] = [
  PaymentFrequency.DAILY,
  PaymentFrequency.WEEKLY,
  PaymentFrequency.MONTHLY,
  PaymentFrequency.QUARTERLY,
  PaymentFrequency.ANNUALLY,
];

const INSTALLMENT_COUNT_BOUNDS: Partial<
  Record<PaymentFrequency, { min: number; max: number }>
> = {
  [PaymentFrequency.DAILY]: { min: 1, max: 365 },
  [PaymentFrequency.WEEKLY]: { min: 1, max: 52 },
  [PaymentFrequency.MONTHLY]: { min: 1, max: 12 },
  [PaymentFrequency.QUARTERLY]: { min: 1, max: 4 },
  [PaymentFrequency.ANNUALLY]: { min: 1, max: 1 },
};

export function normalizePackageSlug(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidPackageSlug(slug: string): boolean {
  return PACKAGE_SLUG_REGEX.test(slug);
}

export function installmentCountBounds(
  frequency: PaymentFrequency
): { min: number; max: number } | null {
  return INSTALLMENT_COUNT_BOUNDS[frequency] ?? null;
}

export function validateInstallmentCount(
  frequency: PaymentFrequency,
  installmentCount: number
): string | null {
  if (frequency === PaymentFrequency.CUSTOM) {
    return 'CUSTOM frequency cannot be configured on a package';
  }
  const bounds = installmentCountBounds(frequency);
  if (!bounds) {
    return `Unsupported frequency: ${frequency}`;
  }
  if (
    !Number.isInteger(installmentCount) ||
    installmentCount < bounds.min ||
    installmentCount > bounds.max
  ) {
    return `Installment count for ${frequency} must be an integer between ${bounds.min} and ${bounds.max}`;
  }
  return null;
}

/**
 * Nominal last installment date: start + (count - 1) * cadence days (UTC calendar),
 * capped at policyEnd when provided.
 */
export function computeNominalPaymentPeriodEndDate(params: {
  startDate: Date;
  expectedInstallmentCount: number;
  paymentCadence: number;
  policyEndDate?: Date | null;
}): Date {
  const { startDate, expectedInstallmentCount, paymentCadence, policyEndDate } = params;
  const steps = Math.max(0, expectedInstallmentCount - 1);
  const nominal = new Date(startDate);
  nominal.setUTCDate(nominal.getUTCDate() + steps * paymentCadence);

  if (policyEndDate != null && nominal.getTime() > policyEndDate.getTime()) {
    return new Date(policyEndDate);
  }
  return nominal;
}

/** Display “if you start today” end date (local calendar for UI formatting is caller's job). */
export function computeNominalHorizonFromToday(
  expectedInstallmentCount: number,
  paymentCadence: number,
  fromDate: Date = new Date()
): Date {
  return computeNominalPaymentPeriodEndDate({
    startDate: fromDate,
    expectedInstallmentCount,
    paymentCadence,
    policyEndDate: null,
  });
}
