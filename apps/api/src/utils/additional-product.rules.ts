import { CustomerStatus, PolicyStatus } from '@prisma/client';
import { isOccupyingPolicyStatus } from './occupying-policy.util';

export type PolicyEnrolmentSnapshot = {
  id: string;
  packageId: number;
  status: PolicyStatus | string;
  isPostpaid: boolean;
};

export type EnrolmentBlock = {
  ok: false;
  field: string;
  message: string;
};

export type EnrolmentOk = { ok: true };

export function validateAdditionalProductEnrolment(params: {
  customerStatus: CustomerStatus | string;
  policies: PolicyEnrolmentSnapshot[];
  newPackageId: number;
  newIsPostpaid: boolean;
}): EnrolmentOk | EnrolmentBlock {
  if (params.customerStatus === CustomerStatus.TERMINATED) {
    return {
      ok: false,
      field: 'customer',
      message: 'Terminated customers cannot be enrolled in another product',
    };
  }

  if (params.policies.some((p) => p.status === PolicyStatus.TERMINATED)) {
    return {
      ok: false,
      field: 'policy',
      message: 'Customers with a terminated policy cannot be enrolled in another product',
    };
  }

  const occupying = params.policies.filter((p) => isOccupyingPolicyStatus(p.status));
  const occupyingSamePackage = occupying.find((p) => p.packageId === params.newPackageId);
  if (occupyingSamePackage) {
    return {
      ok: false,
      field: 'packageId',
      message:
        'This customer already has an occupying policy for this package. Deactivate it before adding another.',
    };
  }

  const occupyingPostpaid = occupying.some((p) => p.isPostpaid);
  if (params.newIsPostpaid && occupying.length > 0) {
    return {
      ok: false,
      field: 'packageSchemeId',
      message: 'A postpaid product cannot occupy at the same time as another policy',
    };
  }
  if (!params.newIsPostpaid && occupyingPostpaid) {
    return {
      ok: false,
      field: 'packageSchemeId',
      message: 'A prepaid product cannot occupy at the same time as a postpaid policy',
    };
  }

  return { ok: true };
}
