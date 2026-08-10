/// <reference types="jest" />
import { evaluatePackagePricingCompleteness } from '../../services/package-pricing/package-pricing-completeness';

describe('evaluatePackagePricingCompleteness', () => {
  const base = {
    plans: [{ id: 1, name: 'Silver', isActive: true }],
    categories: [{ key: 'member_only', kind: 'MEMBER_ONLY' as const }],
    enabledFrequencies: ['DAILY', 'WEEKLY'],
    rates: [
      { packagePlanId: 1, categoryKey: 'member_only', frequency: 'DAILY', amount: 10 },
      { packagePlanId: 1, categoryKey: 'member_only', frequency: 'WEEKLY', amount: 70 },
      { packagePlanId: 1, categoryKey: 'member_only', frequency: 'ANNUALLY', amount: 3650 },
    ],
  };

  it('is complete when member only + enabled freqs + annual are filled', () => {
    const result = evaluatePackagePricingCompleteness(base);
    expect(result.isPricingComplete).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('requires ANNUALLY even when Annually is not an enabled payment frequency', () => {
    const result = evaluatePackagePricingCompleteness({
      ...base,
      rates: base.rates.filter((r) => r.frequency !== 'ANNUALLY'),
    });
    expect(result.isPricingComplete).toBe(false);
    expect(result.missing.some((m) => m.frequency === 'ANNUALLY')).toBe(true);
  });

  it('requires Member only category', () => {
    const result = evaluatePackagePricingCompleteness({
      ...base,
      categories: [],
      rates: [],
    });
    expect(result.isPricingComplete).toBe(false);
    expect(result.errors.some((e) => /Member only/i.test(e))).toBe(true);
  });

  it('treats Up to N / spouse as optional (not required groupings)', () => {
    const result = evaluatePackagePricingCompleteness(base);
    expect(result.isPricingComplete).toBe(true);
  });

  it('requires rates for optional groupings once defined', () => {
    const result = evaluatePackagePricingCompleteness({
      ...base,
      categories: [
        ...base.categories,
        { key: 'up_to_5', kind: 'UP_TO_N', maxMembers: 5 },
      ],
    });
    expect(result.isPricingComplete).toBe(false);
    expect(result.missing.some((m) => m.categoryKey === 'up_to_5')).toBe(true);
  });

  it('rejects amount <= 0 as incomplete', () => {
    const result = evaluatePackagePricingCompleteness({
      ...base,
      rates: base.rates.map((r) =>
        r.frequency === 'WEEKLY' ? { ...r, amount: 0 } : r
      ),
    });
    expect(result.isPricingComplete).toBe(false);
  });

  it('ignores inactive plans for required cells', () => {
    const result = evaluatePackagePricingCompleteness({
      ...base,
      plans: [
        { id: 1, name: 'Silver', isActive: false },
        { id: 2, name: 'Gold', isActive: true },
      ],
      rates: [
        { packagePlanId: 2, categoryKey: 'member_only', frequency: 'DAILY', amount: 20 },
        { packagePlanId: 2, categoryKey: 'member_only', frequency: 'WEEKLY', amount: 140 },
        { packagePlanId: 2, categoryKey: 'member_only', frequency: 'ANNUALLY', amount: 7300 },
      ],
    });
    expect(result.isPricingComplete).toBe(true);
  });
});
