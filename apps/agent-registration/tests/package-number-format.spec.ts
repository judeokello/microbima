import {
  POLICY_NUMBER_CODE_MAX_LENGTH,
  POLICY_NUMBER_CODE_MIN_LENGTH,
  buildMemberNumberFormat,
  buildPolicyNumberFormat,
  extractPolicyNumberCode,
  isValidPolicyNumberCode,
  normalizePolicyNumberCode,
} from '@/lib/package-number-format';

describe('package-number-format', () => {
  it('requires 2–5 alphanumeric characters', () => {
    expect(POLICY_NUMBER_CODE_MIN_LENGTH).toBe(2);
    expect(POLICY_NUMBER_CODE_MAX_LENGTH).toBe(5);
    expect(isValidPolicyNumberCode('')).toBe(false);
    expect(isValidPolicyNumberCode('A')).toBe(false);
    expect(isValidPolicyNumberCode('PA')).toBe(true);
    expect(isValidPolicyNumberCode('mfg')).toBe(true);
    expect(isValidPolicyNumberCode('MFGBL')).toBe(true);
  });

  it('normalizes and builds stored policy and member formats', () => {
    expect(normalizePolicyNumberCode('mfg-1')).toBe('MFG1');
    expect(buildPolicyNumberFormat('MFG')).toBe(
      'MP/MFG/{auto-increasing-policy-number}'
    );
    expect(buildMemberNumberFormat('MFG')).toBe(
      'MFG{auto-increasing-policy-number}-{auto-increasing-member-number}'
    );
    expect(extractPolicyNumberCode('MP/PA/{auto-increasing-policy-number}')).toBe(
      'PA'
    );
  });
});
