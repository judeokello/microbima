import {
  amountRequiredToRestoreInactive,
  amountRequiredToRestoreSuspended,
  ceilCadencePeriods,
  daysOverdue,
  isPolicyEndDatePassed,
  nextUnpaidExpectedDueDate,
  oneMonthPremiumAmount,
  twoWeekUpfrontAmount,
  utcCalendarDaysBetween,
} from '../policy-due-date.util';

describe('policy-due-date.util', () => {
  describe('ceilCadencePeriods / restore amounts', () => {
    it('computes 2-week and one-month upfront from cadence', () => {
      expect(ceilCadencePeriods(14, 7)).toBe(2);
      expect(twoWeekUpfrontAmount(7, 100)).toBe(200);
      expect(oneMonthPremiumAmount(7, 100)).toBe(500); // ceil(31/7)=5
      expect(amountRequiredToRestoreSuspended({ paymentCadenceDays: 7, installmentAmount: 100, arrears: 50 })).toBe(250);
      expect(
        amountRequiredToRestoreInactive({
          paymentCadenceDays: 7,
          installmentAmount: 100,
          arrears: 50,
          daysSinceInactive: 10,
        })
      ).toBe(250);
      expect(
        amountRequiredToRestoreInactive({
          paymentCadenceDays: 7,
          installmentAmount: 100,
          arrears: 50,
          daysSinceInactive: 31,
        })
      ).toBe(500);
    });
  });

  describe('nextUnpaidExpectedDueDate / overdue', () => {
    it('returns overdue days from unpaid due date', () => {
      const start = new Date(Date.UTC(2026, 0, 1));
      const asOf = new Date(Date.UTC(2026, 0, 20));
      // 19 inclusive days from Jan 1 end-of-day math via periods: floor(19/7)=2 periods due = 200 expected
      const nextDue = nextUnpaidExpectedDueDate({
        policyStart: start,
        paymentCadenceDays: 7,
        installmentAmount: 100,
        paidThroughAsOf: 0,
        asOfUtc: asOf,
      });
      expect(nextDue.toISOString().startsWith('2026-01-01')).toBe(true);
      expect(daysOverdue({ nextUnpaidDueDate: nextDue, asOfUtc: asOf })).toBe(19);
    });

    it('when current mid-period, next due is when the next period accrues (not overdue)', () => {
      // Mar 31 start, cadence 31; as of Aug 5 → floor(128/31)=4 periods expected = 13764
      const start = new Date(Date.UTC(2026, 2, 31));
      const asOf = new Date(Date.UTC(2026, 7, 5));
      const nextDue = nextUnpaidExpectedDueDate({
        policyStart: start,
        paymentCadenceDays: 31,
        installmentAmount: 3441,
        paidThroughAsOf: 16761, // excess vs 13764
        asOfUtc: asOf,
      });
      // Next accrual when inclusiveDays hits 5*31=155 → day offset 154 from start
      expect(nextDue.toISOString().startsWith('2026-09-01')).toBe(true);
      expect(daysOverdue({ nextUnpaidDueDate: nextDue, asOfUtc: asOf })).toBe(0);
    });
  });

  describe('isPolicyEndDatePassed / calendar days', () => {
    it('detects end date and calendar day distance', () => {
      const end = new Date(Date.UTC(2026, 5, 1, 10, 15, 0));
      expect(isPolicyEndDatePassed(end, new Date(Date.UTC(2026, 5, 1, 10, 15, 0)))).toBe(true);
      expect(isPolicyEndDatePassed(end, new Date(Date.UTC(2026, 4, 31)))).toBe(false);
      expect(utcCalendarDaysBetween(new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2026, 0, 31)))).toBe(30);
    });
  });
});
