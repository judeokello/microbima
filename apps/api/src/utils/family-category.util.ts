import { DependantRelationship } from '@prisma/client';

/** Legacy hardcoded keys kept for migration compatibility. */
export type LegacyInsuranceFamilyCategory = 'member_only' | 'up_to_5' | 'up_to_8';

export type PackagePricingBand = {
  key: string;
  kind: 'MEMBER_ONLY' | 'UP_TO_N' | 'ADDITIONAL_SPOUSE';
  maxMembers?: number | null;
};

export type FamilyCategoryResolution =
  | { ok: true; categoryKey: string }
  | { ok: false; reason: 'OVERFLOW' | 'UNDERSIZED' | 'UNKNOWN_CATEGORY' };

/**
 * Household size = principal + active (non-deleted) dependants.
 */
export function householdSizeFromDependants(
  dependants: Array<{ relationship: DependantRelationship; deletedAt?: Date | null }>
): number {
  const active = dependants.filter((d) => d.deletedAt == null);
  return 1 + active.length;
}

/**
 * Derive product-pricing family category from active dependants (legacy 5/8 bands).
 * Prefer {@link resolveFamilyCategoryForHousehold} with package bands when available.
 */
export function deriveFamilyCategoryFromDependants(
  dependants: Array<{ relationship: DependantRelationship; deletedAt?: Date | null }>
): LegacyInsuranceFamilyCategory {
  const total = householdSizeFromDependants(dependants);
  if (total <= 1) return 'member_only';
  if (total <= 5) return 'up_to_5';
  return 'up_to_8';
}

/** @deprecated Alias for legacy callers. */
export type InsuranceFamilyCategory = LegacyInsuranceFamilyCategory;

/**
 * Resolve category for a known household size against package-configured bands.
 * Size 1 → MEMBER_ONLY; else smallest UP_TO_N with maxMembers >= size; else OVERFLOW.
 */
export function resolveFamilyCategoryForHousehold(
  householdSize: number,
  bands: PackagePricingBand[]
): FamilyCategoryResolution {
  if (householdSize <= 1) {
    const memberOnly = bands.find((b) => b.kind === 'MEMBER_ONLY');
    if (!memberOnly) {
      return { ok: false, reason: 'OVERFLOW' };
    }
    return { ok: true, categoryKey: memberOnly.key };
  }

  const upTo = bands
    .filter((b) => b.kind === 'UP_TO_N' && b.maxMembers != null && b.maxMembers >= 2)
    .sort((a, b) => (a.maxMembers ?? 0) - (b.maxMembers ?? 0));

  const fit = upTo.find((b) => (b.maxMembers ?? 0) >= householdSize);
  if (!fit) {
    return { ok: false, reason: 'OVERFLOW' };
  }
  return { ok: true, categoryKey: fit.key };
}

/**
 * When household size is known, selected band must cover that size.
 * When size is unknown (null/undefined), skip undersize check.
 */
export function validateSelectedFamilyCategory(params: {
  selectedCategoryKey: string;
  householdSize: number | null | undefined;
  bands: PackagePricingBand[];
}): FamilyCategoryResolution {
  const { selectedCategoryKey, householdSize, bands } = params;
  const selected = bands.find((b) => b.key === selectedCategoryKey);
  if (!selected || selected.kind === 'ADDITIONAL_SPOUSE') {
    return { ok: false, reason: 'UNKNOWN_CATEGORY' };
  }

  if (householdSize == null) {
    return { ok: true, categoryKey: selectedCategoryKey };
  }

  if (selected.kind === 'MEMBER_ONLY') {
    if (householdSize > 1) {
      return { ok: false, reason: 'UNDERSIZED' };
    }
    return { ok: true, categoryKey: selectedCategoryKey };
  }

  // UP_TO_N
  const max = selected.maxMembers ?? 0;
  if (householdSize > max) {
    return { ok: false, reason: 'UNDERSIZED' };
  }
  return { ok: true, categoryKey: selectedCategoryKey };
}

export function packageHasFamilyBands(bands: PackagePricingBand[]): boolean {
  return bands.some((b) => b.kind === 'UP_TO_N' && (b.maxMembers ?? 0) >= 2);
}

/** Max spouses+children allowed (principal is not counted). 0 = member-only product. */
export function maxDependantSlots(bands: PackagePricingBand[]): number {
  const upTo = bands
    .filter((b) => b.kind === 'UP_TO_N' && b.maxMembers != null && b.maxMembers >= 2)
    .map((b) => b.maxMembers ?? 0);
  if (upTo.length === 0) return 0;
  return Math.max(...upTo) - 1;
}

/**
 * Extra-spouse add-on count: each spouse after the first.
 * Member-only → 0. optedIn false → 0. Unknown household + opted in → 1.
 */
export function additionalSpouseCount(
  category: string,
  dependants: Array<{ relationship: DependantRelationship; deletedAt?: Date | null }>,
  options?: { optedIn?: boolean; householdKnown?: boolean }
): number {
  if (category === 'member_only' || category === 'MEMBER_ONLY') return 0;
  if (options?.optedIn === false) return 0;

  if (options?.householdKnown === false) {
    return options.optedIn === true ? 1 : 0;
  }

  const spouseCount = dependants.filter(
    (d) => d.deletedAt == null && d.relationship === 'SPOUSE'
  ).length;
  return Math.max(0, spouseCount - 1);
}

/**
 * Additional spouse add-on applies when category is not Member only, agent opts in,
 * and (when household known) there is more than one spouse.
 */
export function hasAdditionalSpousePremium(
  category: string,
  dependants: Array<{ relationship: DependantRelationship; deletedAt?: Date | null }>,
  options?: { optedIn?: boolean; householdKnown?: boolean }
): boolean {
  return additionalSpouseCount(category, dependants, options) > 0;
}
