import { CustomerStatus, PolicyStatus } from '@prisma/client';
import { validateAdditionalProductEnrolment } from '../additional-product.rules';

describe('validateAdditionalProductEnrolment', () => {
  const prepaidA = {
    id: 'p1',
    packageId: 1,
    status: PolicyStatus.ACTIVE,
    isPostpaid: false,
  };

  it('blocks terminated customers', () => {
    const result = validateAdditionalProductEnrolment({
      customerStatus: CustomerStatus.TERMINATED,
      policies: [],
      newPackageId: 2,
      newIsPostpaid: false,
    });
    expect(result.ok).toBe(false);
  });

  it('blocks when any policy is terminated', () => {
    const result = validateAdditionalProductEnrolment({
      customerStatus: CustomerStatus.ACTIVE,
      policies: [{ ...prepaidA, status: PolicyStatus.TERMINATED }],
      newPackageId: 2,
      newIsPostpaid: false,
    });
    expect(result.ok).toBe(false);
  });

  it('blocks same package while occupying', () => {
    const result = validateAdditionalProductEnrolment({
      customerStatus: CustomerStatus.ACTIVE,
      policies: [prepaidA],
      newPackageId: 1,
      newIsPostpaid: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe('packageId');
  });

  it('allows two prepaid products on different packages', () => {
    const result = validateAdditionalProductEnrolment({
      customerStatus: CustomerStatus.ACTIVE,
      policies: [prepaidA],
      newPackageId: 2,
      newIsPostpaid: false,
    });
    expect(result).toEqual({ ok: true });
  });

  it('blocks postpaid while any occupying policy exists', () => {
    const result = validateAdditionalProductEnrolment({
      customerStatus: CustomerStatus.ACTIVE,
      policies: [prepaidA],
      newPackageId: 2,
      newIsPostpaid: true,
    });
    expect(result.ok).toBe(false);
  });

  it('blocks prepaid while a postpaid policy is occupying', () => {
    const result = validateAdditionalProductEnrolment({
      customerStatus: CustomerStatus.ACTIVE,
      policies: [{ ...prepaidA, isPostpaid: true }],
      newPackageId: 2,
      newIsPostpaid: false,
    });
    expect(result.ok).toBe(false);
  });

  it('allows same package when the old policy is expired', () => {
    const result = validateAdditionalProductEnrolment({
      customerStatus: CustomerStatus.DEACTIVATED,
      policies: [{ ...prepaidA, status: PolicyStatus.EXPIRED }],
      newPackageId: 1,
      newIsPostpaid: false,
    });
    expect(result).toEqual({ ok: true });
  });
});
