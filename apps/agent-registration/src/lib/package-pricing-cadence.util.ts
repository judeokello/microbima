/**
 * Client-side soft-loss / suggest-fill helpers for package pricing grid
 * (mirrors apps/api/src/utils/package-pricing-cadence.util.ts).
 * Uses package installment counts, not calendar cadence days.
 * Amounts are whole shillings (nearest integer).
 */

import { PAYMENT_CADENCE_DAYS, type PricingRateBand } from './insurance-installment';

export { PAYMENT_CADENCE_DAYS };

export const PACKAGE_PRICING_FREQUENCIES = [
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'ANNUALLY',
] as const;

export type PackagePricingFrequency = (typeof PACKAGE_PRICING_FREQUENCIES)[number];

export type InstallmentCounts = Partial<Record<string, number>>;

const RATE_BAND_KEYS: Record<PackagePricingFrequency, keyof PricingRateBand> = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  ANNUALLY: 'annually',
};

export const FREQUENCY_LABELS: Record<string, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  ANNUALLY: 'Annually',
};

const FREQUENCY_COUNT_UNITS: Record<string, string> = {
  DAILY: 'days',
  WEEKLY: 'weeks',
  MONTHLY: 'months',
  QUARTERLY: 'quarters',
};

export function cadenceDaysForPricingFrequency(frequency: string): number {
  if (frequency === 'CUSTOM') return 0;
  return PAYMENT_CADENCE_DAYS[frequency] ?? 0;
}

export function buildInstallmentCounts(
  rows: Array<{ frequency: string; installmentCount: number }>
): Record<string, number> {
  const counts: Record<string, number> = { ANNUALLY: 1 };
  for (const row of rows) {
    if (row.frequency === 'CUSTOM') continue;
    if (row.installmentCount > 0) {
      counts[row.frequency] = row.installmentCount;
    }
  }
  if (!counts.ANNUALLY || counts.ANNUALLY <= 0) {
    counts.ANNUALLY = 1;
  }
  return counts;
}

export function frequencyRowLabel(frequency: string, count?: number | null): string {
  const base = FREQUENCY_LABELS[frequency] ?? frequency;
  if (count == null || count <= 0) return base;
  if (frequency === 'ANNUALLY') return `${base} (${count})`;
  const unit = FREQUENCY_COUNT_UNITS[frequency];
  return unit ? `${base} (${count} ${unit})` : `${base} (${count})`;
}

export function rateBandKeyForFrequency(
  frequency: string
): keyof PricingRateBand | null {
  if (!(frequency in RATE_BAND_KEYS)) return null;
  return RATE_BAND_KEYS[frequency as PackagePricingFrequency];
}

export function getRateFromBand(
  rates: PricingRateBand,
  frequency: string
): number | null {
  const key = rateBandKeyForFrequency(frequency);
  if (!key) return null;
  const value = rates[key];
  return value != null && value > 0 ? value : null;
}

/**
 * Soft-loss floor for a coarser frequency from the finest band amount.
 * Amounts are whole shillings (nearest integer).
 */
export function softLossFloorAmount(params: {
  finestFrequency: string;
  finestAmount: number;
  coarserFrequency: string;
  installmentCounts: InstallmentCounts;
}): number {
  const finestCount = params.installmentCounts[params.finestFrequency] ?? 0;
  const coarserCount = params.installmentCounts[params.coarserFrequency] ?? 0;
  if (finestCount <= 0 || coarserCount <= 0 || params.finestAmount <= 0) {
    return 0;
  }
  return Math.round(params.finestAmount * (finestCount / coarserCount));
}

export function isSoftLoss(params: {
  finestFrequency: string;
  finestAmount: number;
  coarserFrequency: string;
  coarserAmount: number;
  installmentCounts: InstallmentCounts;
}): boolean {
  const floor = softLossFloorAmount(params);
  if (floor <= 0 || params.coarserAmount <= 0) return false;
  return params.coarserAmount < floor;
}

/**
 * Suggest fill empty cells from the finest present band × installment counts.
 * Suggestions are whole shillings and never below the soft-loss floor.
 */
export function suggestFillFromLowerBand(params: {
  rates: PricingRateBand;
  enabledFrequencies: string[];
  installmentCounts: InstallmentCounts;
  overwriteFilled?: boolean;
}): PricingRateBand {
  const {
    rates,
    enabledFrequencies,
    installmentCounts,
    overwriteFilled = false,
  } = params;
  const ordered = PACKAGE_PRICING_FREQUENCIES.filter(
    (f) => enabledFrequencies.includes(f) || f === 'ANNUALLY'
  );

  let baseFrequency: string | null = null;
  let baseAmount: number | null = null;
  for (const freq of ordered) {
    const amount = getRateFromBand(rates, freq);
    if (amount != null) {
      baseFrequency = freq;
      baseAmount = Math.round(amount);
      break;
    }
  }

  if (baseFrequency == null || baseAmount == null) {
    return { ...rates };
  }

  const suggested: PricingRateBand = { ...rates };
  const filledKeys = new Set<keyof PricingRateBand>();
  const baseKey = rateBandKeyForFrequency(baseFrequency);
  if (baseKey) {
    suggested[baseKey] = baseAmount;
  }

  for (const freq of ordered) {
    if (freq === baseFrequency) continue;
    const key = rateBandKeyForFrequency(freq);
    if (!key) continue;
    const existing = rates[key];
    if (existing != null && existing > 0 && !overwriteFilled) continue;
    const floor = softLossFloorAmount({
      finestFrequency: baseFrequency,
      finestAmount: baseAmount,
      coarserFrequency: freq,
      installmentCounts,
    });
    if (floor > 0) {
      suggested[key] = floor;
      filledKeys.add(key);
    }
  }

  let finestFrequency: string | null = null;
  let finestAmount: number | null = null;
  for (const freq of ordered) {
    const amount = getRateFromBand(suggested, freq);
    if (amount != null) {
      finestFrequency = freq;
      finestAmount = Math.round(amount);
      break;
    }
  }
  if (finestFrequency != null && finestAmount != null) {
    for (const freq of ordered) {
      if (freq === finestFrequency) continue;
      const key = rateBandKeyForFrequency(freq);
      if (!key || !filledKeys.has(key)) continue;
      const current = suggested[key];
      if (current == null || current <= 0) continue;
      const floor = softLossFloorAmount({
        finestFrequency,
        finestAmount,
        coarserFrequency: freq,
        installmentCounts,
      });
      if (floor > 0 && Math.round(current) < floor) {
        suggested[key] = floor;
      }
    }
  }

  return suggested;
}

/** Grid row frequencies: enabled package freqs plus ANNUALLY always. */
export function gridFrequencies(enabledFrequencies: string[]): string[] {
  const set = new Set<string>(enabledFrequencies.filter((f) => f !== 'CUSTOM'));
  set.add('ANNUALLY');
  return PACKAGE_PRICING_FREQUENCIES.filter((f) => set.has(f));
}

export function findFinestRate(
  band: PricingRateBand,
  orderedFrequencies: string[]
): { frequency: string; amount: number } | null {
  for (const freq of orderedFrequencies) {
    const amount = getRateFromBand(band, freq);
    if (amount != null) {
      return { frequency: freq, amount };
    }
  }
  return null;
}
