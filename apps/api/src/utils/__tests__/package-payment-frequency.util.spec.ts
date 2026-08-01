/// <reference types="jest" />
import { PaymentFrequency } from '@prisma/client';
import {
  computeNominalPaymentPeriodEndDate,
  isValidPackageSlug,
  normalizePackageSlug,
  validateInstallmentCount,
} from '../package-payment-frequency.util';

describe('package-payment-frequency.util', () => {
  describe('slug', () => {
    it('normalizes and validates slugs', () => {
      expect(normalizePackageSlug(' Mfanisi-Go ')).toBe('mfanisi-go');
      expect(isValidPackageSlug('mfanisi-go')).toBe(true);
      expect(isValidPackageSlug('Mfanisi-Go')).toBe(false);
      expect(isValidPackageSlug('mfanisi_go')).toBe(false);
    });
  });

  describe('validateInstallmentCount', () => {
    it('accepts in-range counts', () => {
      expect(validateInstallmentCount(PaymentFrequency.DAILY, 276)).toBeNull();
      expect(validateInstallmentCount(PaymentFrequency.WEEKLY, 39)).toBeNull();
      expect(validateInstallmentCount(PaymentFrequency.MONTHLY, 9)).toBeNull();
      expect(validateInstallmentCount(PaymentFrequency.ANNUALLY, 1)).toBeNull();
    });

    it('rejects CUSTOM and out-of-range', () => {
      expect(validateInstallmentCount(PaymentFrequency.CUSTOM, 10)).toMatch(/CUSTOM/);
      expect(validateInstallmentCount(PaymentFrequency.WEEKLY, 53)).toMatch(/between/);
      expect(validateInstallmentCount(PaymentFrequency.ANNUALLY, 2)).toMatch(/between/);
    });
  });

  describe('computeNominalPaymentPeriodEndDate', () => {
    it('adds (count-1)*cadence days in UTC and caps at policy end', () => {
      const start = new Date(Date.UTC(2025, 0, 1, 10, 0, 0));
      const end = computeNominalPaymentPeriodEndDate({
        startDate: start,
        expectedInstallmentCount: 3,
        paymentCadence: 7,
      });
      expect(end.toISOString()).toBe('2025-01-15T10:00:00.000Z');

      const policyEnd = new Date(Date.UTC(2025, 0, 10, 10, 0, 0));
      const capped = computeNominalPaymentPeriodEndDate({
        startDate: start,
        expectedInstallmentCount: 3,
        paymentCadence: 7,
        policyEndDate: policyEnd,
      });
      expect(capped.toISOString()).toBe(policyEnd.toISOString());
    });
  });
});
