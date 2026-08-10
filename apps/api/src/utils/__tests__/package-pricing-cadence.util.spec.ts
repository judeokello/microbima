/// <reference types="jest" />
import {
  isSoftLoss,
  softLossFloorAmount,
  suggestFillFromLowerBand,
} from '../package-pricing-cadence.util';

describe('softLossFloorAmount', () => {
  it('computes weekly floor from daily × 7', () => {
    expect(
      softLossFloorAmount({
        finestFrequency: 'DAILY',
        finestAmount: 100,
        coarserFrequency: 'WEEKLY',
      })
    ).toBe(700);
  });

  it('computes monthly floor from daily × 31', () => {
    expect(
      softLossFloorAmount({
        finestFrequency: 'DAILY',
        finestAmount: 10,
        coarserFrequency: 'MONTHLY',
      })
    ).toBe(310);
  });
});

describe('isSoftLoss', () => {
  it('flags weekly below daily×7', () => {
    expect(
      isSoftLoss({
        finestFrequency: 'DAILY',
        finestAmount: 100,
        coarserFrequency: 'WEEKLY',
        coarserAmount: 500,
      })
    ).toBe(true);
  });

  it('does not flag when at or above floor', () => {
    expect(
      isSoftLoss({
        finestFrequency: 'DAILY',
        finestAmount: 100,
        coarserFrequency: 'WEEKLY',
        coarserAmount: 700,
      })
    ).toBe(false);
  });
});

describe('suggestFillFromLowerBand', () => {
  it('fills empty coarser cells from finest band', () => {
    const suggested = suggestFillFromLowerBand({
      rates: { daily: 100 },
      enabledFrequencies: ['DAILY', 'WEEKLY', 'MONTHLY'],
    });
    expect(suggested.weekly).toBe(700);
    expect(suggested.monthly).toBe(3100);
    expect(suggested.annually).toBe(36500);
  });

  it('does not overwrite filled cells by default', () => {
    const suggested = suggestFillFromLowerBand({
      rates: { daily: 100, weekly: 500 },
      enabledFrequencies: ['DAILY', 'WEEKLY'],
    });
    expect(suggested.weekly).toBe(500);
  });
});
