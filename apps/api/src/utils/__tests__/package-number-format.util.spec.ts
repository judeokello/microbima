/// <reference types="jest" />
import { ValidationException } from '../../exceptions/validation.exception';
import {
  MEMBER_NUMBER_PLACEHOLDER,
  POLICY_NUMBER_PLACEHOLDER,
  buildMemberNumberFormat,
  buildPolicyNumberFormat,
  extractPolicyNumberCode,
  formatsFromPolicyNumberCode,
  policyNumberCodeConflictWhere,
  validateMemberNumberFormat,
  validatePolicyNumberCode,
  validatePolicyNumberFormat,
} from '../package-number-format.util';

describe('package-number-format.util', () => {
  it('accepts unique-style policy and member formats', () => {
    expect(validatePolicyNumberFormat(`MP/MFGBL/${POLICY_NUMBER_PLACEHOLDER}`)).toBe(
      `MP/MFGBL/${POLICY_NUMBER_PLACEHOLDER}`
    );
    expect(
      validateMemberNumberFormat(`MFGBL${POLICY_NUMBER_PLACEHOLDER}-${MEMBER_NUMBER_PLACEHOLDER}`)
    ).toBe(`MFGBL${POLICY_NUMBER_PLACEHOLDER}-${MEMBER_NUMBER_PLACEHOLDER}`);
  });

  it('rejects missing policy number placeholder', () => {
    expect(() => validatePolicyNumberFormat('MP/MFGBL/001')).toThrow(ValidationException);
    expect(() => validatePolicyNumberFormat('  ')).toThrow(ValidationException);
  });

  it('rejects missing member number placeholder', () => {
    expect(() => validateMemberNumberFormat('MFGBL001-00')).toThrow(ValidationException);
    expect(() => validateMemberNumberFormat(undefined)).toThrow(ValidationException);
  });

  it('normalizes a short product code and builds both formats', () => {
    const built = formatsFromPolicyNumberCode('mfg');
    expect(built.code).toBe('MFG');
    expect(built.policyNumberFormat).toBe(buildPolicyNumberFormat('MFG'));
    expect(built.memberNumberFormat).toBe(buildMemberNumberFormat('MFG'));
    expect(extractPolicyNumberCode(built.policyNumberFormat)).toBe('MFG');
    expect(extractPolicyNumberCode('MP/PA/{auto-increasing-policy-number}')).toBe('PA');
  });

  it('rejects empty product codes and truncates longer input to 5 characters', () => {
    expect(() => validatePolicyNumberCode('')).toThrow(ValidationException);
    expect(() => validatePolicyNumberCode('!!!')).toThrow(ValidationException);
    expect(validatePolicyNumberCode('toolong')).toBe('TOOLO');
  });

  it('requires 2–5 alphanumeric characters', () => {
    expect(() => validatePolicyNumberCode('A')).toThrow(ValidationException);
    expect(validatePolicyNumberCode('PA')).toBe('PA');
    expect(validatePolicyNumberCode('MFGBL')).toBe('MFGBL');
    expect(extractPolicyNumberCode('MP/A/{auto-increasing-policy-number}')).toBeNull();
  });

  it('builds a uniqueness query that matches the code in policy or member formats', () => {
    const where = policyNumberCodeConflictWhere('PA');
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { policyNumberFormat: 'MP/PA/{auto-increasing-policy-number}' },
        { policyNumberFormat: { startsWith: 'MP/PA/' } },
        { memberNumberFormat: { startsWith: 'PA{auto-increasing-policy-number}' } },
      ])
    );
  });
});
