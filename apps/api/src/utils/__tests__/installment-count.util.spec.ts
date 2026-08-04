import {
  computeMissedInstallments,
  computePaidInstallments,
  displayInstallmentCount,
  formatInstallmentCount,
} from '../installment-count.util';

describe('installment-count.util', () => {
  describe('formatInstallmentCount', () => {
    it('returns exact integers without tilde', () => {
      expect(formatInstallmentCount(3)).toEqual({ value: 3, approximate: false, exact: 3 });
      expect(displayInstallmentCount(formatInstallmentCount(3))).toBe('3');
    });

    it('ceils fractional ratios and marks approximate', () => {
      const result = formatInstallmentCount(0.9);
      expect(result).toEqual({ value: 1, approximate: true, exact: 0.9 });
      expect(displayInstallmentCount(result)).toBe('~1');
    });
  });

  describe('computePaidInstallments', () => {
    it('uses confirmed amount / premium', () => {
      expect(computePaidInstallments({ installmentAmount: 1000, confirmedPaidTotal: 900 })).toEqual({
        value: 1,
        approximate: true,
        exact: 0.9,
      });
      expect(
        computePaidInstallments({ installmentAmount: 1324, confirmedPaidTotal: 1324 })
      ).toEqual({ value: 1, approximate: false, exact: 1 });
    });

    it('returns 0 when premium is 0', () => {
      expect(computePaidInstallments({ installmentAmount: 0, confirmedPaidTotal: 500 })).toEqual({
        value: 0,
        approximate: false,
        exact: 0,
      });
    });
  });

  describe('computeMissedInstallments', () => {
    it('returns periods due minus paid exact, floored at 0', () => {
      const start = new Date(Date.UTC(2026, 0, 1));
      // 31 inclusive days / cadence 7 → 4 periods
      const asOf = new Date(Date.UTC(2026, 0, 31));
      const missed = computeMissedInstallments({
        policyStart: start,
        asOfUtc: asOf,
        paymentCadenceDays: 7,
        installmentAmount: 100,
        paidExact: 0.9,
      });
      expect(missed.exact).toBeCloseTo(3.1, 8);
      expect(missed.value).toBe(4);
      expect(missed.approximate).toBe(true);
    });

    it('returns 0 when overpaid relative to periods due', () => {
      const start = new Date(Date.UTC(2026, 0, 1));
      const asOf = new Date(Date.UTC(2026, 0, 8)); // 8 days / 7 → 1 period
      const missed = computeMissedInstallments({
        policyStart: start,
        asOfUtc: asOf,
        paymentCadenceDays: 7,
        installmentAmount: 100,
        paidExact: 5,
      });
      expect(missed).toEqual({ value: 0, approximate: false, exact: 0 });
    });
  });
});
