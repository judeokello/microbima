import { isTemplateDraftDirty } from '../src/lib/messaging/template-draft'
import {
  extractUsedPlaceholderKeys,
  insertPlaceholderToken,
  placeholdersByCategory,
  removePlaceholderToken,
} from '../src/lib/messaging/placeholder-catalog'

describe('isTemplateDraftDirty', () => {
  const baseline = {
    subject: 'Hi',
    body: 'Hello {first_name}',
    description: 'Welcome',
    isActive: true,
  }

  it('is false when draft matches baseline', () => {
    expect(isTemplateDraftDirty({ ...baseline }, baseline)).toBe(false)
  })

  it('is true when body changes', () => {
    expect(isTemplateDraftDirty({ ...baseline, body: 'Changed' }, baseline)).toBe(true)
  })

  it('is false again after reverting body', () => {
    const dirty = { ...baseline, body: 'Changed' }
    expect(isTemplateDraftDirty(dirty, baseline)).toBe(true)
    expect(isTemplateDraftDirty({ ...dirty, body: baseline.body }, baseline)).toBe(false)
  })

  it('is true when isActive flips', () => {
    expect(isTemplateDraftDirty({ ...baseline, isActive: false }, baseline)).toBe(true)
  })

  it('is false with null baseline', () => {
    expect(isTemplateDraftDirty(baseline, null)).toBe(false)
  })
})

describe('placeholder catalog helpers', () => {
  it('groups placeholders into customer/policy/product/support', () => {
    const groups = placeholdersByCategory()
    expect(groups.map((g) => g.category)).toEqual(['customer', 'policy', 'product', 'support'])
    expect(groups.find((g) => g.category === 'customer')?.items.length).toBeGreaterThan(0)
  })

  it('extracts, inserts, and removes placeholder tokens', () => {
    const withToken = insertPlaceholderToken('Hi ', 'first_name')
    expect(withToken).toBe('Hi {first_name}')
    expect(extractUsedPlaceholderKeys(withToken)).toEqual(['first_name'])
    expect(removePlaceholderToken(withToken, 'first_name')).toBe('Hi ')
  })
})
