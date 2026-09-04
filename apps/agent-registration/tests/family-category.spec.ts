/// <reference types="jest" />
import {
  additionalSpouseCount,
  maxDependantSlots,
  packageHasFamilyBands,
} from '../src/lib/family-category';

const familyBands = [
  { key: 'member_only', kind: 'MEMBER_ONLY' as const },
  { key: 'up_to_5', kind: 'UP_TO_N' as const, maxMembers: 5 },
  { key: 'additional_spouse', kind: 'ADDITIONAL_SPOUSE' as const },
];

describe('household cap helpers', () => {
  it('hides family slots for member-only packages', () => {
    expect(packageHasFamilyBands([{ key: 'member_only', kind: 'MEMBER_ONLY' }])).toBe(false);
    expect(maxDependantSlots([{ key: 'member_only', kind: 'MEMBER_ONLY' }])).toBe(0);
  });

  it('caps spouses+children at largest UP_TO_N minus principal', () => {
    expect(packageHasFamilyBands(familyBands)).toBe(true);
    expect(maxDependantSlots(familyBands)).toBe(4);
  });
});

describe('additionalSpouseCount', () => {
  it('is 2 for three spouses on a family band', () => {
    expect(additionalSpouseCount('up_to_5', 3)).toBe(2);
  });

  it('is 0 for member-only', () => {
    expect(additionalSpouseCount('member_only', 3)).toBe(0);
  });
});
