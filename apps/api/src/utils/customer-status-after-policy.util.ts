import { CustomerStatus } from '@prisma/client';

export function nextCustomerStatusAfterPolicies(params: {
  customerStatus: CustomerStatus;
  hasActive: boolean;
  hasPending: boolean;
  hasSuspended: boolean;
  whenNoOpenPolicies?: CustomerStatus;
}): CustomerStatus | null {
  const {
    customerStatus,
    hasActive,
    hasPending,
    hasSuspended,
    whenNoOpenPolicies = CustomerStatus.DEACTIVATED,
  } = params;

  if (hasActive) {
    if (
      customerStatus === CustomerStatus.DEACTIVATED ||
      customerStatus === CustomerStatus.SUSPENDED ||
      customerStatus === CustomerStatus.TERMINATED ||
      customerStatus === CustomerStatus.PENDING_ACTIVATION
    ) {
      return CustomerStatus.ACTIVE;
    }
    return null;
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
    return customerStatus === CustomerStatus.SUSPENDED ? null : CustomerStatus.SUSPENDED;
  }

  return whenNoOpenPolicies === customerStatus ? null : whenNoOpenPolicies;
}
