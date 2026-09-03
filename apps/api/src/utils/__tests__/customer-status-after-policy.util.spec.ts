/// <reference types="jest" />
import { CustomerStatus } from '@prisma/client';
import { nextCustomerStatusAfterPolicies } from '../customer-status-after-policy.util';

describe('nextCustomerStatusAfterPolicies', () => {
  it('leaves SUSPENDED unchanged when only a pending extra policy exists', () => {
    expect(
      nextCustomerStatusAfterPolicies({
        customerStatus: CustomerStatus.SUSPENDED,
        hasActive: false,
        hasPending: true,
        hasSuspended: true,
      })
    ).toBeNull();
  });

  it('leaves DEACTIVATED unchanged when an unpaid extra policy is pending', () => {
    expect(
      nextCustomerStatusAfterPolicies({
        customerStatus: CustomerStatus.DEACTIVATED,
        hasActive: false,
        hasPending: true,
        hasSuspended: false,
      })
    ).toBeNull();
  });

  it('moves DEACTIVATED to ACTIVE when a policy is paid and active', () => {
    expect(
      nextCustomerStatusAfterPolicies({
        customerStatus: CustomerStatus.DEACTIVATED,
        hasActive: true,
        hasPending: true,
        hasSuspended: false,
      })
    ).toBe(CustomerStatus.ACTIVE);
  });

  it('moves PENDING_ACTIVATION to ACTIVE when a policy becomes active', () => {
    expect(
      nextCustomerStatusAfterPolicies({
        customerStatus: CustomerStatus.PENDING_ACTIVATION,
        hasActive: true,
        hasPending: false,
        hasSuspended: false,
      })
    ).toBe(CustomerStatus.ACTIVE);
  });
});
