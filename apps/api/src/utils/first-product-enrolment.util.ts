import type { DependantRelationship, ParentRelationship } from '@prisma/client';
import {
  memberNumberFromPrincipal,
  orderDependantsForMemberNumberBackfill,
} from './policy-member-dependant-backfill.util';

const PARENT_RELATIONSHIP_ORDER: ParentRelationship[] = [
  'MOTHER',
  'FATHER',
  'MOTHER_IN_LAW',
  'FATHER_IN_LAW',
];

export type SiblingPolicySnapshot = {
  packageId: number;
  createdAt: Date;
};

/**
 * First product = this policy's package is the customer's original enrolment.
 * Another package created earlier means this policy is an additional product;
 * empty or subset policy_member_* rows are then intentional.
 */
export function isFirstProductEnrolment(params: {
  packageId: number;
  createdAt: Date;
  otherPolicies: SiblingPolicySnapshot[];
}): boolean {
  return !params.otherPolicies.some(
    (other) =>
      other.packageId !== params.packageId &&
      other.createdAt.getTime() < params.createdAt.getTime()
  );
}

export function orderParentsForMemberNumberBackfill<
  T extends { relationship: ParentRelationship; createdAt?: Date },
>(parents: T[]): T[] {
  return [...parents].sort((a, b) => {
    const ai = PARENT_RELATIONSHIP_ORDER.indexOf(a.relationship);
    const bi = PARENT_RELATIONSHIP_ORDER.indexOf(b.relationship);
    if (ai !== bi) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    const at = a.createdAt?.getTime() ?? 0;
    const bt = b.createdAt?.getTime() ?? 0;
    return at - bt;
  });
}

export type PlannedHouseholdMember = {
  id: string;
  memberNumber: string;
  sequence: number;
  currentMemberNumber: string | null;
};

export type CanonicalHouseholdPlan = {
  principalMemberNumber: string;
  dependants: PlannedHouseholdMember[];
  parents: PlannedHouseholdMember[];
  needsRepair: boolean;
};

/**
 * Principal 00, then spouses, then children, then parents.
 * Re-issues numbers in that order even when a parent already holds 01.
 */
export function planCanonicalHouseholdMemberNumbers(params: {
  principalMemberNumber: string;
  liveDependants: Array<{
    id: string;
    relationship: DependantRelationship;
    createdAt: Date;
    currentMemberNumber?: string | null;
  }>;
  liveParents: Array<{
    id: string;
    relationship: ParentRelationship;
    createdAt?: Date;
    currentMemberNumber?: string | null;
  }>;
  includeParents: boolean;
}): CanonicalHouseholdPlan {
  const dependants = orderDependantsForMemberNumberBackfill(params.liveDependants).map(
    (dependant, index) => {
      const sequence = index + 1;
      return {
        id: dependant.id,
        memberNumber: memberNumberFromPrincipal(params.principalMemberNumber, sequence),
        sequence,
        currentMemberNumber: dependant.currentMemberNumber ?? null,
      };
    }
  );

  const parents = params.includeParents
    ? orderParentsForMemberNumberBackfill(params.liveParents).map((parent, index) => {
        const sequence = dependants.length + index + 1;
        return {
          id: parent.id,
          memberNumber: memberNumberFromPrincipal(params.principalMemberNumber, sequence),
          sequence,
          currentMemberNumber: parent.currentMemberNumber ?? null,
        };
      })
    : [];

  const needsRepair =
    dependants.some((row) => row.currentMemberNumber !== row.memberNumber) ||
    parents.some((row) => row.currentMemberNumber !== row.memberNumber);

  return {
    principalMemberNumber: params.principalMemberNumber,
    dependants,
    parents,
    needsRepair,
  };
}
