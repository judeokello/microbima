import { DependantRelationship, ParentRelationship } from '@prisma/client';

export type MemberCardRole = 'PRINCIPAL' | 'SPOUSE' | 'CHILD' | 'PARENT';

export const MEMBER_CARD_ROLE_LABEL: Record<MemberCardRole, string> = {
  PRINCIPAL: 'Principal',
  SPOUSE: 'Spouse',
  CHILD: 'Child',
  PARENT: 'Parent',
};

export function memberCardRoleFromDependant(
  relationship: DependantRelationship | string
): MemberCardRole {
  return relationship === DependantRelationship.SPOUSE || relationship === 'SPOUSE'
    ? 'SPOUSE'
    : 'CHILD';
}

export function memberCardRoleFromParent(
  _relationship: ParentRelationship | string
): MemberCardRole {
  return 'PARENT';
}
