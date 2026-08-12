/**
 * Maps payment frequency to cadence days (must match API PAYMENT_CADENCE).
 * CUSTOM requires an explicit cadenceDays argument.
 * Pricing amounts are lookup-only (no extrapolate).
 */
export const PAYMENT_CADENCE_DAYS: Record<string, number> = {
  DAILY: 1,
  WEEKLY: 7,
  MONTHLY: 31,
  QUARTERLY: 90,
  ANNUALLY: 365,
};

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
 * Installment amount stored on Policy.premium — lookup-only from stored band.
 */
export function computeInstallmentPremium(params: {
  frequency: string;
  daily?: number;
  weekly?: number;
  customDays?: number;
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
 * Annual premium for Products / Payment summary — stored annually band only.
 */
export function computeAnnualPremium(params: {
  daily?: number;
  lookupRates?: PricingRateBand;
}): number {
  const annuallyFromBand = params.lookupRates?.annually;
  if (annuallyFromBand != null && annuallyFromBand > 0) {
    return Math.round(annuallyFromBand * 100) / 100;
  }
  return 0;
}

/** Coverage end: start + 1 calendar year − 1 day (UTC). */
export function policyEndDateFromStart(startDate: Date): Date {
  const endDate = new Date(
    Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate())
  );
  endDate.setUTCFullYear(endDate.getUTCFullYear() + 1);
  endDate.setUTCDate(endDate.getUTCDate() - 1);
  return endDate;
}

/** Nominal payment end if coverage/payments start on `fromDate` (UTC calendar day adds). */
export function computeNominalHorizonFromToday(
  expectedInstallmentCount: number,
  paymentCadence: number,
  fromDate: Date = new Date()
): Date {
  const start = new Date(
    Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate())
  );
  const steps = Math.max(0, expectedInstallmentCount - 1);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + steps * paymentCadence);
  const coverageEnd = policyEndDateFromStart(start);
  return end.getTime() > coverageEnd.getTime() ? coverageEnd : end;
}

/** Derive postpaid scheme end + nominal labels from start + package frequency config. */
export function derivePostpaidSchemeDateLabels(params: {
  startDateYmd: string;
  installmentCount: number;
  paymentCadence: number;
}): { endDate: Date; nominalPaymentPeriodEndDate: Date } | null {
  const raw = params.startDateYmd.trim();
  if (!raw) return null;
  const start = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) return null;
  if (params.installmentCount <= 0 || params.paymentCadence <= 0) return null;
  return {
    endDate: policyEndDateFromStart(start),
    nominalPaymentPeriodEndDate: computeNominalHorizonFromToday(
      params.installmentCount,
      params.paymentCadence,
      start
    ),
  };
}

function utcCalendarDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Member policy dates for postpaid schemes (mirrors API resolvePostpaidMemberPolicyDates):
 * join on/before scheme start → scheme start; later join → join day;
 * end + nominal inherited from scheme when present.
 */
export function resolvePostpaidMemberPolicyDates(params: {
  schemeStartDate: Date | null | undefined;
  schemeEndDate: Date | null | undefined;
  schemeNominalPaymentPeriodEndDate: Date | null | undefined;
  memberJoinedAt: Date;
}): {
  startDate: Date;
  endDate: Date;
  nominalPaymentPeriodEndDate: Date | null;
} | null {
  if (params.schemeStartDate == null) return null;

  const schemeStart = utcCalendarDay(params.schemeStartDate);
  const joined = utcCalendarDay(params.memberJoinedAt);
  const startDate =
    joined.getTime() > schemeStart.getTime() ? joined : schemeStart;

  const endDate =
    params.schemeEndDate != null
      ? utcCalendarDay(params.schemeEndDate)
      : policyEndDateFromStart(startDate);

  const nominalPaymentPeriodEndDate =
    params.schemeNominalPaymentPeriodEndDate != null
      ? utcCalendarDay(params.schemeNominalPaymentPeriodEndDate)
      : null;

  return { startDate, endDate, nominalPaymentPeriodEndDate };
}

export type PackagePaymentFrequencyOption = {
  frequency: string;
  installmentCount: number;
};

/** True when submit must be blocked due to missing pricing setup. */
export function isPricingSubmitBlocked(
  pricingLoadError: string | null | undefined,
  pricingData: unknown
): boolean {
  return Boolean(pricingLoadError) || pricingData == null;
}

/** Frequency options for dropdowns driven by package config (no hardcoded CUSTOM). */
export function packageFrequencySelectOptions(
  paymentFrequencies: PackagePaymentFrequencyOption[] | null | undefined
): PackagePaymentFrequencyOption[] {
  return [...(paymentFrequencies ?? [])];
}

/**
 * Modify-product installment count rule:
 * - same frequency + prior count → copy prior
 * - otherwise → use package row for the new frequency
 */
export function resolveModifyExpectedInstallmentCount(params: {
  selectedFrequency: string;
  priorFrequency: string;
  priorExpectedInstallmentCount: number | null | undefined;
  packageFrequencies: PackagePaymentFrequencyOption[];
}): number | null {
  const {
    selectedFrequency,
    priorFrequency,
    priorExpectedInstallmentCount,
    packageFrequencies,
  } = params;

  if (
    selectedFrequency === priorFrequency &&
    priorExpectedInstallmentCount != null &&
    priorExpectedInstallmentCount > 0
  ) {
    return priorExpectedInstallmentCount;
  }

  const row = packageFrequencies.find((pf) => pf.frequency === selectedFrequency);
  return row?.installmentCount ?? null;
}

export function isFrequencySupportedByPackage(
  frequency: string,
  paymentFrequencies: PackagePaymentFrequencyOption[] | null | undefined
): boolean {
  return (paymentFrequencies ?? []).some((pf) => pf.frequency === frequency);
}

/**
 * Next premium input value after pricing inputs change.
 * Returns null when unchanged so callers can bail out of setState and avoid update loops.
 */
export function nextInstallmentPremiumFormValue(
  currentPremium: string,
  params: Parameters<typeof computeInstallmentPremium>[0]
): string | null {
  const next = computeInstallmentPremium(params).toString();
  return next === currentPremium ? null : next;
}
