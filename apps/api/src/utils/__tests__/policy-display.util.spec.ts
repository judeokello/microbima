import {
  buildPolicyDisplayText,
  formatPolicyLabelDate,
  formatPolicyTermRange,
} from '../policy-display.util';

describe('policy-display.util', () => {
  const start = new Date(Date.UTC(2026, 2, 31, 12, 45, 0));
  const end = new Date(Date.UTC(2027, 2, 30, 12, 45, 0));
  const deactivatedAt = new Date(Date.UTC(2026, 6, 21, 20, 34, 0));

  it('formats dates with year', () => {
    expect(formatPolicyLabelDate(start)).toBe('31 Mar 2026');
    expect(formatPolicyTermRange(start, end)).toBe('31 Mar 2026–30 Mar 2027');
  });

  it('labels active/suspended with term range and year', () => {
    expect(
      buildPolicyDisplayText({
        packageName: 'Mfanisi Go',
        planName: 'Silver',
        status: 'SUSPENDED',
        startDate: start,
        endDate: end,
      })
    ).toBe('Mfanisi Go - Silver (SUSPENDED, 31 Mar 2026–30 Mar 2027)');
  });

  it('labels deactivated with term and off date', () => {
    expect(
      buildPolicyDisplayText({
        packageName: 'Mfanisi Go',
        planName: 'Silver',
        status: 'DEACTIVATED',
        startDate: start,
        endDate: end,
        deactivatedAt,
      })
    ).toBe(
      'Mfanisi Go - Silver (DEACTIVATED, 31 Mar 2026–30 Mar 2027, off 21 Jul 2026)'
    );
  });
});
