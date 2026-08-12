/// <reference types="jest" />
import {
  buildInstallmentCounts,
  isSoftLoss,
  softLossFloorAmount,
  suggestFillFromLowerBand,
} from '../package-pricing-cadence.util';

const MFANISI_COUNTS = buildInstallmentCounts([
  { frequency: 'DAILY', installmentCount: 276 },
  { frequency: 'WEEKLY', installmentCount: 39 },
  { frequency: 'ANNUALLY', installmentCount: 1 },
]);

describe('buildInstallmentCounts', () => {
  it('defaults ANNUALLY to 1 when omitted', () => {
    expect(
      buildInstallmentCounts([{ frequency: 'DAILY', installmentCount: 276 }])
    ).toEqual({ DAILY: 276, ANNUALLY: 1 });
  });
});

describe('softLossFloorAmount', () => {
  it('computes weekly floor from daily × (dailyCount/weeklyCount)', () => {
    expect(
      softLossFloorAmount({
        finestFrequency: 'DAILY',
        finestAmount: 90,
        coarserFrequency: 'WEEKLY',
        installmentCounts: MFANISI_COUNTS,
      })
    ).toBe(Math.round(90 * (276 / 39)));
  });

  it('computes annual floor from daily × dailyCount', () => {
    expect(
      softLossFloorAmount({
        finestFrequency: 'DAILY',
        finestAmount: 90,
        coarserFrequency: 'ANNUALLY',
        installmentCounts: MFANISI_COUNTS,
      })
    ).toBe(24840);
  });

  it('computes annual floor from weekly × weeklyCount', () => {
    expect(
      softLossFloorAmount({
        finestFrequency: 'WEEKLY',
        finestAmount: 631,
        coarserFrequency: 'ANNUALLY',
        installmentCounts: MFANISI_COUNTS,
      })
    ).toBe(24609);
  });

  it('returns 0 when installment counts are missing', () => {
    expect(
      softLossFloorAmount({
        finestFrequency: 'DAILY',
        finestAmount: 90,
        coarserFrequency: 'WEEKLY',
        installmentCounts: {},
      })
    ).toBe(0);
  });
});

describe('isSoftLoss', () => {
  it('flags weekly below installment-count floor', () => {
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
        coarserAmount: floor - 1,
        installmentCounts: MFANISI_COUNTS,
      })
    ).toBe(true);
  });

  it('does not flag when at or above floor', () => {
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
        coarserAmount: floor,
        installmentCounts: MFANISI_COUNTS,
      })
    ).toBe(false);
  });
});

describe('suggestFillFromLowerBand', () => {
  it('fills empty coarser cells using installment counts (not 365)', () => {
    const suggested = suggestFillFromLowerBand({
      rates: { daily: 90 },
      enabledFrequencies: ['DAILY', 'WEEKLY'],
      installmentCounts: MFANISI_COUNTS,
    });
    expect(suggested.weekly).toBe(Math.round(90 * (276 / 39)));
    expect(suggested.annually).toBe(24840);
    expect(suggested.annually).not.toBe(90 * 365);
  });

  it('does not overwrite filled cells by default', () => {
    const suggested = suggestFillFromLowerBand({
      rates: { daily: 90, weekly: 600 },
      enabledFrequencies: ['DAILY', 'WEEKLY'],
      installmentCounts: MFANISI_COUNTS,
    });
    expect(suggested.weekly).toBe(600);
    expect(suggested.annually).toBe(24840);
  });

  it('returns rates unchanged when no base amount is present', () => {
    const suggested = suggestFillFromLowerBand({
      rates: {},
      enabledFrequencies: ['DAILY', 'WEEKLY'],
      installmentCounts: MFANISI_COUNTS,
    });
    expect(suggested).toEqual({});
  });

  it('rounds suggestions to whole shillings and never below finest-derived floor', () => {
    const suggested = suggestFillFromLowerBand({
      rates: { annually: 33856 },
      enabledFrequencies: ['DAILY', 'WEEKLY', 'MONTHLY', 'ANNUALLY'],
      installmentCounts: buildInstallmentCounts([
        { frequency: 'DAILY', installmentCount: 315 },
        { frequency: 'WEEKLY', installmentCount: 40 },
        { frequency: 'MONTHLY', installmentCount: 10 },
        { frequency: 'ANNUALLY', installmentCount: 1 },
      ]),
    });
    expect(suggested.daily).toBe(Math.round(33856 / 315));
    expect(suggested.weekly).toBe(Math.round(33856 / 40));
    expect(Number.isInteger(suggested.monthly)).toBe(true);
    expect(suggested.monthly).toBeGreaterThanOrEqual(
      softLossFloorAmount({
        finestFrequency: 'DAILY',
        finestAmount: suggested.daily!,
        coarserFrequency: 'MONTHLY',
        installmentCounts: {
          DAILY: 315,
          WEEKLY: 40,
          MONTHLY: 10,
          ANNUALLY: 1,
        },
      })
    );
  });
});
