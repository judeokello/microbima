import { ValidationException } from '../exceptions/validation.exception';

/**
 * Normalizes a phone number to international format (254XXXXXXXXX)
 *
 * @param phone - Phone number in any format (e.g., "0722000000", "254722000000", "+254722000000")
 * @returns Normalized phone number in format 254XXXXXXXXX
 * @throws ValidationException if phone number is invalid
 *
 * @example
 * normalizePhoneNumber("0722000000") // Returns "254722000000"
 * normalizePhoneNumber("254722000000") // Returns "254722000000"
 * normalizePhoneNumber("+254722000000") // Returns "254722000000"
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone || typeof phone !== 'string') {
    throw ValidationException.forField('phoneNumber', 'Phone number is required');
  }

  // Remove all non-numeric characters (spaces, dashes, plus signs, etc.)
  let normalized = phone.replace(/\D/g, '');

  // Handle edge cases
  if (normalized.length === 0) {
    throw ValidationException.forField('phoneNumber', 'Phone number cannot be empty');
  }

  // Strip leading zeros
  normalized = normalized.replace(/^0+/, '');

  // If number starts with 254, it's already in international format
  if (normalized.startsWith('254')) {
    // Validate length: 254 + 9 digits = 12 digits total
    if (normalized.length !== 12) {
      throw ValidationException.forField(
        'phoneNumber',
        `Invalid phone number length. Expected 12 digits (254XXXXXXXXX), got ${normalized.length} digits`
      );
    }
    return normalized;
  }

  // If number doesn't start with 254, assume it's a local number and add country code
  // Kenyan phone numbers are 9 digits after country code
  if (normalized.length === 9) {
    return `254${normalized}`;
  }

  // If length is 10, it might be a number with leading zero that wasn't stripped
  // (e.g., "0722000000" after stripping zeros becomes "722000000" which is 9 digits)
  // But if we still have 10 digits, it's invalid
  if (normalized.length === 10) {
    // Try stripping one more leading zero
    const withoutLeadingZero = normalized.replace(/^0+/, '');
    if (withoutLeadingZero.length === 9) {
      return `254${withoutLeadingZero}`;
    }
    throw ValidationException.forField(
      'phoneNumber',
      `Invalid phone number format. Expected 9 digits (XXXXXXXXX) or 12 digits (254XXXXXXXXX), got ${normalized.length} digits`
    );
  }

  // Invalid length
  throw ValidationException.forField(
    'phoneNumber',
    `Invalid phone number format. Expected 9 digits (XXXXXXXXX) or 12 digits (254XXXXXXXXX), got ${normalized.length} digits`
  );
}

/** Regex for 64-char lowercase hex (SHA-256 hash from M-Pesa IPN). */
const SHA256_HEX_REGEX = /^[a-f0-9]{64}$/;

/**
 * Returns true if the value looks like a SHA-256 hashed MSISDN (64 lowercase hex chars).
 * M-Pesa may send hashed MSISDN in production IPN; do not normalize or validate as phone.
 */
export function isHashedMsisdn(value: string | null | undefined): boolean {
  if (!value || typeof value !== 'string') return false;
  return SHA256_HEX_REGEX.test(value.trim().toLowerCase());
}

/**
 * Returns normalized phone (254XXXXXXXXX) or raw value for storage.
 * If value is a hashed MSISDN (64 hex chars), returns { normalized: false, value: raw } and caller should store as-is.
 * Otherwise normalizes and returns { normalized: true, value: normalizedPhone }; throws if invalid phone.
 */
export function normalizeMsisdnOrReturnRaw(
  value: string
): { normalized: true; value: string } | { normalized: false; value: string } {
  if (isHashedMsisdn(value)) {
    return { normalized: false, value: value.trim() };
  }
  return { normalized: true, value: normalizePhoneNumber(value) };
}

