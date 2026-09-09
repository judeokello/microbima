export const POLICY_NUMBER_PLACEHOLDER = '{auto-increasing-policy-number}';
export const MEMBER_NUMBER_PLACEHOLDER = '{auto-increasing-member-number}';
export const POLICY_NUMBER_CODE_MIN_LENGTH = 2;
export const POLICY_NUMBER_CODE_MAX_LENGTH = 5;

export function normalizePolicyNumberCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, POLICY_NUMBER_CODE_MAX_LENGTH);
}

export function isValidPolicyNumberCode(raw: string): boolean {
  const code = normalizePolicyNumberCode(raw);
  return code.length >= POLICY_NUMBER_CODE_MIN_LENGTH && code.length <= POLICY_NUMBER_CODE_MAX_LENGTH;
}

export function buildPolicyNumberFormat(code: string): string {
  return `MP/${code}/${POLICY_NUMBER_PLACEHOLDER}`;
}

export function buildMemberNumberFormat(code: string): string {
  return `${code}${POLICY_NUMBER_PLACEHOLDER}-${MEMBER_NUMBER_PLACEHOLDER}`;
}

export function extractPolicyNumberCode(policyNumberFormat: string | null | undefined): string {
  if (!policyNumberFormat) return '';
  const match = policyNumberFormat
    .trim()
    .match(/^MP\/([^/]+)\/\{auto-increasing-policy-number\}$/);
  return match?.[1] ? normalizePolicyNumberCode(match[1]) : '';
}
