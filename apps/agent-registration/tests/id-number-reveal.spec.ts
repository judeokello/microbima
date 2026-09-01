import {
  hasRevealableIdNumber,
  idNumberRevealKey,
  ID_NUMBER_REVEAL_MS,
} from '../src/lib/id-number-reveal'
import { maskIdNumber } from '../src/lib/data-masking'

describe('id number reveal helpers', () => {
  it('uses a 30 second reveal window', () => {
    expect(ID_NUMBER_REVEAL_MS).toBe(30_000)
  })

  it('builds a unique key per entity', () => {
    expect(idNumberRevealKey('cust-1', 'CUSTOMER')).toBe('cust-1:CUSTOMER:cust-1')
    expect(idNumberRevealKey('cust-1', 'SPOUSE', 'sp-1')).toBe('cust-1:SPOUSE:sp-1')
  })

  it('treats empty and N/A as not revealable', () => {
    expect(hasRevealableIdNumber(null)).toBe(false)
    expect(hasRevealableIdNumber('')).toBe(false)
    expect(hasRevealableIdNumber('N/A')).toBe(false)
    expect(hasRevealableIdNumber('12****78')).toBe(true)
  })

  it('masks IDs with first and last two characters', () => {
    expect(maskIdNumber('12345678')).toBe('12****78')
  })
})
