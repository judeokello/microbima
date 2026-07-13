/// <reference types="jest" />
import { PolicyStatus, CustomerStatus } from '@prisma/client';
import { isPolicyEndDatePassed } from '../../utils/policy-due-date.util';
import { assertPolicyMayBecomeActive } from '../../utils/policy-activation-gate.util';
import { ValidationException } from '../../exceptions/validation.exception';

describe('policy lifecycle gates (US3/US5 helpers)', () => {
  it('blocks Active after end date', () => {
    const end = new Date(Date.UTC(2026, 0, 1));
    expect(isPolicyEndDatePassed(end, new Date(Date.UTC(2026, 0, 2)))).toBe(true);
    expect(() =>
      assertPolicyMayBecomeActive({ status: PolicyStatus.SUSPENDED, endDate: end })
    ).toThrow(ValidationException);
  });

  it('blocks terminal statuses from becoming Active', () => {
    expect(() =>
      assertPolicyMayBecomeActive({
        status: PolicyStatus.TERMINATED,
        endDate: null,
      })
    ).toThrow(ValidationException);
    expect(() =>
      assertPolicyMayBecomeActive({
        status: PolicyStatus.EXPIRED,
        endDate: null,
      })
    ).toThrow(ValidationException);
  });

  it('documents Option C open statuses for customer Terminated coupling', () => {
    const open: PolicyStatus[] = [
      PolicyStatus.ACTIVE,
      PolicyStatus.PENDING_ACTIVATION,
      PolicyStatus.SUSPENDED,
    ];
    const remaining = [PolicyStatus.INACTIVE, PolicyStatus.EXPIRED];
    const hasOpen = remaining.some((s) => open.includes(s));
    expect(hasOpen).toBe(false);
    // When no open remain after terminate → customer TERMINATED
    expect(CustomerStatus.TERMINATED).toBe('TERMINATED');
  });
});
