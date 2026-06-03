/**
 * Pure helpers for premium statement financial math (UTC calendar semantics).
 * Used by {@link PremiumStatementService} and unit-tested in isolation (T034).
 */

export function utcDayStart(y: number, monthIndex0: number, day: number): Date {
  return new Date(Date.UTC(y, monthIndex0, day, 0, 0, 0, 0));
}

export function utcDayEnd(y: number, monthIndex0: number, day: number): Date {
  return new Date(Date.UTC(y, monthIndex0, day, 23, 59, 59, 999));
}

/** Inclusive calendar days between two UTC calendar dates (date parts only). */
export function utcInclusiveCalendarDays(start: Date, end: Date): number {
  const s = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const e = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.floor((e - s) / 86400000) + 1;
}

export function parseYmdToUtcStart(yyyyMmDd: string): Date {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  return utcDayStart(y, m - 1, d);
}

export function parseYmdToUtcEnd(yyyyMmDd: string): Date {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  return utcDayEnd(y, m - 1, d);
}

/**
 * Expected premium through statement as-of (generation calendar day end UTC), per research:
 * periods = floor(inclusiveDays / paymentCadenceDays), expected = periods × installmentAmount.
 */
export function computeExpectedPremiumThroughAsOf(params: {
  policyStart: Date;
  statementGenerationUtc: Date;
  paymentCadenceDays: number;
  installmentAmount: number;
}): { inclusiveDays: number; periods: number; expectedPremium: number } {
  const policyStartStart = utcDayStart(
    params.policyStart.getUTCFullYear(),
    params.policyStart.getUTCMonth(),
    params.policyStart.getUTCDate()
  );
  const asOfEnd = utcDayEnd(
    params.statementGenerationUtc.getUTCFullYear(),
    params.statementGenerationUtc.getUTCMonth(),
    params.statementGenerationUtc.getUTCDate()
  );
  const inclusiveDays = Math.max(0, utcInclusiveCalendarDays(policyStartStart, asOfEnd));
  const periods = Math.floor(inclusiveDays / params.paymentCadenceDays);
  const expectedPremium = periods * params.installmentAmount;
  return { inclusiveDays, periods, expectedPremium };
}

export function computePremiumDueAndExcess(
  expectedPremium: number,
  paidThroughAsOf: number
): { premiumDue: number; excessAmount: number } {
  return {
    premiumDue: Math.max(0, expectedPremium - paidThroughAsOf),
    excessAmount: Math.max(0, paidThroughAsOf - expectedPremium),
  };
}
