export const ID_NUMBER_REVEAL_MS = 20_000
export const PHONE_REVEAL_MS = 20_000
export const DATE_OF_BIRTH_REVEAL_MS = 15_000

export type IdNumberEntityKind = 'CUSTOMER' | 'SPOUSE' | 'CHILD' | 'PARENT' | 'BENEFICIARY'
export type PiiRevealField = 'ID_NUMBER' | 'PHONE' | 'DATE_OF_BIRTH'

export function piiRevealKey(
  customerId: string,
  entityKind: IdNumberEntityKind,
  field: PiiRevealField,
  entityId?: string
): string {
  return `${customerId}:${entityKind}:${entityId ?? customerId}:${field}`
}

export function idNumberRevealKey(
  customerId: string,
  entityKind: IdNumberEntityKind,
  entityId?: string
): string {
  return piiRevealKey(customerId, entityKind, 'ID_NUMBER', entityId)
}

export function hasRevealableIdNumber(value: string | null | undefined): boolean {
  if (value == null) return false
  const trimmed = value.trim()
  if (!trimmed || trimmed === 'N/A') return false
  return true
}

export function needsPiiReveal(
  field: PiiRevealField,
  value: string | null | undefined
): boolean {
  if (!hasRevealableIdNumber(value)) return false
  const trimmed = value!.trim()
  if (field === 'DATE_OF_BIRTH') {
    return !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)
  }
  return trimmed.includes('*')
}

export function formatRevealedDateOfBirth(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    })
  } catch {
    return isoDate
  }
}
