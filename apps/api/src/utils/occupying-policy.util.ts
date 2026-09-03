import { PolicyStatus } from '@prisma/client';

/** Statuses that occupy a package / payment-account slot. */
export const OCCUPYING_POLICY_STATUSES: PolicyStatus[] = [
  PolicyStatus.ACTIVE,
  PolicyStatus.PENDING_ACTIVATION,
  PolicyStatus.SUSPENDED,
];

/** Historical rows that may still hold paymentAcNumber and can yield it. */
export const STEALABLE_PAN_STATUSES: PolicyStatus[] = [
  PolicyStatus.EXPIRED,
  PolicyStatus.DEACTIVATED,
  PolicyStatus.INACTIVE,
];

export type OccupyingPolicyBilling = {
  id: string;
  packageId: number;
  isPostpaid: boolean;
};

export type OccupyingProductRuleResult =
  | { ok: true }
  | { ok: false; field: string; message: string };

/**
 * Occupying uniqueness:
 * - one occupying policy per package
 * - two prepaid different packages allowed
 * - occupying postpaid blocks any additional occupying policy
 * - occupying prepaid blocks adding postpaid
 */
export function evaluateOccupyingProductRules(params: {
  occupying: OccupyingPolicyBilling[];
  newPackageId: number;
  newIsPostpaid: boolean;
}): OccupyingProductRuleResult {
  const { occupying, newPackageId, newIsPostpaid } = params;

  const samePackage = occupying.find((p) => p.packageId === newPackageId);
  if (samePackage) {
    return {
      ok: false,
      field: 'packageId',
      message:
        'Customer already has an occupying policy for this package. Deactivate it manually before adding the same package again.',
    };
  }

  const occupyingPostpaid = occupying.some((p) => p.isPostpaid);
  if (occupyingPostpaid) {
    return {
      ok: false,
      field: 'packageId',
      message:
        'Customer already has an occupying postpaid policy. Add product is blocked until that postpaid policy is expired, deactivated, or inactive.',
    };
  }

  const occupyingPrepaid = occupying.some((p) => !p.isPostpaid);
  if (newIsPostpaid && occupyingPrepaid) {
    return {
      ok: false,
      field: 'packageId',
      message:
        'Cannot add a postpaid product while a prepaid policy is occupying. Deactivate the prepaid policy first.',
    };
  }

  return { ok: true };
}
