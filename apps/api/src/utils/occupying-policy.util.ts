import { PolicyStatus } from '@prisma/client';

/** Policies that currently hold a payment account / block same-package enrolment. */
export const OCCUPYING_POLICY_STATUSES: PolicyStatus[] = [
  PolicyStatus.ACTIVE,
  PolicyStatus.PENDING_ACTIVATION,
  PolicyStatus.SUSPENDED,
];

export const STEALABLE_PAYMENT_AC_STATUSES: PolicyStatus[] = [
  PolicyStatus.EXPIRED,
  PolicyStatus.DEACTIVATED,
  PolicyStatus.INACTIVE,
];

export function isOccupyingPolicyStatus(status: PolicyStatus | string): boolean {
  return (OCCUPYING_POLICY_STATUSES as string[]).includes(status);
}
