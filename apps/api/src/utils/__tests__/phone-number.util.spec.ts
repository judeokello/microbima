import {
  isHashedMsisdn,
  isMaskedMsisdn,
  isUsableMpesaPhone,
  normalizeMsisdnOrReturnRaw,
} from '../phone-number.util';

describe('phone-number.util MSISDN helpers', () => {
  describe('isHashedMsisdn', () => {
    it('detects 64-char hex hashes', () => {
      expect(isHashedMsisdn('a'.repeat(64))).toBe(true);
      expect(isHashedMsisdn('254722000000')).toBe(false);
    });
  });

  describe('isMaskedMsisdn', () => {
    it('detects asterisk-masked values', () => {
      expect(isMaskedMsisdn('2547****123')).toBe(true);
      expect(isMaskedMsisdn('254722000000')).toBe(false);
      expect(isMaskedMsisdn('')).toBe(false);
    });
  });

  describe('isUsableMpesaPhone', () => {
    it('rejects empty, hashed, and masked values', () => {
      expect(isUsableMpesaPhone('')).toBe(false);
      expect(isUsableMpesaPhone('   ')).toBe(false);
      expect(isUsableMpesaPhone(null)).toBe(false);
      expect(isUsableMpesaPhone(undefined)).toBe(false);
      expect(isUsableMpesaPhone('a'.repeat(64))).toBe(false);
      expect(isUsableMpesaPhone('2547****0000')).toBe(false);
      expect(isUsableMpesaPhone('254722000000')).toBe(true);
    });
  });

  describe('normalizeMsisdnOrReturnRaw', () => {
    it('returns null for empty or missing MSISDN (B2B / org transfers)', () => {
      expect(normalizeMsisdnOrReturnRaw('')).toEqual({ normalized: false, value: null });
      expect(normalizeMsisdnOrReturnRaw('   ')).toEqual({ normalized: false, value: null });
      expect(normalizeMsisdnOrReturnRaw(null)).toEqual({ normalized: false, value: null });
      expect(normalizeMsisdnOrReturnRaw(undefined)).toEqual({ normalized: false, value: null });
    });

    it('stores hashed MSISDN as-is', () => {
      const hashed = 'b'.repeat(64);
      expect(normalizeMsisdnOrReturnRaw(hashed)).toEqual({ normalized: false, value: hashed });
    });

    it('stores masked MSISDN as-is', () => {
      expect(normalizeMsisdnOrReturnRaw('2547****0000')).toEqual({
        normalized: false,
        value: '2547****0000',
      });
    });

    it('normalizes real phone numbers', () => {
      expect(normalizeMsisdnOrReturnRaw('0722000000')).toEqual({
        normalized: true,
        value: '254722000000',
      });
      expect(normalizeMsisdnOrReturnRaw('254722000000')).toEqual({
        normalized: true,
        value: '254722000000',
      });
    });
  });
});
