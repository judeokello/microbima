/** Letters for policy payment-account suffix (2nd policy = B). Excludes A, I, J, O. */
export const POLICY_SUFFIX_LETTERS = 'BCDEFGHKLMNPQRSTUVWXYZ';

export function policySuffixLetterAt(index: number): string {
  const n = POLICY_SUFFIX_LETTERS.length;
  if (index < n) return POLICY_SUFFIX_LETTERS[index];
  const i = index - n;
  const first = Math.floor(i / n);
  const second = i % n;
  return POLICY_SUFFIX_LETTERS[first] + POLICY_SUFFIX_LETTERS[second];
}

/**
 * Suffix for a new occupying policy given how many occupying policies already exist.
 * 0 occupying → no suffix (use id number). 1 occupying → B. 2 occupying → C.
 */
export function occupyingPolicyPaymentAcSuffix(occupyingCountBeforeNew: number): string | null {
  if (occupyingCountBeforeNew <= 0) return null;
  return policySuffixLetterAt(occupyingCountBeforeNew - 1);
}
