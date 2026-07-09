import { PaymentStatus } from '@prisma/client';
import {
  computeInstallmentBackfillSlots,
  buildOutstandingTransactionReference,
} from '../installment-backfill.util';

describe('installment-backfill.util', () => {
  it('creates slots for missed weekly periods after daily payments migrated', () => {
    const startDate = new Date(Date.UTC(2026, 0, 26, 10, 0, 0));
    const endDate = new Date(Date.UTC(2027, 0, 25, 10, 0, 0));
    const asOf = new Date(Date.UTC(2026, 1, 22, 12, 0, 0));

    const existingPayments = [
      {
        id: 1,
        expectedPaymentDate: new Date(Date.UTC(2026, 0, 26)),
        actualPaymentDate: new Date(Date.UTC(2026, 0, 26)),
        paymentStatus: PaymentStatus.COMPLETED,
      },
      {
        id: 2,
        expectedPaymentDate: new Date(Date.UTC(2026, 0, 27)),
        actualPaymentDate: new Date(Date.UTC(2026, 0, 27)),
        paymentStatus: PaymentStatus.COMPLETED,
      },
    ];

    const slots = computeInstallmentBackfillSlots({
      policyId: 'abc-def-1234-5678',
      startDate,
      endDate,
      paymentCadence: 7,
      premium: 980,
      asOfUtc: asOf,
      existingPayments,
    });

    expect(slots.length).toBeGreaterThan(0);
    expect(buildOutstandingTransactionReference('abc-def-1234-5678', 0)).toMatch(
      /^OUTSTANDING-/
    );
  });

  it('returns no slots when every period is covered', () => {
    const startDate = new Date(Date.UTC(2026, 0, 1));
    const endDate = new Date(Date.UTC(2027, 0, 0));
    const asOf = new Date(Date.UTC(2026, 0, 7));

    const existingPayments = [
      {
        id: 1,
        expectedPaymentDate: startDate,
        actualPaymentDate: startDate,
        paymentStatus: PaymentStatus.COMPLETED,
      },
    ];

    const slots = computeInstallmentBackfillSlots({
      policyId: 'p1',
      startDate,
      endDate,
      paymentCadence: 7,
      premium: 100,
      asOfUtc: asOf,
      existingPayments,
    });

    expect(slots).toHaveLength(0);
  });
});
