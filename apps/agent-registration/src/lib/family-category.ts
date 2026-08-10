/** FE mirror of API family-category.util (registration/modify validation). */

export type PackagePricingBand = {
  key: string;
  kind: 'MEMBER_ONLY' | 'UP_TO_N' | 'ADDITIONAL_SPOUSE';
  maxMembers?: number | null;
};

export type FamilyCategoryResolution =
  | { ok: true; categoryKey: string }
  | { ok: false; reason: 'OVERFLOW' | 'UNDERSIZED' | 'UNKNOWN_CATEGORY' };

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

export function hasAdditionalSpousePremium(
  category: string,
  spouseCount: number,
  options?: { optedIn?: boolean; householdKnown?: boolean }
): boolean {
  if (category === 'member_only' || category === 'MEMBER_ONLY') return false;
  if (options?.optedIn === false) return false;

  if (options?.householdKnown === false) {
    return options.optedIn === true;
  }

  if (spouseCount <= 1) return false;
  return true;
}

export function householdSizeFromRegistrationForm(params: {
  spouses: Array<{ firstName?: string }>;
  children: Array<{ firstName?: string }>;
}): number {
  const spouseCount = params.spouses.filter((s) => s.firstName?.trim()).length;
  const childCount = params.children.filter((c) => c.firstName?.trim()).length;
  return 1 + spouseCount + childCount;
}
