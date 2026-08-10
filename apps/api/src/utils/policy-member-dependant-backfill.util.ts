import type { DependantRelationship } from '@prisma/client';

/**
 * Spouse before child, then createdAt ascending — matches PolicyService.orderDependantsForMemberNumbers
 * plus stable chronology for backfill (script) when multiple children exist.
 */
export function orderDependantsForMemberNumberBackfill<
  T extends { relationship: DependantRelationship; createdAt: Date },
>(dependants: T[]): T[] {
  return [...dependants].sort((a, b) => {
    const aIsSpouse = a.relationship === 'SPOUSE' ? 1 : 0;
    const bIsSpouse = b.relationship === 'SPOUSE' ? 1 : 0;
    if (bIsSpouse !== aIsSpouse) return bIsSpouse - aIsSpouse; // Spouse first
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

/**
 * Derive MFG290-01 from principal MFG290-00 + sequence 1.
 * Sequence is 1-based for dependants (principal is 00).
 */
export function memberNumberFromPrincipal(principalMn: string, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error(`Dependant member sequence must be a positive integer, got ${sequence}`);
  }
  if (!/-\d{2}$/.test(principalMn)) {
    throw new Error(`Unexpected principal member number format: ${principalMn}`);
  }
  return principalMn.replace(/-\d{2}$/, `-${String(sequence).padStart(2, '0')}`);
}

export type MissingPmdPlanInput = {
  policyId: string;
  policyNumber: string | null;
  principalMemberNumber: string;
  existingDependantIds: string[];
  missingDependants: Array<{
    id: string;
    relationship: DependantRelationship;
    createdAt: Date;
    firstName: string;
    lastName: string;
  }>;
};

export type MissingPmdPlanRow = {
  policyId: string;
  policyNumber: string | null;
  dependantId: string;
  dependantName: string;
  relationship: DependantRelationship;
  memberNumber: string;
  sequence: number;
};

/** Plan PMD rows for one policy (Sharon / Polycarp / Joseph style gaps). */
export function planMissingPolicyMemberDependants(
  input: MissingPmdPlanInput
): MissingPmdPlanRow[] {
  const missing = orderDependantsForMemberNumberBackfill(input.missingDependants);
  if (missing.length === 0) return [];

  const maxSeq = input.existingDependantIds.length;
  return missing.map((dependant, i) => {
    const sequence = maxSeq + i + 1;
    return {
      policyId: input.policyId,
      policyNumber: input.policyNumber,
      dependantId: dependant.id,
      dependantName: `${dependant.firstName} ${dependant.lastName}`.trim(),
      relationship: dependant.relationship,
      memberNumber: memberNumberFromPrincipal(input.principalMemberNumber, sequence),
      sequence,
    };
  });
}
