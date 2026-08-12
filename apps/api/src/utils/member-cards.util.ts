import { PolicyStatus } from '@prisma/client';

/**
 * Member cards are issued only after policy activation (first premium payment),
 * when principal member numbers are assigned.
 */
export function policyHasMemberCards(params: {
  status: string;
  principalMemberNumber: string | null | undefined;
}): boolean {
  if (params.status === PolicyStatus.PENDING_ACTIVATION) {
    return false;
  }
  return Boolean(params.principalMemberNumber?.trim());
}
