/**
 * Policy coverage dates derived from completed payments.
 *
 * Prepaid:
 *   - startDate: earliest completed payment timestamp (UTC, time preserved)
 *   - endDate: startDate + 1 calendar year − 1 day (same time of day)
 *
 * Postpaid:
 *   - Scheme bulk payments may exist before a member joins, and later uploads may
 *     not include them. Only bulk-upload rows for THIS member count.
 *   - startDate: actualPaymentDate of the earliest policy_payment linked to a
 *     postpaid_scheme_payment_item (first CSV upload they contributed to)
 *   - endDate: same end rule from that startDate
 */

export function policyStartDateFromPayment(paymentDate: Date): Date {
  return new Date(paymentDate);
}

export function policyEndDateFromStart(startDate: Date): Date {
  const endDate = new Date(startDate);
  endDate.setUTCFullYear(endDate.getUTCFullYear() + 1);
  endDate.setUTCDate(endDate.getUTCDate() - 1);
  return endDate;
}

export function policyDatesFromPayment(paymentDate: Date): {
  startDate: Date;
  endDate: Date;
} {
  const startDate = policyStartDateFromPayment(paymentDate);
  const endDate = policyEndDateFromStart(startDate);
  return { startDate, endDate };
}
