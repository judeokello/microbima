import {
  CONFIRMED_PAYMENT_STATUSES,
  confirmedActivePaymentWhere,
  filterActivePolicyPayments,
  isActivePolicyPayment,
  notDetachedPaymentWhere,
} from '../policy-payment-filters';
import { PaymentStatus } from '@prisma/client';

describe('policy-payment-filters', () => {
  it('exports confirmed statuses without DETACHED', () => {
    expect(CONFIRMED_PAYMENT_STATUSES).toEqual([
      PaymentStatus.COMPLETED,
      PaymentStatus.COMPLETED_PENDING_RECEIPT,
    ]);
    expect(CONFIRMED_PAYMENT_STATUSES).not.toContain(PaymentStatus.DETACHED);
  });

  it('notDetachedPaymentWhere requires detachedAt null', () => {
    expect(notDetachedPaymentWhere()).toEqual({ detachedAt: null });
  });

  it('confirmedActivePaymentWhere combines confirmed + not detached', () => {
    expect(confirmedActivePaymentWhere()).toEqual({
      paymentStatus: { in: CONFIRMED_PAYMENT_STATUSES },
      detachedAt: null,
    });
  });

  it('isActivePolicyPayment rejects detached rows', () => {
    expect(isActivePolicyPayment({ detachedAt: null, paymentStatus: PaymentStatus.COMPLETED })).toBe(
      true
    );
    expect(
      isActivePolicyPayment({ detachedAt: new Date(), paymentStatus: PaymentStatus.COMPLETED })
    ).toBe(false);
    expect(
      isActivePolicyPayment({ detachedAt: null, paymentStatus: PaymentStatus.DETACHED })
    ).toBe(false);
  });

  it('filterActivePolicyPayments drops detached', () => {
    const rows = [
      { id: 1, detachedAt: null, paymentStatus: PaymentStatus.COMPLETED },
      { id: 2, detachedAt: new Date(), paymentStatus: PaymentStatus.DETACHED },
    ];
    expect(filterActivePolicyPayments(rows).map((r) => r.id)).toEqual([1]);
  });
});
