/** FE mirror of API family-category.util (registration/modify validation). */

export type PackagePricingBand = {
  key: string;
  kind: 'MEMBER_ONLY' | 'UP_TO_N' | 'ADDITIONAL_SPOUSE';
  maxMembers?: number | null;
};

export type FamilyCategoryResolution =
  | { ok: true; categoryKey: string }
  | { ok: false; reason: 'OVERFLOW' | 'UNDERSIZED' | 'UNKNOWN_CATEGORY' };

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

  const max = selected.maxMembers ?? 0;
  if (householdSize > max) {
    return { ok: false, reason: 'UNDERSIZED' };
  }
  return { ok: true, categoryKey: selectedCategoryKey };
}

export function packageHasFamilyBands(bands: PackagePricingBand[]): boolean {
  return bands.some((b) => b.kind === 'UP_TO_N' && (b.maxMembers ?? 0) >= 2);
}

export function maxDependantSlots(bands: PackagePricingBand[]): number {
  const upTo = bands
    .filter((b) => b.kind === 'UP_TO_N' && b.maxMembers != null && b.maxMembers >= 2)
    .map((b) => b.maxMembers ?? 0);
  if (upTo.length === 0) return 0;
  return Math.max(...upTo) - 1;
}

export function additionalSpouseCount(
  category: string,
  spouseCount: number,
  options?: { optedIn?: boolean; householdKnown?: boolean }
): number {
  if (category === 'member_only' || category === 'MEMBER_ONLY') return 0;
  if (options?.optedIn === false) return 0;
  if (options?.householdKnown === false) {
    return options.optedIn === true ? 1 : 0;
  }
  return Math.max(0, spouseCount - 1);
}

export function hasAdditionalSpousePremium(
  category: string,
  spouseCount: number,
  options?: { optedIn?: boolean; householdKnown?: boolean }
): boolean {
  return additionalSpouseCount(category, spouseCount, options) > 0;
}

export function householdSizeFromRegistrationForm(params: {
  spouses: Array<{ firstName?: string }>;
  children: Array<{ firstName?: string }>;
}): number {
  const spouseCount = params.spouses.filter((s) => s.firstName?.trim()).length;
  const childCount = params.children.filter((c) => c.firstName?.trim()).length;
  return 1 + spouseCount + childCount;
}
