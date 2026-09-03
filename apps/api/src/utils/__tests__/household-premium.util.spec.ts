import { DependantRelationship } from '@prisma/client';
import { computeHouseholdPremium } from '../household-premium.util';

const pricing = {
  categories: [
    { key: 'member_only', kind: 'MEMBER_ONLY', maxMembers: 1 },
    { key: 'up_to_5', kind: 'UP_TO_N', maxMembers: 5 },
    { key: 'additional_spouse', kind: 'ADDITIONAL_SPOUSE', maxMembers: null },
  ],
  plans: {
    gold: {
      planId: 10,
      rates: {
        member_only: { monthly: 100, annually: 1200 },
        up_to_5: { monthly: 200, annually: 2400 },
        additional_spouse: { monthly: 50, annually: 600 },
      },
    },
  },
};

describe('computeHouseholdPremium', () => {
  it('uses member-only rates for principal only', () => {
    const result = computeHouseholdPremium({
      pricing,
      packagePlanId: 10,
      frequency: 'MONTHLY',
      dependants: [],
    });
    expect(result).toEqual({
      ok: true,
      premium: 100,
      annualPremium: 1200,
      categoryKey: 'member_only',
      extraSpouseCount: 0,
    });
  });

  it('adds extra-spouse rate for each spouse after the first', () => {
    const threeSpouses = [
      { relationship: DependantRelationship.SPOUSE },
      { relationship: DependantRelationship.SPOUSE },
      { relationship: DependantRelationship.SPOUSE },
    ];
    const result = computeHouseholdPremium({
      pricing,
      packagePlanId: 10,
      frequency: 'MONTHLY',
      dependants: threeSpouses,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.categoryKey).toBe('up_to_5');
      expect(result.extraSpouseCount).toBe(2);
      expect(result.premium).toBe(300);
      expect(result.annualPremium).toBe(3600);
    }
  });
});
