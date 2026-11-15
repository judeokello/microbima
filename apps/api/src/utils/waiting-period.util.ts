import { addUtcCalendarDays } from './sms-format.util';

/** UTC calendar day as YYYY-MM-DD. */
export function utcCalendarDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Treatment access date: policy start plus the scheme waiting period, in UTC calendar days.
 * Zero days means the start date itself.
 */
export function waitingAccessDate(startDate: Date, waitingDays: number): Date {
  return addUtcCalendarDays(startDate, waitingDays);
}

/** True when the access date is on or before `asOf` (UTC calendar days). Zero days is always reached. */
export function isWaitingAccessReached(
  startDate: Date,
  waitingDays: number,
  asOf: Date,
): boolean {
  if (waitingDays <= 0) return true;
  return utcCalendarDay(waitingAccessDate(startDate, waitingDays)) <= utcCalendarDay(asOf);
}

/** True only on the UTC calendar day treatment access begins. Zero days is never "today" for the ended SMS. */
export function isWaitingAccessOnDay(
  startDate: Date,
  waitingDays: number,
  asOf: Date,
): boolean {
  if (waitingDays <= 0) return false;
  return utcCalendarDay(waitingAccessDate(startDate, waitingDays)) === utcCalendarDay(asOf);
}
