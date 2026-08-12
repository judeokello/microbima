/**
 * Postpaid scheme coverage dates and member policy date inheritance.
 *
 * Scheme (when postpaid):
 *   - startDate: mandatory on create (UI "Policy start date")
 *   - endDate: start + 1 calendar year − 1 day (UTC)
 *   - nominalPaymentPeriodEndDate: start + (installmentCount − 1) × cadence days
 *
 * Member policy on activation (when scheme.startDate is set):
 *   - Joined on/before scheme start → policy.startDate = scheme.startDate
 *   - Joined after scheme start → policy.startDate = UTC calendar day of join
 *   - policy.endDate / nominalPaymentPeriodEndDate inherited from scheme when present
 */

import { policyEndDateFromStart } from './policy-dates.util';
import { computeNominalPaymentPeriodEndDate } from './package-payment-frequency.util';

export function utcCalendarDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** True when `a`'s UTC calendar day is strictly after `b`'s. */
export function isUtcCalendarDayAfter(a: Date, b: Date): boolean {
  return utcCalendarDay(a).getTime() > utcCalendarDay(b).getTime();
}

export function computeSchemeEndDateFromStart(startDate: Date): Date {
  return policyEndDateFromStart(utcCalendarDay(startDate));
}

export function computeSchemeNominalPaymentPeriodEndDate(params: {
  startDate: Date;
  expectedInstallmentCount: number;
  paymentCadence: number;
}): Date {
  const start = utcCalendarDay(params.startDate);
  const endDate = computeSchemeEndDateFromStart(start);
  return computeNominalPaymentPeriodEndDate({
    startDate: start,
    expectedInstallmentCount: params.expectedInstallmentCount,
    paymentCadence: params.paymentCadence,
    policyEndDate: endDate,
  });
}

export type PostpaidSchemeDateFields = {
  startDate: Date;
  endDate: Date;
  nominalPaymentPeriodEndDate: Date;
};

/** Derive end + nominal from start, cadence, and package installment count. */
export function derivePostpaidSchemeCoverageDates(params: {
  startDate: Date;
  expectedInstallmentCount: number;
  paymentCadence: number;
}): PostpaidSchemeDateFields {
  const startDate = utcCalendarDay(params.startDate);
  const endDate = computeSchemeEndDateFromStart(startDate);
  const nominalPaymentPeriodEndDate = computeSchemeNominalPaymentPeriodEndDate({
    startDate,
    expectedInstallmentCount: params.expectedInstallmentCount,
    paymentCadence: params.paymentCadence,
  });
  return { startDate, endDate, nominalPaymentPeriodEndDate };
}

/**
 * Resolve member policy coverage dates from scheme + enrollment join time.
 * Returns null when scheme has no startDate (legacy schemes — caller falls back).
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
  if (params.schemeStartDate == null) {
    return null;
  }

  const schemeStart = utcCalendarDay(params.schemeStartDate);
  const joined = utcCalendarDay(params.memberJoinedAt);

  const startDate = isUtcCalendarDayAfter(joined, schemeStart) ? joined : schemeStart;

  const endDate =
    params.schemeEndDate != null
      ? utcCalendarDay(params.schemeEndDate)
      : computeSchemeEndDateFromStart(startDate);

  const nominalPaymentPeriodEndDate =
    params.schemeNominalPaymentPeriodEndDate != null
      ? utcCalendarDay(params.schemeNominalPaymentPeriodEndDate)
      : null;

  return { startDate, endDate, nominalPaymentPeriodEndDate };
}
