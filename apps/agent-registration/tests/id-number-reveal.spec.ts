import {
  DATE_OF_BIRTH_REVEAL_MS,
  formatRevealedDateOfBirth,
  hasRevealableIdNumber,
  ID_NUMBER_REVEAL_MS,
  idNumberRevealKey,
  needsPiiReveal,
  PHONE_REVEAL_MS,
  piiRevealKey,
} from '../src/lib/id-number-reveal'
import { maskIdNumber } from '../src/lib/data-masking'
import { maskPhoneNumber } from '../src/lib/data-masking'

describe('pii reveal helpers', () => {
  it('uses a 20 second reveal window for ID numbers and phone numbers', () => {
    expect(ID_NUMBER_REVEAL_MS).toBe(20_000)
    expect(PHONE_REVEAL_MS).toBe(20_000)
  })

  it('uses a 15 second reveal window for date of birth', () => {
    expect(DATE_OF_BIRTH_REVEAL_MS).toBe(15_000)
  })

  it('builds a unique key per entity and field', () => {
    expect(idNumberRevealKey('cust-1', 'CUSTOMER')).toBe('cust-1:CUSTOMER:cust-1:ID_NUMBER')
    expect(idNumberRevealKey('cust-1', 'SPOUSE', 'sp-1')).toBe('cust-1:SPOUSE:sp-1:ID_NUMBER')
    expect(piiRevealKey('cust-1', 'CUSTOMER', 'PHONE')).toBe('cust-1:CUSTOMER:cust-1:PHONE')
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

  it('masks phones with first four, three stars, and last three', () => {
    expect(maskPhoneNumber('0723995811')).toBe('0723***811')
  })

  it('formats a revealed date of birth in UTC', () => {
    expect(formatRevealedDateOfBirth('1976-12-28')).toBe('December 28, 1976')
  })

  it('fetches a full date of birth when only the year is present', () => {
    expect(needsPiiReveal('DATE_OF_BIRTH', '1976')).toBe(true)
    expect(needsPiiReveal('DATE_OF_BIRTH', '1976-12-28')).toBe(false)
  })

  it('fetches phone and ID only when they are masked', () => {
    expect(needsPiiReveal('PHONE', '0723***811')).toBe(true)
    expect(needsPiiReveal('PHONE', '0723995811')).toBe(false)
    expect(needsPiiReveal('ID_NUMBER', '12****78')).toBe(true)
  })
})
