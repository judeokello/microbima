import {
  normalizePhoneNumber,
  recipientPhoneSearchVariants,
  toNationalPhoneNumber,
  tryToNationalPhoneNumber,
} from '../phone-number.util';

describe('toNationalPhoneNumber', () => {
  it('converts international and local inputs to 0XXXXXXXXX', () => {
    expect(toNationalPhoneNumber('254700000001')).toBe('0700000001');
    expect(toNationalPhoneNumber('0700000001')).toBe('0700000001');
    expect(toNationalPhoneNumber('+254700000001')).toBe('0700000001');
  });

  it('tryToNationalPhoneNumber returns null for invalid input', () => {
    expect(tryToNationalPhoneNumber('')).toBeNull();
    expect(tryToNationalPhoneNumber('123')).toBeNull();
  });

  it('normalizePhoneNumber remains international for provider send', () => {
    expect(normalizePhoneNumber('0700000001')).toBe('254700000001');
  });
});

describe('recipientPhoneSearchVariants', () => {
  it('includes national and international forms', () => {
    const fromNational = recipientPhoneSearchVariants('0700000001');
    expect(fromNational).toEqual(expect.arrayContaining(['0700000001', '254700000001']));

    const fromIntl = recipientPhoneSearchVariants('254700000001');
    expect(fromIntl).toEqual(expect.arrayContaining(['254700000001', '0700000001']));
  });
});
