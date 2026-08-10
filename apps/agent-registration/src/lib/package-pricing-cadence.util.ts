/**
 * Client-side cadence / soft-loss helpers for package pricing grid (mirrors API util).
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

export function cadenceDaysForPricingFrequency(frequency: string): number {
  if (frequency === 'CUSTOM') return 0;
  return PAYMENT_CADENCE_DAYS[frequency] ?? 0;
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

export function softLossFloorAmount(params: {
  finestFrequency: string;
  finestAmount: number;
  coarserFrequency: string;
}): number {
  const finestDays = cadenceDaysForPricingFrequency(params.finestFrequency);
  const coarserDays = cadenceDaysForPricingFrequency(params.coarserFrequency);
  if (finestDays <= 0 || coarserDays <= 0 || params.finestAmount <= 0) {
    return 0;
  }
  return Math.round(params.finestAmount * (coarserDays / finestDays) * 100) / 100;
}

export function isSoftLoss(params: {
  finestFrequency: string;
  finestAmount: number;
  coarserFrequency: string;
  coarserAmount: number;
}): boolean {
  const floor = softLossFloorAmount(params);
  if (floor <= 0 || params.coarserAmount <= 0) return false;
  return params.coarserAmount < floor;
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
