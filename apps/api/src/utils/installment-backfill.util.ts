import { PaymentStatus } from '@prisma/client';
import { utcDayEnd, utcDayStart } from './premium-statement-math';

const CONFIRMED: PaymentStatus[] = [
  PaymentStatus.COMPLETED,
  PaymentStatus.COMPLETED_PENDING_RECEIPT,
];

export interface InstallmentBackfillPayment {
  id: number;
  expectedPaymentDate: Date;
  actualPaymentDate: Date | null;
  paymentStatus: PaymentStatus;
}

export interface InstallmentBackfillParams {
  policyId: string;
  startDate: Date;
  endDate: Date;
  paymentCadence: number;
  premium: number;
  asOfUtc?: Date;
  existingPayments: InstallmentBackfillPayment[];
}

export interface InstallmentBackfillSlot {
  periodIndex: number;
  slotStart: Date;
  slotEnd: Date;
}

/** UTC calendar day offset (add days to UTC date parts). */
export function addUtcCalendarDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function installmentWindowForSlot(slotStart: Date, paymentCadence: number): { start: Date; end: Date } {
  const start = utcDayStart(
    slotStart.getUTCFullYear(),
    slotStart.getUTCMonth(),
    slotStart.getUTCDate()
  );
  const end = utcDayEnd(
    addUtcCalendarDays(start, paymentCadence - 1).getUTCFullYear(),
    addUtcCalendarDays(start, paymentCadence - 1).getUTCMonth(),
    addUtcCalendarDays(start, paymentCadence - 1).getUTCDate()
  );
  return { start, end };
}

function paymentCoversWindow(
  payment: InstallmentBackfillPayment,
  windowStart: Date,
  windowEnd: Date
): boolean {
  if (!CONFIRMED.includes(payment.paymentStatus) || payment.actualPaymentDate == null) {
    return false;
  }
  const anchor = payment.actualPaymentDate ?? payment.expectedPaymentDate;
  const day = utcDayStart(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate());
  return day.getTime() >= windowStart.getTime() && day.getTime() <= windowEnd.getTime();
}

function hasOutstandingForSlot(
  payments: InstallmentBackfillPayment[],
  slotStart: Date
): boolean {
  const slotDay = utcDayStart(
    slotStart.getUTCFullYear(),
    slotStart.getUTCMonth(),
    slotStart.getUTCDate()
  );
  return payments.some(
    (p) =>
      p.paymentStatus === PaymentStatus.OUTSTANDING &&
      utcDayStart(
        p.expectedPaymentDate.getUTCFullYear(),
        p.expectedPaymentDate.getUTCMonth(),
        p.expectedPaymentDate.getUTCDate()
      ).getTime() === slotDay.getTime()
  );
}

/** Enumerate installment slots that need OUTSTANDING placeholders. */
export function computeInstallmentBackfillSlots(
  params: InstallmentBackfillParams
): InstallmentBackfillSlot[] {
  if (params.paymentCadence <= 0 || params.premium <= 0) {
    return [];
  }

  const asOf = params.asOfUtc ?? new Date();
  const asOfEnd = utcDayEnd(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  const policyEnd = utcDayEnd(
    params.endDate.getUTCFullYear(),
    params.endDate.getUTCMonth(),
    params.endDate.getUTCDate()
  );
  const deadlineEnd = asOfEnd.getTime() <= policyEnd.getTime() ? asOfEnd : policyEnd;

  let slotStart = utcDayStart(
    params.startDate.getUTCFullYear(),
    params.startDate.getUTCMonth(),
    params.startDate.getUTCDate()
  );
  // Preserve time-of-day from policy start for first slot expectedPaymentDate
  const startTime = params.startDate;

  const slots: InstallmentBackfillSlot[] = [];
  let periodIndex = 0;

  while (slotStart.getTime() <= deadlineEnd.getTime()) {
    const { start: windowStart, end: windowEnd } = installmentWindowForSlot(
      slotStart,
      params.paymentCadence
    );

    const covered = params.existingPayments.some((p) =>
      paymentCoversWindow(p, windowStart, windowEnd)
    );
    const outstandingExists = hasOutstandingForSlot(params.existingPayments, slotStart);

    if (!covered && !outstandingExists) {
      const slotDate = periodIndex === 0 ? new Date(startTime) : new Date(slotStart);
      slots.push({
        periodIndex,
        slotStart: slotDate,
        slotEnd: windowEnd,
      });
    }

    slotStart = addUtcCalendarDays(slotStart, params.paymentCadence);
    periodIndex++;
  }

  return slots;
}

export function buildOutstandingTransactionReference(policyId: string, periodIndex: number): string {
  const shortId = policyId.replace(/-/g, '').slice(0, 12);
  return `OUTSTANDING-${shortId}-${periodIndex}`;
}
