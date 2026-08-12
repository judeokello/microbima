import {
  buildInstallmentCounts,
  frequencyRowLabel,
  isSoftLoss,
  softLossFloorAmount,
  suggestFillFromLowerBand,
} from '@/lib/package-pricing-cadence.util';

const MFANISI_COUNTS = buildInstallmentCounts([
  { frequency: 'DAILY', installmentCount: 276 },
  { frequency: 'WEEKLY', installmentCount: 39 },
  { frequency: 'ANNUALLY', installmentCount: 1 },
]);

describe('package-pricing-cadence.util (FE)', () => {
  it('labels frequencies with installment counts', () => {
    expect(frequencyRowLabel('DAILY', 276)).toBe('Daily (276 days)');
    expect(frequencyRowLabel('WEEKLY', 39)).toBe('Weekly (39 weeks)');
    expect(frequencyRowLabel('ANNUALLY', 1)).toBe('Annually (1)');
  });

  it('suggests annual from daily using installment count not 365', () => {
    const suggested = suggestFillFromLowerBand({
      rates: { daily: 90 },
      enabledFrequencies: ['DAILY', 'WEEKLY'],
      installmentCounts: MFANISI_COUNTS,
    });
    expect(suggested.annually).toBe(24840);
    expect(suggested.weekly).toBe(Math.round(90 * (276 / 39)));
  });

  it('rounds annual-derived suggestions to whole shillings', () => {
    const counts = buildInstallmentCounts([
      { frequency: 'DAILY', installmentCount: 315 },
      { frequency: 'WEEKLY', installmentCount: 40 },
      { frequency: 'MONTHLY', installmentCount: 10 },
    ]);
    const suggested = suggestFillFromLowerBand({
      rates: { annually: 21793 },
      enabledFrequencies: ['DAILY', 'WEEKLY', 'MONTHLY', 'ANNUALLY'],
      installmentCounts: counts,
    });
    expect(suggested.daily).toBe(69);
    expect(suggested.weekly).toBe(545);
    expect(suggested.monthly).toBe(2179);
  });

  it('clears soft-loss once weekly is at or above installment floor', () => {
    const floor = softLossFloorAmount({
      finestFrequency: 'DAILY',
      finestAmount: 90,
      coarserFrequency: 'WEEKLY',
      installmentCounts: MFANISI_COUNTS,
    });
    expect(
      isSoftLoss({
        finestFrequency: 'DAILY',
        finestAmount: 90,
        coarserFrequency: 'WEEKLY',
        coarserAmount: 600,
        installmentCounts: MFANISI_COUNTS,
      })
    ).toBe(true);
    expect(
      isSoftLoss({
        finestFrequency: 'DAILY',
        finestAmount: 90,
        coarserFrequency: 'WEEKLY',
        coarserAmount: floor,
        installmentCounts: MFANISI_COUNTS,
      })
    ).toBe(false);
  });
});
