/**
 * Policy payment lifecycle thresholds (UTC calendar days).
 *
 * Timeline from first overdue day:
 *   1–14  → grace (still ACTIVE)
 *   >14   → SUSPENDED
 *   ≥15 days suspended → INACTIVE (~30 days from first overdue total)
 */
export const GRACE_OVERDUE_MAX_DAYS = 14;
export const SUSPEND_OVERDUE_AFTER_DAYS = 14;
/** Days in SUSPENDED before auto-transition to INACTIVE (was 30). */
export const INACTIVE_AFTER_SUSPENDED_DAYS = 15;
