import { computeExpectedPremiumThroughAsOf } from './premium-statement-math';
import { CONFIRMED_PAYMENT_STATUSES } from './policy-payment-filters';

export type InstallmentCountDisplay = {
  /** Ceil of exact ratio when approximate; otherwise the exact integer */
  value: number;
  /** True when amount/premium (or periods − paid) is not an integer */
  approximate: boolean;
  /** Exact ratio before ceil (for tests / further math) */
  exact: number;
};

/**
 * Format installments from an exact non-negative ratio:
 * - integer → value as-is, approximate false
 * - fractional → ceil, approximate true (display as ~N)
 */
export function formatInstallmentCount(exact: number): InstallmentCountDisplay {
  if (!Number.isFinite(exact) || exact <= 0) {
    return { value: 0, approximate: false, exact: 0 };
  }
  const nearestInt = Math.round(exact);
  const isInteger = Math.abs(exact - nearestInt) < 1e-9;
  if (isInteger) {
    return { value: nearestInt, approximate: false, exact: nearestInt };
  }
  return { value: Math.ceil(exact), approximate: true, exact };
}

export function displayInstallmentCount(count: InstallmentCountDisplay): string {
  if (count.value === 0 && !count.approximate) {
    return '0';
  }
  return count.approximate ? `~${count.value}` : String(count.value);
}

/**
 * Paid installments = sum(confirmed amounts) / installment premium.
 */
export function computePaidInstallments(params: {
  installmentAmount: number;
  confirmedPaidTotal: number;
}): InstallmentCountDisplay {
  const { installmentAmount, confirmedPaidTotal } = params;
  if (installmentAmount <= 0 || confirmedPaidTotal <= 0) {
    return { value: 0, approximate: false, exact: 0 };
  }
  return formatInstallmentCount(confirmedPaidTotal / installmentAmount);
}

/**
 * Missed installments as of today = max(0, periodsDue − paidExact).
 * Overpayment → 0 (no excess shown as missed count).
 */
export function computeMissedInstallments(params: {
  policyStart: Date | null;
  asOfUtc: Date;
  paymentCadenceDays: number;
  installmentAmount: number;
  paidExact: number;
  expectedInstallmentCount?: number | null;
}): InstallmentCountDisplay {
  const {
    policyStart,
    asOfUtc,
    paymentCadenceDays,
    installmentAmount,
    paidExact,
    expectedInstallmentCount,
  } = params;
  if (
    policyStart == null ||
    paymentCadenceDays <= 0 ||
    installmentAmount <= 0
  ) {
    return { value: 0, approximate: false, exact: 0 };
  }
  const { periods } = computeExpectedPremiumThroughAsOf({
    policyStart,
    statementGenerationUtc: asOfUtc,
    paymentCadenceDays,
    installmentAmount,
    expectedInstallmentCount,
  });
  const missedExact = Math.max(0, periods - paidExact);
  return formatInstallmentCount(missedExact);
}

export function sumConfirmedPaymentAmounts(
  payments: Array<{ amount: unknown; paymentStatus: string }>
): number {
  return payments
    .filter((pm) =>
      (CONFIRMED_PAYMENT_STATUSES as readonly string[]).includes(pm.paymentStatus)
    )
    .reduce((sum, pm) => sum + Number(pm.amount), 0);
}

export function countConfirmedPayments(
  payments: Array<{ paymentStatus: string }>
): number {
  return payments.filter((pm) =>
    (CONFIRMED_PAYMENT_STATUSES as readonly string[]).includes(pm.paymentStatus)
  ).length;
}
