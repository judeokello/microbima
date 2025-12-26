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

