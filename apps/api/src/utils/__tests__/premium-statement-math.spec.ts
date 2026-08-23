/// <reference types="jest" />
import { PaymentStatus } from '@prisma/client';
import {
  computeExpectedPremiumThroughAsOf,
  computeMissedOrExcess,
  computePremiumDueAndExcess,
  computePremiumMoneyTarget,
  formatMissedPaymentsAmountSide,
  isPremiumMoneyComplete,
  isUtcCalendarDayBefore,
  parseYmdToUtcEnd,
  parseYmdToUtcStart,
  sumConfirmedPaidThroughAsOf,
  utcDayEnd,
  utcDayStart,
  utcInclusiveCalendarDays,
} from '../premium-statement-math';

const CONFIRMED = [PaymentStatus.COMPLETED, PaymentStatus.COMPLETED_PENDING_RECEIPT];

describe('premium-statement-math', () => {
  describe('utcInclusiveCalendarDays', () => {
    it('returns 1 for the same UTC calendar day', () => {
      const a = new Date(Date.UTC(2025, 0, 15, 3, 0, 0));
      const b = new Date(Date.UTC(2025, 0, 15, 22, 0, 0));
      expect(utcInclusiveCalendarDays(a, b)).toBe(1);
    });

    it('counts inclusive days across month boundaries', () => {
      const start = new Date(Date.UTC(2025, 0, 1, 0, 0, 0));
      const end = new Date(Date.UTC(2025, 0, 31, 23, 59, 59));
      expect(utcInclusiveCalendarDays(start, end)).toBe(31);
    });

    it('returns non-positive when end calendar day is before start', () => {
      const start = new Date(Date.UTC(2025, 1, 10, 0, 0, 0));
      const end = new Date(Date.UTC(2025, 0, 5, 0, 0, 0));
      expect(utcInclusiveCalendarDays(start, end)).toBeLessThanOrEqual(0);
    });
  });

  describe('parseYmdToUtcStart / parseYmdToUtcEnd', () => {
    it('parses Y-M-D to UTC day boundaries', () => {
      const start = parseYmdToUtcStart('2025-06-10');
      const end = parseYmdToUtcEnd('2025-06-10');
      expect(start.toISOString()).toBe('2025-06-10T00:00:00.000Z');
      expect(end.toISOString()).toBe('2025-06-10T23:59:59.999Z');
    });
  });

  describe('computeExpectedPremiumThroughAsOf', () => {
    it('uses statement generation calendar day as as-of (not a separate toDate filter)', () => {
      const policyStart = new Date(Date.UTC(2025, 0, 1, 8, 30, 0));
      const statementGenerationUtc = new Date(Date.UTC(2025, 0, 1, 18, 0, 0));
      const { inclusiveDays, periods, expectedPremium } = computeExpectedPremiumThroughAsOf({
        policyStart,
        statementGenerationUtc,
        paymentCadenceDays: 30,
        installmentAmount: 500,
      });
      expect(inclusiveDays).toBe(1);
      expect(periods).toBe(0);
      expect(expectedPremium).toBe(0);
    });

    it('computes periods as floor(inclusiveDays / cadence) × installment', () => {
      const policyStart = new Date(Date.UTC(2025, 0, 1, 0, 0, 0));
      const statementGenerationUtc = new Date(Date.UTC(2025, 1, 1, 12, 0, 0));
      const { inclusiveDays, periods, expectedPremium } = computeExpectedPremiumThroughAsOf({
        policyStart,
        statementGenerationUtc,
        paymentCadenceDays: 30,
        installmentAmount: 100,
      });
      expect(inclusiveDays).toBe(32);
      expect(periods).toBe(1);
      expect(expectedPremium).toBe(100);
    });

    it('handles cadence dividing evenly into inclusive days', () => {
      const policyStart = new Date(Date.UTC(2025, 0, 1, 0, 0, 0));
      const statementGenerationUtc = new Date(Date.UTC(2025, 2, 2, 0, 0, 0));
      const { periods, expectedPremium } = computeExpectedPremiumThroughAsOf({
        policyStart,
        statementGenerationUtc,
        paymentCadenceDays: 30,
        installmentAmount: 200,
      });
      expect(periods).toBe(2);
      expect(expectedPremium).toBe(400);
    });

    it('caps periods at expectedInstallmentCount so calendar days past schedule do not invent debt', () => {
      // Nathaniel-style: daily 152, eic 276 → money target 41952; far past nominal end
      const policyStart = new Date(Date.UTC(2025, 10, 1, 0, 0, 0)); // 2025-11-01
      const asOfFarPast = new Date(Date.UTC(2026, 7, 23, 12, 0, 0)); // ~295 days later
      const uncapped = computeExpectedPremiumThroughAsOf({
        policyStart,
        statementGenerationUtc: asOfFarPast,
        paymentCadenceDays: 1,
        installmentAmount: 152,
      });
      expect(uncapped.periods).toBeGreaterThan(276);
      expect(uncapped.expectedPremium).toBeGreaterThan(41952);

      const capped = computeExpectedPremiumThroughAsOf({
        policyStart,
        statementGenerationUtc: asOfFarPast,
        paymentCadenceDays: 1,
        installmentAmount: 152,
        expectedInstallmentCount: 276,
      });
      expect(capped.periods).toBe(276);
      expect(capped.expectedPremium).toBe(41952);
    });

    it('does not raise periods when calendar periods are below eic', () => {
      const policyStart = new Date(Date.UTC(2025, 0, 1, 0, 0, 0));
      const asOf = new Date(Date.UTC(2025, 0, 10, 12, 0, 0));
      const { periods, expectedPremium } = computeExpectedPremiumThroughAsOf({
        policyStart,
        statementGenerationUtc: asOf,
        paymentCadenceDays: 1,
        installmentAmount: 100,
        expectedInstallmentCount: 276,
      });
      expect(periods).toBe(10);
      expect(expectedPremium).toBe(1000);
    });
  });

  describe('computePremiumMoneyTarget / isPremiumMoneyComplete', () => {
    it('returns eic × premium for prepaid targets', () => {
      expect(computePremiumMoneyTarget(276, 152)).toBe(41952);
    });

    it('returns null when eic or premium cannot form a target', () => {
      expect(computePremiumMoneyTarget(null, 152)).toBeNull();
      expect(computePremiumMoneyTarget(276, 0)).toBeNull();
      expect(computePremiumMoneyTarget(0, 152)).toBeNull();
    });

    it('is complete when paid covers money target (Nathaniel paid in full)', () => {
      expect(
        isPremiumMoneyComplete({
          paidTotal: 41952,
          expectedInstallmentCount: 276,
          installmentAmount: 152,
        })
      ).toBe(true);
      expect(
        isPremiumMoneyComplete({
          paidTotal: 41951,
          expectedInstallmentCount: 276,
          installmentAmount: 152,
        })
      ).toBe(false);
    });
  });

  describe('computePremiumDueAndExcess', () => {
    it('returns premium due when paid is below expected', () => {
      expect(computePremiumDueAndExcess(1000, 400)).toEqual({ premiumDue: 600, excessAmount: 0 });
    });

    it('returns zero due and zero excess when paid equals expected', () => {
      expect(computePremiumDueAndExcess(1000, 1000)).toEqual({ premiumDue: 0, excessAmount: 0 });
    });

    it('returns excess when paid exceeds expected (both magnitudes positive)', () => {
      expect(computePremiumDueAndExcess(1000, 1500)).toEqual({ premiumDue: 0, excessAmount: 500 });
    });
  });

  describe('isUtcCalendarDayBefore', () => {
    it('returns true when day is before reference calendar day', () => {
      const day = new Date(Date.UTC(2025, 0, 10));
      const ref = new Date(Date.UTC(2025, 0, 15));
      expect(isUtcCalendarDayBefore(day, ref)).toBe(true);
    });

    it('returns false for same or later calendar day', () => {
      const day = new Date(Date.UTC(2025, 0, 15));
      const ref = new Date(Date.UTC(2025, 0, 10));
      expect(isUtcCalendarDayBefore(day, ref)).toBe(false);
    });
  });

  describe('sumConfirmedPaidThroughAsOf', () => {
    const policyStart = utcDayStart(2025, 0, 1);
    const asOfEnd = utcDayEnd(2025, 0, 31);

    it('sums only confirmed payments within expectedPaymentDate window', () => {
      const payments = [
        {
          amount: 100,
          paymentStatus: PaymentStatus.COMPLETED,
          expectedPaymentDate: utcDayStart(2025, 0, 5),
        },
        {
          amount: 50,
          paymentStatus: PaymentStatus.PENDING_STK_CALLBACK,
          expectedPaymentDate: utcDayStart(2025, 0, 10),
        },
        {
          amount: 200,
          paymentStatus: PaymentStatus.COMPLETED,
          expectedPaymentDate: utcDayStart(2025, 1, 5),
        },
      ];
      expect(sumConfirmedPaidThroughAsOf(payments, policyStart, asOfEnd, CONFIRMED)).toBe(100);
    });
  });

  describe('computeMissedOrExcess', () => {
    const policyStart = new Date(Date.UTC(2025, 0, 1, 0, 0, 0));

    it('returns lower missed amount when as-of is earlier (fewer expected periods)', () => {
      const asOfJan15 = new Date(Date.UTC(2025, 0, 15, 12, 0, 0));
      const asOfFeb1 = new Date(Date.UTC(2025, 1, 1, 12, 0, 0));
      const earlier = computeMissedOrExcess({
        policyStart,
        asOfUtc: asOfJan15,
        paymentCadenceDays: 30,
        installmentAmount: 100,
        payments: [],
        confirmedStatuses: CONFIRMED,
      });
      const later = computeMissedOrExcess({
        policyStart,
        asOfUtc: asOfFeb1,
        paymentCadenceDays: 30,
        installmentAmount: 100,
        payments: [],
        confirmedStatuses: CONFIRMED,
      });
      expect(earlier).toEqual({ premiumDue: 0, excessAmount: 0 });
      expect(later).toEqual({ premiumDue: 100, excessAmount: 0 });
    });

    it('returns null for invalid cadence or installment', () => {
      expect(
        computeMissedOrExcess({
          policyStart,
          asOfUtc: new Date(),
          paymentCadenceDays: 0,
          installmentAmount: 100,
          payments: [],
          confirmedStatuses: CONFIRMED,
        })
      ).toBeNull();
    });

    it('shows zero missed when paid equals money target even far past schedule', () => {
      const start = new Date(Date.UTC(2025, 10, 1, 0, 0, 0));
      const asOf = new Date(Date.UTC(2026, 7, 23, 12, 0, 0));
      const payments = [
        {
          amount: 41952,
          paymentStatus: PaymentStatus.COMPLETED,
          expectedPaymentDate: utcDayStart(2025, 10, 1),
        },
      ];
      const withoutCap = computeMissedOrExcess({
        policyStart: start,
        asOfUtc: asOf,
        paymentCadenceDays: 1,
        installmentAmount: 152,
        payments,
        confirmedStatuses: CONFIRMED,
      });
      expect(withoutCap!.premiumDue).toBeGreaterThan(0);

      const withCap = computeMissedOrExcess({
        policyStart: start,
        asOfUtc: asOf,
        paymentCadenceDays: 1,
        installmentAmount: 152,
        payments,
        confirmedStatuses: CONFIRMED,
        expectedInstallmentCount: 276,
      });
      expect(withCap).toEqual({ premiumDue: 0, excessAmount: 0 });
    });
  });

  describe('formatMissedPaymentsAmountSide', () => {
    it('formats missed and excess sides', () => {
      expect(formatMissedPaymentsAmountSide({ premiumDue: 600, excessAmount: 0 })).toEqual({
        amountMissed: '600.00',
        excessAmount: null,
      });
      expect(formatMissedPaymentsAmountSide({ premiumDue: 0, excessAmount: 500 })).toEqual({
        amountMissed: '0.00',
        excessAmount: '500.00',
      });
      expect(formatMissedPaymentsAmountSide(null)).toEqual({
        amountMissed: '—',
        excessAmount: null,
      });
    });
  });
});
