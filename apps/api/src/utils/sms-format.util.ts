import { PaymentType } from '@prisma/client';

const SMS_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  MPESA: 'M-Pesa',
  SASAPAY: 'SasaPay',
  BANK_TRANSFER: 'Bank transfer',
  CHEQUE: 'Cheque',
};

/**
 * Format amount for SMS: "{currency} 1,500" (no decimal cents).
 */
export function formatSmsAmount(amount: number | string, currency: string): string {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  const whole = Number.isFinite(n) ? Math.round(n) : 0;
  const formatted = whole.toLocaleString('en-KE', { maximumFractionDigits: 0 });
  const label = currency.trim() || 'Kes';
  return `${label} ${formatted}`;
}

/**
 * UTC calendar date for SMS: "12 June 2026".
 */
export function formatSmsDate(date: Date): string {
  const day = date.getUTCDate();
  const month = SMS_MONTHS[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

export function formatPaymentType(paymentType: PaymentType | string): string {
  const key = paymentType as PaymentType;
  return PAYMENT_TYPE_LABELS[key] ?? String(paymentType);
}

/**
 * Add calendar days in UTC (for waiting period end date).
 */
export function addUtcCalendarDays(start: Date, days: number): Date {
  const result = new Date(start);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
