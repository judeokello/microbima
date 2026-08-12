/// <reference types="jest" />
import {
  computeSchemeEndDateFromStart,
  computeSchemeNominalPaymentPeriodEndDate,
  derivePostpaidSchemeCoverageDates,
  isUtcCalendarDayAfter,
  resolvePostpaidMemberPolicyDates,
  utcCalendarDay,
} from '../postpaid-scheme-dates.util';

describe('postpaid-scheme-dates.util', () => {
  describe('utcCalendarDay / isUtcCalendarDayAfter', () => {
    it('normalizes to UTC midnight', () => {
      const d = new Date(Date.UTC(2026, 6, 14, 15, 30, 0));
      expect(utcCalendarDay(d).toISOString()).toBe('2026-07-14T00:00:00.000Z');
    });

    it('compares calendar days only', () => {
      const earlier = new Date(Date.UTC(2026, 6, 7, 23, 0, 0));
      const later = new Date(Date.UTC(2026, 6, 8, 1, 0, 0));
      expect(isUtcCalendarDayAfter(later, earlier)).toBe(true);
      expect(isUtcCalendarDayAfter(earlier, later)).toBe(false);
      expect(isUtcCalendarDayAfter(earlier, earlier)).toBe(false);
    });
  });

  describe('scheme coverage derivation', () => {
    it('end date is start + 1 year − 1 day', () => {
      const start = new Date(Date.UTC(2026, 6, 7));
      expect(computeSchemeEndDateFromStart(start).toISOString()).toBe(
        '2027-07-06T00:00:00.000Z'
      );
    });

    it('nominal end is start + (count − 1) × cadence, capped at end', () => {
      const start = new Date(Date.UTC(2026, 6, 7));
      const nominal = computeSchemeNominalPaymentPeriodEndDate({
        startDate: start,
        expectedInstallmentCount: 39,
        paymentCadence: 7,
      });
      // 7 Jul 2026 + 38*7 = 30 Mar 2027
      expect(nominal.toISOString()).toBe('2027-03-30T00:00:00.000Z');
    });

    it('derivePostpaidSchemeCoverageDates returns all three fields', () => {
      const derived = derivePostpaidSchemeCoverageDates({
        startDate: new Date(Date.UTC(2026, 6, 7, 12, 0, 0)),
        expectedInstallmentCount: 39,
        paymentCadence: 7,
      });
      expect(derived.startDate.toISOString()).toBe('2026-07-07T00:00:00.000Z');
      expect(derived.endDate.toISOString()).toBe('2027-07-06T00:00:00.000Z');
      expect(derived.nominalPaymentPeriodEndDate.toISOString()).toBe(
        '2027-03-30T00:00:00.000Z'
      );
    });
  });

  describe('resolvePostpaidMemberPolicyDates', () => {
    const schemeStart = new Date(Date.UTC(2026, 6, 7));
    const schemeEnd = new Date(Date.UTC(2027, 6, 6));
    const schemeNominal = new Date(Date.UTC(2027, 2, 30));

    it('returns null when scheme has no startDate (legacy fallback)', () => {
      expect(
        resolvePostpaidMemberPolicyDates({
          schemeStartDate: null,
          schemeEndDate: schemeEnd,
          schemeNominalPaymentPeriodEndDate: schemeNominal,
          memberJoinedAt: new Date(Date.UTC(2026, 6, 10)),
        })
      ).toBeNull();
    });

    it('uses scheme start for members joined on or before scheme start', () => {
      const r = resolvePostpaidMemberPolicyDates({
        schemeStartDate: schemeStart,
        schemeEndDate: schemeEnd,
        schemeNominalPaymentPeriodEndDate: schemeNominal,
        memberJoinedAt: new Date(Date.UTC(2026, 6, 2, 10, 0, 0)),
      });
      expect(r?.startDate.toISOString()).toBe('2026-07-07T00:00:00.000Z');
      expect(r?.endDate.toISOString()).toBe('2027-07-06T00:00:00.000Z');
      expect(r?.nominalPaymentPeriodEndDate?.toISOString()).toBe(
        '2027-03-30T00:00:00.000Z'
      );
    });

    it('uses scheme start when joined same calendar day as scheme start', () => {
      const r = resolvePostpaidMemberPolicyDates({
        schemeStartDate: schemeStart,
        schemeEndDate: schemeEnd,
        schemeNominalPaymentPeriodEndDate: schemeNominal,
        memberJoinedAt: new Date(Date.UTC(2026, 6, 7, 18, 0, 0)),
      });
      expect(r?.startDate.toISOString()).toBe('2026-07-07T00:00:00.000Z');
    });

    it('uses join day for members enjoined after scheme start', () => {
      const r = resolvePostpaidMemberPolicyDates({
        schemeStartDate: schemeStart,
        schemeEndDate: schemeEnd,
        schemeNominalPaymentPeriodEndDate: schemeNominal,
        memberJoinedAt: new Date(Date.UTC(2026, 6, 29, 9, 0, 0)),
      });
      expect(r?.startDate.toISOString()).toBe('2026-07-29T00:00:00.000Z');
      expect(r?.endDate.toISOString()).toBe('2027-07-06T00:00:00.000Z');
      expect(r?.nominalPaymentPeriodEndDate?.toISOString()).toBe(
        '2027-03-30T00:00:00.000Z'
      );
    });

    it('derives end from member start when scheme end is missing', () => {
      const r = resolvePostpaidMemberPolicyDates({
        schemeStartDate: schemeStart,
        schemeEndDate: null,
        schemeNominalPaymentPeriodEndDate: null,
        memberJoinedAt: new Date(Date.UTC(2026, 6, 29)),
      });
      expect(r?.startDate.toISOString()).toBe('2026-07-29T00:00:00.000Z');
      expect(r?.endDate.toISOString()).toBe('2027-07-28T00:00:00.000Z');
      expect(r?.nominalPaymentPeriodEndDate).toBeNull();
    });
  });
});
