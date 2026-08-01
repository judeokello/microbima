import { DependantRelationship } from '@prisma/client';

export type InsuranceFamilyCategory = 'member_only' | 'up_to_5' | 'up_to_8';

/**
 * Derive product-pricing family category from active dependants.
 * Principal + dependants: 1 → member_only, 2–5 → up_to_5, 6+ → up_to_8.
 */
export function deriveFamilyCategoryFromDependants(
  dependants: Array<{ relationship: DependantRelationship; deletedAt?: Date | null }>
): InsuranceFamilyCategory {
  const active = dependants.filter((d) => d.deletedAt == null);
  const total = 1 + active.length;
  if (total <= 1) return 'member_only';
  if (total <= 5) return 'up_to_5';
  return 'up_to_8';
}

/** True when an additional-spouse premium applies (non–member-only with at least one spouse). */
export function hasAdditionalSpousePremium(
  category: InsuranceFamilyCategory,
  dependants: Array<{ relationship: DependantRelationship; deletedAt?: Date | null }>
): boolean {
  if (category === 'member_only') return false;
  const spouseCount = dependants.filter(
    (d) => d.deletedAt == null && d.relationship === 'SPOUSE'
  ).length;
  return spouseCount > 1;
}
