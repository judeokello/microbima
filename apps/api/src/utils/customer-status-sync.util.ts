import { CustomerStatus } from '@prisma/client';

/**
 * Decide the next customer status after a policy change.
 * Unpaid extra PENDING_ACTIVATION policies must not flip SUSPENDED / DEACTIVATED / TERMINATED.
 * An ACTIVE policy can move DEACTIVATED / PENDING_ACTIVATION / SUSPENDED (and similar) to ACTIVE.
 */
export function nextCustomerStatusAfterPolicies(params: {
  customerStatus: CustomerStatus;
  hasActive: boolean;
  hasPending: boolean;
  hasSuspended: boolean;
  closedStatus: CustomerStatus;
}): CustomerStatus | null {
  const { customerStatus, hasActive, hasPending, hasSuspended, closedStatus } = params;

  if (hasActive) {
    if (customerStatus === CustomerStatus.ACTIVE) {
      return null;
    }
    return CustomerStatus.ACTIVE;
  }

  if (hasPending) {
    if (
      customerStatus === CustomerStatus.SUSPENDED ||
      customerStatus === CustomerStatus.DEACTIVATED ||
      customerStatus === CustomerStatus.TERMINATED
    ) {
      return null;
    }
    if (customerStatus !== CustomerStatus.PENDING_ACTIVATION) {
      return CustomerStatus.PENDING_ACTIVATION;
    }
    return null;
  }

  if (hasSuspended) {
    if (customerStatus !== CustomerStatus.SUSPENDED) {
      return CustomerStatus.SUSPENDED;
    }
    return null;
  }

  if (customerStatus === closedStatus) {
    return null;
  }
  return closedStatus;
}
