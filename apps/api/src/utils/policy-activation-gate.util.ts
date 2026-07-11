import { PolicyStatus } from '@prisma/client';
import { ValidationException } from '../exceptions/validation.exception';
import { isPolicyEndDatePassed } from './policy-due-date.util';

/**
 * Shared gate: policy must not become Active after end date, or from terminal statuses.
 * Used by admin activate, payment activation, and restore paths.
 */
export function assertPolicyMayBecomeActive(policy: {
  status: PolicyStatus | string;
  endDate: Date | null | undefined;
}): void {
  if (
    policy.status === PolicyStatus.TERMINATED ||
    policy.status === PolicyStatus.DEACTIVATED ||
    policy.status === PolicyStatus.EXPIRED
  ) {
    throw ValidationException.forField(
      'status',
      'Policy cannot become Active from Terminated, Deactivated, or Expired status'
    );
  }
  if (isPolicyEndDatePassed(policy.endDate)) {
    throw ValidationException.forField(
      'endDate',
      'Policy cannot become Active after the policy end date'
    );
  }
}
