export type PlaceholderCategory = 'customer' | 'policy' | 'product' | 'support'

export interface PlaceholderDef {
  key: string
  label: string
  category: PlaceholderCategory
}

export const PLACEHOLDER_CATEGORY_LABELS: Record<PlaceholderCategory, string> = {
  customer: 'Customer',
  policy: 'Policy',
  product: 'Product',
  support: 'Support',
}

export const PLACEHOLDER_CATALOG: PlaceholderDef[] = [
  { key: 'first_name', label: 'First name', category: 'customer' },
  { key: 'last_name', label: 'Last name', category: 'customer' },
  { key: 'email', label: 'Email', category: 'customer' },
  { key: 'phone_number', label: 'Phone number', category: 'customer' },
  { key: 'policy_number', label: 'Policy number', category: 'policy' },
  { key: 'scheme_name', label: 'Scheme name', category: 'policy' },
  { key: 'product_name', label: 'Product name', category: 'product' },
  { key: 'general_support_number', label: 'General support number', category: 'support' },
  { key: 'medical_support_number', label: 'Medical support number', category: 'support' },
]

export const PLACEHOLDER_CATEGORY_ORDER: PlaceholderCategory[] = [
  'customer',
  'policy',
  'product',
  'support',
]

export function placeholdersByCategory(
  catalog: PlaceholderDef[] = PLACEHOLDER_CATALOG,
): Array<{ category: PlaceholderCategory; label: string; items: PlaceholderDef[] }> {
  return PLACEHOLDER_CATEGORY_ORDER.map((category) => ({
    category,
    label: PLACEHOLDER_CATEGORY_LABELS[category],
    items: catalog.filter((p) => p.category === category),
  })).filter((g) => g.items.length > 0)
}

export function extractUsedPlaceholderKeys(text: string): string[] {
  const matches = text.match(/\{([a-z0-9_]+)\}/g) ?? []
  return matches.map((m) => m.slice(1, -1))
}

export function insertPlaceholderToken(text: string, key: string): string {
  return `${text}{${key}}`
}

/** Remove a single `{key}` occurrence by 0-based index among matches of that key. */
export function removePlaceholderOccurrence(
  text: string,
  key: string,
  occurrenceIndex: number,
): string {
  const token = `{${key}}`
  let from = 0
  let seen = 0
  while (from < text.length) {
    const idx = text.indexOf(token, from)
    if (idx === -1) return text
    if (seen === occurrenceIndex) {
      return text.slice(0, idx) + text.slice(idx + token.length)
    }
    seen += 1
    from = idx + token.length
  }
  return text
}

/** @deprecated Prefer removePlaceholderOccurrence for per-chip remove. */
export function removePlaceholderToken(text: string, key: string): string {
  return removePlaceholderOccurrence(text, key, 0)
}
