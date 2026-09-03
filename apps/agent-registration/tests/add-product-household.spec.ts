import {
  canAddHouseholdMember,
  extraSpouseAddonCount,
  householdCapsFromBands,
} from '../src/lib/family-category';
import { isSchemeTypeaheadQueryReady, schemeNamePrefixMatches } from '../src/lib/duplicate-person';

const bands = [
  { key: 'member_only', kind: 'MEMBER_ONLY' as const },
  { key: 'up_to_2', kind: 'UP_TO_N' as const, maxMembers: 2 },
  { key: 'up_to_5', kind: 'UP_TO_N' as const, maxMembers: 5 },
];

describe('household caps and extra-spouse', () => {
  it('hides household when package has no UP_TO_N band', () => {
    const caps = householdCapsFromBands([{ key: 'member_only', kind: 'MEMBER_ONLY' }], true);
    expect(caps.showSpouse).toBe(false);
    expect(caps.showChildren).toBe(false);
    expect(caps.showParents).toBe(false);
  });

  it('member plus one allows only one extra person', () => {
    const caps = householdCapsFromBands(
      [
        { key: 'member_only', kind: 'MEMBER_ONLY' },
        { key: 'up_to_2', kind: 'UP_TO_N', maxMembers: 2 },
      ],
      false
    );
    expect(caps.maxExtraMembers).toBe(1);
    expect(canAddHouseholdMember(caps, 0)).toBe(true);
    expect(canAddHouseholdMember(caps, 1)).toBe(false);
  });

  it('bills extra-spouse × 2 for 3 spouses', () => {
    expect(extraSpouseAddonCount(3, 'up_to_5')).toBe(2);
    expect(extraSpouseAddonCount(3, 'member_only')).toBe(0);
  });
});

describe('scheme typeahead prefix', () => {
  it('requires at least 2 letters', () => {
    expect(isSchemeTypeaheadQueryReady('O')).toBe(false);
    expect(isSchemeTypeaheadQueryReady('Oo')).toBe(true);
  });

  it('matches prefix case-insensitively', () => {
    expect(schemeNamePrefixMatches('OOD Drivers', 'oo')).toBe(true);
    expect(schemeNamePrefixMatches('OOD Drivers', 'dr')).toBe(false);
  });
});
