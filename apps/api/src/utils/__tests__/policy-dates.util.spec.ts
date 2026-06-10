import {
  policyDatesFromPayment,
  policyEndDateFromStart,
  policyStartDateFromPayment,
} from '../policy-dates.util';

describe('policy-dates.util', () => {
  it('preserves the full payment timestamp as prepaid startDate', () => {
    const payment = new Date('2025-06-09T14:30:25.123Z');
    expect(policyStartDateFromPayment(payment).toISOString()).toBe('2025-06-09T14:30:25.123Z');
  });

  it('sets endDate to one day before the anniversary with the same time of day', () => {
    const startDate = new Date('2025-06-09T14:30:25.123Z');
    expect(policyEndDateFromStart(startDate).toISOString()).toBe('2026-06-08T14:30:25.123Z');
  });

  it('derives prepaid dates from payment timestamp', () => {
    const payment = new Date('2026-03-19T01:02:25.000Z');
    const { startDate, endDate } = policyDatesFromPayment(payment);

    expect(startDate.toISOString()).toBe('2026-03-19T01:02:25.000Z');
    expect(endDate.toISOString()).toBe('2027-03-18T01:02:25.000Z');
  });
});
