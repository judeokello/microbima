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

/** True when `day` is a strictly earlier UTC calendar day than `referenceDay`. */
export function isUtcCalendarDayBefore(day: Date, referenceDay: Date): boolean {
  const d = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
  const r = Date.UTC(referenceDay.getUTCFullYear(), referenceDay.getUTCMonth(), referenceDay.getUTCDate());
  return d < r;
}

export function sumConfirmedPaidThroughAsOf(
  payments: Array<{ amount: unknown; paymentStatus: string; expectedPaymentDate: Date }>,
  policyStartDay: Date,
  asOfEnd: Date,
  confirmedStatuses: readonly string[]
): number {
  return payments
    .filter(
      (pm) =>
        confirmedStatuses.includes(pm.paymentStatus) &&
        pm.expectedPaymentDate >= policyStartDay &&
        pm.expectedPaymentDate <= asOfEnd
    )
    .reduce((sum, pm) => sum + Number(pm.amount), 0);
}

export function computeMissedOrExcess(params: {
  policyStart: Date;
  asOfUtc: Date;
  paymentCadenceDays: number;
  installmentAmount: number;
  payments: Array<{ amount: unknown; paymentStatus: string; expectedPaymentDate: Date }>;
  confirmedStatuses: readonly string[];
}): { premiumDue: number; excessAmount: number } | null {
  if (params.paymentCadenceDays <= 0 || params.installmentAmount <= 0) {
    return null;
  }
  const policyStartDay = utcDayStart(
    params.policyStart.getUTCFullYear(),
    params.policyStart.getUTCMonth(),
    params.policyStart.getUTCDate()
  );
  const asOfEnd = utcDayEnd(
    params.asOfUtc.getUTCFullYear(),
    params.asOfUtc.getUTCMonth(),
    params.asOfUtc.getUTCDate()
  );
  const { expectedPremium } = computeExpectedPremiumThroughAsOf({
    policyStart: params.policyStart,
    statementGenerationUtc: params.asOfUtc,
    paymentCadenceDays: params.paymentCadenceDays,
    installmentAmount: params.installmentAmount,
  });
  const paidThroughAsOf = sumConfirmedPaidThroughAsOf(
    params.payments,
    policyStartDay,
    asOfEnd,
    params.confirmedStatuses
  );
  return computePremiumDueAndExcess(expectedPremium, paidThroughAsOf);
}

export function formatMissedPaymentsAmountSide(
  result: { premiumDue: number; excessAmount: number } | null
): { amountMissed: string; excessAmount: string | null } {
  if (!result) {
    return { amountMissed: '—', excessAmount: null };
  }
  return {
    amountMissed: result.premiumDue.toFixed(2),
    excessAmount: result.excessAmount > 0 ? result.excessAmount.toFixed(2) : null,
  };
}
