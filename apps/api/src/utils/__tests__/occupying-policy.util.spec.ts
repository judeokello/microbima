/// <reference types="jest" />
import { evaluateOccupyingProductRules } from '../occupying-policy.util';

describe('evaluateOccupyingProductRules', () => {
  it('blocks same package while occupying', () => {
    const result = evaluateOccupyingProductRules({
      occupying: [{ id: 'p1', packageId: 10, isPostpaid: false }],
      newPackageId: 10,
      newIsPostpaid: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/Deactivate it manually/);
    }
  });

  it('allows two prepaid policies on different packages', () => {
    expect(
      evaluateOccupyingProductRules({
        occupying: [{ id: 'p1', packageId: 10, isPostpaid: false }],
        newPackageId: 20,
        newIsPostpaid: false,
      })
    ).toEqual({ ok: true });
  });

  it('blocks occupying prepaid + add postpaid', () => {
    const result = evaluateOccupyingProductRules({
      occupying: [{ id: 'p1', packageId: 10, isPostpaid: false }],
      newPackageId: 20,
      newIsPostpaid: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/postpaid product while a prepaid/);
    }
  });

  it('blocks occupying postpaid + any additional product', () => {
    const prepaidAdd = evaluateOccupyingProductRules({
      occupying: [{ id: 'p1', packageId: 10, isPostpaid: true }],
      newPackageId: 20,
      newIsPostpaid: false,
    });
    const postpaidAdd = evaluateOccupyingProductRules({
      occupying: [{ id: 'p1', packageId: 10, isPostpaid: true }],
      newPackageId: 20,
      newIsPostpaid: true,
    });
    expect(prepaidAdd.ok).toBe(false);
    expect(postpaidAdd.ok).toBe(false);
  });

  it('allows a new occupying policy when none occupy', () => {
    expect(
      evaluateOccupyingProductRules({
        occupying: [],
        newPackageId: 10,
        newIsPostpaid: true,
      })
    ).toEqual({ ok: true });
  });
});
