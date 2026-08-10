/**
 * Package pricing completeness evaluation (pure; no Prisma).
 * Completeness = active plans × defined categories × (enabled freqs ∪ ANNUALLY), amount > 0.
 */

export type CompletenessCategoryKind = 'MEMBER_ONLY' | 'UP_TO_N' | 'ADDITIONAL_SPOUSE';

export type CompletenessCategory = {
  key: string;
  kind: CompletenessCategoryKind;
  maxMembers?: number | null;
};

export type CompletenessPlan = {
  id: number;
  name: string;
  isActive: boolean;
};

export type CompletenessRate = {
  packagePlanId: number;
  categoryKey: string;
  frequency: string;
  amount: number;
};

export type CompletenessInput = {
  plans: CompletenessPlan[];
  categories: CompletenessCategory[];
  enabledFrequencies: string[];
  rates: CompletenessRate[];
};

export type CompletenessResult = {
  isPricingComplete: boolean;
  missing: Array<{
    planId: number;
    planName: string;
    categoryKey: string;
    frequency: string;
  }>;
  errors: string[];
};

const NON_CUSTOM = new Set(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY']);

export function requiredFrequenciesForCompleteness(
  enabledFrequencies: string[]
): string[] {
  const enabled = enabledFrequencies.filter(
    (f) => f !== 'CUSTOM' && NON_CUSTOM.has(f)
  );
  const set = new Set(enabled);
  set.add('ANNUALLY');
  return Array.from(set);
}

export function evaluatePackagePricingCompleteness(
  input: CompletenessInput
): CompletenessResult {
  const errors: string[] = [];
  const missing: CompletenessResult['missing'] = [];

  const memberOnly = input.categories.filter((c) => c.kind === 'MEMBER_ONLY');
  if (memberOnly.length === 0) {
    errors.push('Member only category is required');
  } else if (memberOnly.length > 1) {
    errors.push('At most one Member only category is allowed');
  }

  const spouse = input.categories.filter((c) => c.kind === 'ADDITIONAL_SPOUSE');
  if (spouse.length > 1) {
    errors.push('At most one Additional spouse category is allowed');
  }

  const upToNs = input.categories.filter((c) => c.kind === 'UP_TO_N');
  const maxMembersSeen = new Set<number>();
  for (const cat of upToNs) {
    if (cat.maxMembers == null || cat.maxMembers < 2) {
      errors.push(`Up to N category "${cat.key}" requires maxMembers >= 2`);
      continue;
    }
    if (maxMembersSeen.has(cat.maxMembers)) {
      errors.push(`Duplicate Up to N maxMembers ${cat.maxMembers}`);
    }
    maxMembersSeen.add(cat.maxMembers);
  }

  const activePlans = input.plans.filter((p) => p.isActive);
  if (activePlans.length === 0) {
    errors.push('At least one active plan is required');
  }

  const freqs = requiredFrequenciesForCompleteness(input.enabledFrequencies);
  const rateIndex = new Map<string, number>();
  for (const rate of input.rates) {
    const key = `${rate.packagePlanId}|${rate.categoryKey}|${rate.frequency}`;
    rateIndex.set(key, rate.amount);
  }

  for (const plan of activePlans) {
    for (const category of input.categories) {
      for (const frequency of freqs) {
        const key = `${plan.id}|${category.key}|${frequency}`;
        const amount = rateIndex.get(key);
        if (amount == null || !(amount > 0)) {
          missing.push({
            planId: plan.id,
            planName: plan.name,
            categoryKey: category.key,
            frequency,
          });
        }
      }
    }
  }

  return {
    isPricingComplete: errors.length === 0 && missing.length === 0,
    missing,
    errors,
  };
}
