/// <reference types="jest" />
import {
  extraSpouseAddonCount,
  hasAdditionalSpousePremium,
  householdCapsFromBands,
  resolveFamilyCategoryForHousehold,
  validateSelectedFamilyCategory,
} from '../family-category.util';
import { DependantRelationship } from '@prisma/client';

const bands = [
  { key: 'member_only', kind: 'MEMBER_ONLY' as const },
  { key: 'up_to_5', kind: 'UP_TO_N' as const, maxMembers: 5 },
  { key: 'up_to_8', kind: 'UP_TO_N' as const, maxMembers: 8 },
  { key: 'additional_spouse', kind: 'ADDITIONAL_SPOUSE' as const },
];

describe('resolveFamilyCategoryForHousehold', () => {
  it('maps size 1 to member_only', () => {
    expect(resolveFamilyCategoryForHousehold(1, bands)).toEqual({
      ok: true,
      categoryKey: 'member_only',
    });
  });

  it('picks smallest Up to N that fits', () => {
    expect(resolveFamilyCategoryForHousehold(4, bands)).toEqual({
      ok: true,
      categoryKey: 'up_to_5',
    });
    expect(resolveFamilyCategoryForHousehold(6, bands)).toEqual({
      ok: true,
      categoryKey: 'up_to_8',
    });
  });

  it('blocks overflow when no Up to N fits', () => {
    expect(resolveFamilyCategoryForHousehold(10, bands)).toEqual({
      ok: false,
      reason: 'OVERFLOW',
    });
  });
});

describe('validateSelectedFamilyCategory', () => {
  it('blocks undersized selection when household known', () => {
    expect(
      validateSelectedFamilyCategory({
        selectedCategoryKey: 'member_only',
        householdSize: 3,
        bands,
      })
    ).toEqual({ ok: false, reason: 'UNDERSIZED' });
  });

  it('skips undersize check when household size unknown', () => {
    expect(
      validateSelectedFamilyCategory({
        selectedCategoryKey: 'member_only',
        householdSize: null,
        bands,
      })
    ).toEqual({ ok: true, categoryKey: 'member_only' });
  });

  it('blocks up_to_5 when household exceeds band max (FR-019a)', () => {
    expect(
      validateSelectedFamilyCategory({
        selectedCategoryKey: 'up_to_5',
        householdSize: 6,
        bands,
      })
    ).toEqual({ ok: false, reason: 'UNDERSIZED' });
  });
});

describe('hasAdditionalSpousePremium', () => {
  const twoSpouses = [
    { relationship: DependantRelationship.SPOUSE },
    { relationship: DependantRelationship.SPOUSE },
  ];

  it('is false for member_only', () => {
    expect(hasAdditionalSpousePremium('member_only', twoSpouses)).toBe(false);
  });

  it('is true for non-member-only with >1 spouse', () => {
    expect(hasAdditionalSpousePremium('up_to_5', twoSpouses)).toBe(true);
  });
});

describe('extraSpouseAddonCount', () => {
  it('bills add-on × 2 for 3 spouses', () => {
    expect(extraSpouseAddonCount(3, 'up_to_8')).toBe(2);
  });

  it('is 0 for member-only even with multiple spouses', () => {
    expect(extraSpouseAddonCount(3, 'member_only')).toBe(0);
  });

  it('is 0 for a single spouse', () => {
    expect(extraSpouseAddonCount(1, 'up_to_5')).toBe(0);
  });
});

describe('householdCapsFromBands', () => {
  it('hides spouse, children, and parents when there is no UP_TO_N band', () => {
    expect(
      householdCapsFromBands([{ key: 'member_only', kind: 'MEMBER_ONLY' }], true)
    ).toMatchObject({
      showSpouse: false,
      showChildren: false,
      showParents: false,
      maxExtraMembers: 0,
    });
  });

  it('caps extra members at N-1 and shows parents only when scheme supports them', () => {
    expect(householdCapsFromBands(bands, true)).toMatchObject({
      maxMembers: 8,
      maxExtraMembers: 7,
      showSpouse: true,
      showChildren: true,
      showParents: true,
    });
    expect(householdCapsFromBands(bands, false).showParents).toBe(false);
  });
});
