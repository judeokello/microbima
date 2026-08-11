/**
 * Soft-loss / suggest-fill helpers for package pricing (lookup-only).
 * Floors and suggestions use package installment counts (e.g. DAILY:276, WEEKLY:39),
 * not calendar cadence days (1/7/31/90/365).
 */

import { PAYMENT_CADENCE_DAYS, PricingRateBand } from './insurance-installment.util';

export { PAYMENT_CADENCE_DAYS };

/** Frequencies allowed on package pricing grids (no CUSTOM). */
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

export function cadenceDaysForPricingFrequency(frequency: string): number {
  if (frequency === 'CUSTOM') return 0;
  return PAYMENT_CADENCE_DAYS[frequency] ?? 0;
}

/**
 * Build installment-count map from package payment frequencies.
 * ANNUALLY defaults to 1 when absent (annual amount is always required for completeness).
 */
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
 * floor ≈ finestAmount × (finestInstallmentCount / coarserInstallmentCount)
 *
 * Examples (DAILY:276, WEEKLY:39, ANNUALLY:1):
 * - daily 90 → weekly floor = 90 × (276/39) ≈ 636.92
 * - daily 90 → annually floor = 90 × (276/1) = 24840
 * - weekly 631 → annual floor = 631 × (39/1) = 24609
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
  return Math.round(params.finestAmount * (finestCount / coarserCount) * 100) / 100;
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
 * Suggest fill empty cells from the finest present lower band × installment counts.
 * Does not overwrite non-empty cells unless overwriteFilled is true.
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

  let finestFrequency: string | null = null;
  let finestAmount: number | null = null;
  for (const freq of ordered) {
    const amount = getRateFromBand(rates, freq);
    if (amount != null) {
      finestFrequency = freq;
      finestAmount = amount;
      break;
    }
  }

  if (finestFrequency == null || finestAmount == null) {
    return { ...rates };
  }

  const suggested: PricingRateBand = { ...rates };
  for (const freq of ordered) {
    if (freq === finestFrequency) continue;
    const key = rateBandKeyForFrequency(freq);
    if (!key) continue;
    const existing = rates[key];
    if (existing != null && existing > 0 && !overwriteFilled) continue;
    const floor = softLossFloorAmount({
      finestFrequency,
      finestAmount,
      coarserFrequency: freq,
      installmentCounts,
    });
    if (floor > 0) {
      suggested[key] = floor;
    }
  }
  return suggested;
}
