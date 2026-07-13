/** Matches [DIS], [DIS2], [DIS3], … prefix on stored policy numbers. */
const DISABLED_PREFIX_REGEX = /^\[DIS(\d*)\]/;

/** Strip [DIS] / [DISn] prefix to recover the assignable base policy number. */
export function getBasePolicyNumber(policyNumber: string): string {
  return policyNumber.replace(DISABLED_PREFIX_REGEX, '');
}

function parseDisabledPrefixIndex(policyNumber: string): number | null {
  const match = policyNumber.match(DISABLED_PREFIX_REGEX);
  if (!match) return null;
  if (match[1] === '') return 1;
  const parsed = parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed >= 2 ? parsed : null;
}

/** Build disabled storage form: [DIS]base or [DIS2]base, [DIS3]base, … */
export function formatDisabledPolicyNumber(base: string, index: number): string {
  if (index < 1) {
    throw new Error('Disabled policy number index must be >= 1');
  }
  return index === 1 ? `[DIS]${base}` : `[DIS${index}]${base}`;
}

/**
 * Pick the next free disabled policy number for a base value.
 * First use: [DIS]base; subsequent: [DIS2]base, [DIS3]base, …
 */
export function nextDisabledPolicyNumber(
  currentPolicyNumber: string,
  existingPolicyNumbers: Array<string | null | undefined>
): string {
  const base = getBasePolicyNumber(currentPolicyNumber);
  const usedIndices = new Set<number>();

  for (const existing of existingPolicyNumbers) {
    if (!existing) continue;
    if (getBasePolicyNumber(existing) !== base) continue;
    if (existing === base) {
      usedIndices.add(0);
      continue;
    }
    const idx = parseDisabledPrefixIndex(existing);
    if (idx !== null) usedIndices.add(idx);
  }

  let index = 1;
  while (usedIndices.has(index)) index += 1;
  return formatDisabledPolicyNumber(base, index);
}
