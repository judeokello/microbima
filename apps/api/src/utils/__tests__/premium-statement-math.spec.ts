/// <reference types="jest" />
import {
  computeExpectedPremiumThroughAsOf,
  computePremiumDueAndExcess,
  parseYmdToUtcEnd,
  parseYmdToUtcStart,
  utcInclusiveCalendarDays,
} from '../premium-statement-math';

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
});
