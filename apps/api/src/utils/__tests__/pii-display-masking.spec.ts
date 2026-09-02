import {
  maskDateOfBirthForDisplay,
  maskPhoneNumberForDisplay,
  maskPhoneNumberOrEmpty,
} from '../pii-display-masking';

describe('maskPhoneNumberForDisplay', () => {
  it('returns null for missing values', () => {
    expect(maskPhoneNumberForDisplay(null)).toBeNull();
    expect(maskPhoneNumberForDisplay(undefined)).toBeNull();
    expect(maskPhoneNumberForDisplay('')).toBeNull();
    expect(maskPhoneNumberForDisplay('   ')).toBeNull();
  });

  it('shows first four digits, three masks, and last three digits', () => {
    expect(maskPhoneNumberForDisplay('0723995811')).toBe('0723***811');
  });

  it('leaves already-masked values unchanged', () => {
    expect(maskPhoneNumberForDisplay('0723***811')).toBe('0723***811');
  });

  it('preserves a leading plus', () => {
    expect(maskPhoneNumberForDisplay('+254723995811')).toBe('+2547***811');
  });

  it('maskPhoneNumberOrEmpty returns empty string when missing', () => {
    expect(maskPhoneNumberOrEmpty(null)).toBe('');
    expect(maskPhoneNumberOrEmpty('0723995811')).toBe('0723***811');
  });
});

describe('maskDateOfBirthForDisplay', () => {
  it('returns null for missing values', () => {
    expect(maskDateOfBirthForDisplay(null)).toBeNull();
    expect(maskDateOfBirthForDisplay(undefined)).toBeNull();
    expect(maskDateOfBirthForDisplay('')).toBeNull();
  });

  it('returns the year only from an ISO date', () => {
    expect(maskDateOfBirthForDisplay('1976-12-28')).toBe('1976');
  });

  it('returns the year only from a Date', () => {
    expect(maskDateOfBirthForDisplay(new Date(Date.UTC(1976, 11, 28)))).toBe('1976');
  });

  it('leaves a year-only value unchanged', () => {
    expect(maskDateOfBirthForDisplay('1976')).toBe('1976');
  });
});
