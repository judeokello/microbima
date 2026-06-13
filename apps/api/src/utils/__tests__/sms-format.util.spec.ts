import { formatPaymentType, formatSmsAmount, formatSmsDate, addUtcCalendarDays } from '../sms-format.util';

describe('sms-format.util', () => {
  describe('formatSmsAmount', () => {
    it('formats with currency prefix and thousands separator', () => {
      expect(formatSmsAmount(1500, 'Kes')).toBe('Kes 1,500');
    });

    it('rounds decimal amounts', () => {
      expect(formatSmsAmount(1500.7, 'Kes')).toBe('Kes 1,501');
    });
  });

  describe('formatSmsDate', () => {
    it('formats UTC calendar date', () => {
      const d = new Date(Date.UTC(2026, 5, 12, 14, 30, 0));
      expect(formatSmsDate(d)).toBe('12 June 2026');
    });
  });

  describe('formatPaymentType', () => {
    it('maps MPESA to M-Pesa', () => {
      expect(formatPaymentType('MPESA')).toBe('M-Pesa');
    });
  });

  describe('addUtcCalendarDays', () => {
    it('adds calendar days in UTC', () => {
      const start = new Date(Date.UTC(2026, 0, 1));
      const end = addUtcCalendarDays(start, 30);
      expect(formatSmsDate(end)).toBe('31 January 2026');
    });
  });
});
