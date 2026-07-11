/**
 * Policy due-date and restore-amount helpers for payment lifecycle (UTC calendar days).
 * Next unpaid expected due date is derived from startDate + paymentCadence coverage.
 */

import {
  computeExpectedPremiumThroughAsOf,
  computePremiumDueAndExcess,
  utcDayStart,
  utcInclusiveCalendarDays,
} from './premium-statement-math';
import { addUtcCalendarDays } from './installment-backfill.util';

export function ceilCadencePeriods(daysNeeded: number, paymentCadenceDays: number): number {
  if (paymentCadenceDays <= 0) {
    throw new Error('paymentCadenceDays must be positive');
  }
  return Math.ceil(daysNeeded / paymentCadenceDays);
}

/** 2-week upfront = ceil(14 / cadence) × installment */
export function twoWeekUpfrontAmount(
  paymentCadenceDays: number,
  installmentAmount: number
): number {
  return ceilCadencePeriods(14, paymentCadenceDays) * installmentAmount;
}

/** One month ≈ ceil(31 / cadence) × installment */
export function oneMonthPremiumAmount(
  paymentCadenceDays: number,
  installmentAmount: number
): number {
  return ceilCadencePeriods(31, paymentCadenceDays) * installmentAmount;
}

export function utcCalendarDaysBetween(from: Date, to: Date): number {
  const a = utcDayStart(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = utcDayStart(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

/**
 * Earliest installment slot start that is not fully covered by confirmed paid amount
 * through `asOf`, using the same period counting as premium-statement math.
 *
 * If current through `asOf` is fully paid (no arrears), returns the next future slot start.
 */
export function nextUnpaidExpectedDueDate(params: {
  policyStart: Date;
  paymentCadenceDays: number;
  installmentAmount: number;
  paidThroughAsOf: number;
  asOfUtc?: Date;
}): Date {
  const asOf = params.asOfUtc ?? new Date();
  const start = utcDayStart(
    params.policyStart.getUTCFullYear(),
    params.policyStart.getUTCMonth(),
    params.policyStart.getUTCDate()
  );
  const { periods: periodsDue, expectedPremium } = computeExpectedPremiumThroughAsOf({
    policyStart: start,
    statementGenerationUtc: asOf,
    paymentCadenceDays: params.paymentCadenceDays,
    installmentAmount: params.installmentAmount,
  });

  const { premiumDue } = computePremiumDueAndExcess(expectedPremium, params.paidThroughAsOf);
  const paidPeriods = Math.floor(params.paidThroughAsOf / params.installmentAmount);

  if (premiumDue > 0) {
    // First unpaid period index (0-based): paidPeriods
    return addUtcCalendarDays(start, paidPeriods * params.paymentCadenceDays);
  }

  // Fully paid through asOf — next due is the next slot after periodsDue
  return addUtcCalendarDays(start, periodsDue * params.paymentCadenceDays);
}

export function daysOverdue(params: {
  nextUnpaidDueDate: Date;
  asOfUtc?: Date;
}): number {
  const asOf = params.asOfUtc ?? new Date();
  const days = utcCalendarDaysBetween(params.nextUnpaidDueDate, asOf);
  return Math.max(0, days);
}

export function outstandingArrears(params: {
  policyStart: Date;
  paymentCadenceDays: number;
  installmentAmount: number;
  paidThroughAsOf: number;
  asOfUtc?: Date;
}): number {
  const asOf = params.asOfUtc ?? new Date();
  const { expectedPremium } = computeExpectedPremiumThroughAsOf({
    policyStart: params.policyStart,
    statementGenerationUtc: asOf,
    paymentCadenceDays: params.paymentCadenceDays,
    installmentAmount: params.installmentAmount,
  });
  return computePremiumDueAndExcess(expectedPremium, params.paidThroughAsOf).premiumDue;
}

/** Suspended restore before end: arrears + 2 weeks upfront */
export function amountRequiredToRestoreSuspended(params: {
  paymentCadenceDays: number;
  installmentAmount: number;
  arrears: number;
}): number {
  return params.arrears + twoWeekUpfrontAmount(params.paymentCadenceDays, params.installmentAmount);
}

/**
 * Inactive restore before end:
 * - within 30 days of becoming inactive: arrears + 2 weeks
 * - after 30 days: one month premium
 */
export function amountRequiredToRestoreInactive(params: {
  paymentCadenceDays: number;
  installmentAmount: number;
  arrears: number;
  daysSinceInactive: number;
}): number {
  if (params.daysSinceInactive <= 30) {
    return amountRequiredToRestoreSuspended(params);
  }
  return oneMonthPremiumAmount(params.paymentCadenceDays, params.installmentAmount);
}

export function isPolicyEndDatePassed(endDate: Date | null | undefined, asOfUtc?: Date): boolean {
  if (endDate == null) return false;
  const asOf = asOfUtc ?? new Date();
  return asOf.getTime() >= endDate.getTime();
}

/** Re-export for callers that need inclusive day math */
export { utcInclusiveCalendarDays };
