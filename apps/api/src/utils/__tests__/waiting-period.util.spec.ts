import {
  isWaitingAccessOnDay,
  isWaitingAccessReached,
  waitingAccessDate,
} from '../waiting-period.util';

describe('waiting-period.util', () => {
  const start = new Date('2026-01-01T00:00:00.000Z');

  it('treats zero days as access on the policy start date', () => {
    expect(waitingAccessDate(start, 0).toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(isWaitingAccessReached(start, 0, start)).toBe(true);
    expect(isWaitingAccessOnDay(start, 0, start)).toBe(false);
  });

  it('reaches access on the UTC calendar day start plus waiting days', () => {
    const accessMorning = new Date('2026-01-31T01:00:00.000Z');
    const dayBefore = new Date('2026-01-30T23:00:00.000Z');
    expect(waitingAccessDate(start, 30).toISOString().slice(0, 10)).toBe('2026-01-31');
    expect(isWaitingAccessReached(start, 30, dayBefore)).toBe(false);
    expect(isWaitingAccessReached(start, 30, accessMorning)).toBe(true);
    expect(isWaitingAccessOnDay(start, 30, accessMorning)).toBe(true);
    expect(isWaitingAccessOnDay(start, 30, new Date('2026-02-01T01:00:00.000Z'))).toBe(false);
  });
});
