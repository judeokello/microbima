import { PaymentStatus, Prisma } from '@prisma/client';

/** Confirmed/paid statuses that count toward premium math (never includes DETACHED). */
export const CONFIRMED_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.COMPLETED,
  PaymentStatus.COMPLETED_PENDING_RECEIPT,
];

/** Default Prisma where: exclude soft-detached payments. */
export function notDetachedPaymentWhere(): Prisma.PolicyPaymentWhereInput {
  return { detachedAt: null };
}

/** Confirmed + not detached — use for paid-through / installment math queries. */
export function confirmedActivePaymentWhere(): Prisma.PolicyPaymentWhereInput {
  return {
    paymentStatus: { in: [...CONFIRMED_PAYMENT_STATUSES] },
    detachedAt: null,
  };
}

export function isActivePolicyPayment(p: {
  detachedAt?: Date | string | null;
  paymentStatus?: PaymentStatus | string;
}): boolean {
  if (p.detachedAt != null) return false;
  if (p.paymentStatus === PaymentStatus.DETACHED || p.paymentStatus === 'DETACHED') {
    return false;
  }
  return true;
}

export function filterActivePolicyPayments<
  T extends { detachedAt?: Date | string | null; paymentStatus?: PaymentStatus | string },
>(payments: T[]): T[] {
  return payments.filter(isActivePolicyPayment);
}
