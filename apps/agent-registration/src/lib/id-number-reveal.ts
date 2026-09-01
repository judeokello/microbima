export const ID_NUMBER_REVEAL_MS = 30_000

export type IdNumberEntityKind = 'CUSTOMER' | 'SPOUSE' | 'CHILD' | 'PARENT' | 'BENEFICIARY'

export function idNumberRevealKey(
  customerId: string,
  entityKind: IdNumberEntityKind,
  entityId?: string
): string {
  return `${customerId}:${entityKind}:${entityId ?? customerId}`
}

export function hasRevealableIdNumber(value: string | null | undefined): boolean {
  if (value == null) return false
  const trimmed = value.trim()
  if (!trimmed || trimmed === 'N/A') return false
  return true
}
