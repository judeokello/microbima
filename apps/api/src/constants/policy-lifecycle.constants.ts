/**
 * Policy payment lifecycle thresholds (UTC calendar days).
 *
 * Overdue is measured from the next unpaid expected due date:
 *   1–14  → grace (still ACTIVE)
 *   >14   → SUSPENDED
 *   ≥15 days suspended → INACTIVE
 *
 * Monthly cadence (31 days): that due date is the day the installment becomes
 * expected (the month mark). The 14-day grace then runs after the month mark,
 * and suspension is the first daily run more than 14 days later.
 */
export const GRACE_OVERDUE_MAX_DAYS = 14;
export const SUSPEND_OVERDUE_AFTER_DAYS = 14;
/** Days in SUSPENDED before auto-transition to INACTIVE (was 30). */
export const INACTIVE_AFTER_SUSPENDED_DAYS = 15;
