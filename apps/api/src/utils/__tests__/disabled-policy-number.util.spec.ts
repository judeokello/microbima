import {
  formatDisabledPolicyNumber,
  getBasePolicyNumber,
  nextDisabledPolicyNumber,
} from '../disabled-policy-number.util';

describe('disabled-policy-number.util', () => {
  it('strips [DIS] and [DISn] prefixes', () => {
    expect(getBasePolicyNumber('MP/MFG/001')).toBe('MP/MFG/001');
    expect(getBasePolicyNumber('[DIS]MP/MFG/001')).toBe('MP/MFG/001');
    expect(getBasePolicyNumber('[DIS2]MP/MFG/001')).toBe('MP/MFG/001');
  });

  it('formats disabled policy numbers', () => {
    expect(formatDisabledPolicyNumber('MP/MFG/001', 1)).toBe('[DIS]MP/MFG/001');
    expect(formatDisabledPolicyNumber('MP/MFG/001', 2)).toBe('[DIS2]MP/MFG/001');
    expect(formatDisabledPolicyNumber('MP/MFG/001', 3)).toBe('[DIS3]MP/MFG/001');
  });

  it('picks [DIS] when base is unused', () => {
    expect(nextDisabledPolicyNumber('MP/MFG/001', [])).toBe('[DIS]MP/MFG/001');
  });

  it('picks [DIS2] when [DIS]base already exists', () => {
    expect(
      nextDisabledPolicyNumber('MP/MFG/001', ['[DIS]MP/MFG/001'])
    ).toBe('[DIS2]MP/MFG/001');
  });

  it('picks [DIS3] when [DIS] and [DIS2] exist', () => {
    expect(
      nextDisabledPolicyNumber('MP/MFG/001', [
        '[DIS]MP/MFG/001',
        '[DIS2]MP/MFG/001',
      ])
    ).toBe('[DIS3]MP/MFG/001');
  });

  it('does not double-prefix when source already has [DIS]', () => {
    expect(
      nextDisabledPolicyNumber('[DIS]MP/MFG/001', ['[DIS]MP/MFG/001'])
    ).toBe('[DIS2]MP/MFG/001');
  });
});
