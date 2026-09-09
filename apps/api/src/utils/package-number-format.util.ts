import { ValidationException } from '../exceptions/validation.exception';
import { ErrorCodes } from '../enums/error-codes.enum';

export const POLICY_NUMBER_PLACEHOLDER = '{auto-increasing-policy-number}';
export const MEMBER_NUMBER_PLACEHOLDER = '{auto-increasing-member-number}';
export const POLICY_NUMBER_CODE_MIN_LENGTH = 2;
export const POLICY_NUMBER_CODE_MAX_LENGTH = 5;
export const POLICY_NUMBER_CODE_TAKEN_MESSAGE =
  'This product number has already been used for another package';
const POLICY_NUMBER_CODE_REGEX = /^[A-Z0-9]{2,5}$/;

export function normalizePolicyNumberCode(raw: string | null | undefined): string {
  return (raw ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, POLICY_NUMBER_CODE_MAX_LENGTH);
}

export function validatePolicyNumberCode(raw: string | null | undefined): string {
  const code = normalizePolicyNumberCode(raw);
  if (!POLICY_NUMBER_CODE_REGEX.test(code)) {
    throw ValidationException.forField(
      'policyNumberCode',
      'Policy number format must be 2–5 letters or numbers',
      ErrorCodes.VALIDATION_ERROR
    );
  }
  return code;
}

export function buildPolicyNumberFormat(code: string): string {
  return `MP/${code}/${POLICY_NUMBER_PLACEHOLDER}`;
}

export function buildMemberNumberFormat(code: string): string {
  return `${code}${POLICY_NUMBER_PLACEHOLDER}-${MEMBER_NUMBER_PLACEHOLDER}`;
}

export function extractPolicyNumberCode(
  policyNumberFormat: string | null | undefined
): string | null {
  if (!policyNumberFormat) return null;
  const match = policyNumberFormat
    .trim()
    .match(/^MP\/([^/]+)\/\{auto-increasing-policy-number\}$/);
  if (!match?.[1]) return null;
  const code = normalizePolicyNumberCode(match[1]);
  return POLICY_NUMBER_CODE_REGEX.test(code) ? code : null;
}

export function policyNumberCodeConflictWhere(code: string): {
  OR: Array<
    | { policyNumberFormat: string }
    | { policyNumberFormat: { startsWith: string } }
    | { memberNumberFormat: { startsWith: string } }
  >;
} {
  return {
    OR: [
      { policyNumberFormat: buildPolicyNumberFormat(code) },
      { policyNumberFormat: { startsWith: `MP/${code}/` } },
      { memberNumberFormat: { startsWith: `${code}${POLICY_NUMBER_PLACEHOLDER}` } },
    ],
  };
}

export function formatsFromPolicyNumberCode(raw: string | null | undefined): {
  code: string;
  policyNumberFormat: string;
  memberNumberFormat: string;
} {
  const code = validatePolicyNumberCode(raw);
  return {
    code,
    policyNumberFormat: buildPolicyNumberFormat(code),
    memberNumberFormat: buildMemberNumberFormat(code),
  };
}

export function validatePolicyNumberFormat(raw: string | null | undefined): string {
  const format = raw?.trim() ?? '';
  if (!format) {
    throw ValidationException.forField(
      'policyNumberFormat',
      `Policy number format is required and must include ${POLICY_NUMBER_PLACEHOLDER}`,
      ErrorCodes.VALIDATION_ERROR
    );
  }
  if (!format.includes(POLICY_NUMBER_PLACEHOLDER)) {
    throw ValidationException.forField(
      'policyNumberFormat',
      `Policy number format must include ${POLICY_NUMBER_PLACEHOLDER}`,
      ErrorCodes.VALIDATION_ERROR
    );
  }
  return format;
}

export function validateMemberNumberFormat(raw: string | null | undefined): string {
  const format = raw?.trim() ?? '';
  if (!format) {
    throw ValidationException.forField(
      'memberNumberFormat',
      `Member number format is required and must include ${MEMBER_NUMBER_PLACEHOLDER}`,
      ErrorCodes.VALIDATION_ERROR
    );
  }
  if (!format.includes(MEMBER_NUMBER_PLACEHOLDER)) {
    throw ValidationException.forField(
      'memberNumberFormat',
      `Member number format must include ${MEMBER_NUMBER_PLACEHOLDER}`,
      ErrorCodes.VALIDATION_ERROR
    );
  }
  return format;
}
