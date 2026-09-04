import { CustomerStatus } from '@prisma/client';
import { nextCustomerStatusAfterPolicies } from '../customer-status-sync.util';

describe('nextCustomerStatusAfterPolicies', () => {
  it('does not flip SUSPENDED to PENDING_ACTIVATION for an unpaid extra policy', () => {
    expect(
      nextCustomerStatusAfterPolicies({
        customerStatus: CustomerStatus.SUSPENDED,
        hasActive: false,
        hasPending: true,
        hasSuspended: true,
        closedStatus: CustomerStatus.DEACTIVATED,
      })
    ).toBeNull();
  });

  it('does not flip DEACTIVATED to PENDING_ACTIVATION for an unpaid extra policy', () => {
    expect(
      nextCustomerStatusAfterPolicies({
        customerStatus: CustomerStatus.DEACTIVATED,
        hasActive: false,
        hasPending: true,
        hasSuspended: false,
        closedStatus: CustomerStatus.DEACTIVATED,
      })
    ).toBeNull();
  });

  it('moves PENDING_ACTIVATION to ACTIVE when a policy is active after payment', () => {
    expect(
      nextCustomerStatusAfterPolicies({
        customerStatus: CustomerStatus.PENDING_ACTIVATION,
        hasActive: true,
        hasPending: true,
        hasSuspended: false,
        closedStatus: CustomerStatus.DEACTIVATED,
      })
    ).toBe(CustomerStatus.ACTIVE);
  });

  it('moves DEACTIVATED to ACTIVE when a new policy is paid', () => {
    expect(
      nextCustomerStatusAfterPolicies({
        customerStatus: CustomerStatus.DEACTIVATED,
        hasActive: true,
        hasPending: false,
        hasSuspended: false,
        closedStatus: CustomerStatus.DEACTIVATED,
      })
    ).toBe(CustomerStatus.ACTIVE);
  });
});
