import { ValidationException } from '../exceptions/validation.exception';
import { ErrorCodes } from '../enums/error-codes.enum';

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

/**
 * Agent-registration mirror: 10 digits starting with 01 or 07, or 12-digit 254[17]… MSISDN.
 * Call before {@link normalizePhoneNumber} for on-demand STK payloads.
 */
export function assertKenyanPhoneForOndemandStk(phone: string): void {
  if (!phone || typeof phone !== 'string') {
    throw ValidationException.forField('phoneNumber', 'Phone number is required', ErrorCodes.INVALID_PHONE_NUMBER);
  }
  const digits = phone.replace(/\D/g, '');
  if (/^(01|07)\d{8}$/.test(digits)) {
    return;
  }
  if (/^254[17]\d{8}$/.test(digits)) {
    return;
  }
  throw ValidationException.forField(
    'phoneNumber',
    'Phone number must be 10 digits starting with 01 or 07, or a valid 254… MSISDN',
    ErrorCodes.INVALID_PHONE_NUMBER
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
 * Returns true if MSISDN is privacy-masked (contains asterisks), e.g. "2547****123".
 * M-Pesa may send masked values; they cannot be normalized or used as SMS recipients.
 */
export function isMaskedMsisdn(value: string | null | undefined): boolean {
  if (!value || typeof value !== 'string') return false;
  return value.includes('*');
}

/**
 * Returns true when the value can be used as an SMS / STK phone recipient
 * (present, not hashed, not masked). Empty B2B/org-transfer MSISDNs are not usable.
 */
export function isUsableMpesaPhone(value: string | null | undefined): boolean {
  if (value == null || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed === '') return false;
  if (isHashedMsisdn(trimmed) || isMaskedMsisdn(trimmed)) return false;
  return true;
}

/**
 * Returns normalized phone (254XXXXXXXXX) or raw value for storage.
 *
 * M-Pesa IPN may send:
 * - a real MSISDN (normalize to 254…)
 * - a SHA-256 hashed MSISDN (store as-is; cannot SMS / customer-match)
 * - a masked MSISDN with asterisks (store as-is)
 * - empty / missing MSISDN for Organization-to-Organization / B2B transfers (store null)
 *
 * Empty/null/whitespace returns { normalized: false, value: null }.
 * Hashed/masked returns { normalized: false, value: raw }.
 * Otherwise normalizes; throws if the value looks like a phone but is invalid.
 */
export function normalizeMsisdnOrReturnRaw(
  value: string | null | undefined
): { normalized: true; value: string } | { normalized: false; value: string | null } {
  if (value == null || typeof value !== 'string') {
    return { normalized: false, value: null };
  }

  const trimmed = value.trim();
  if (trimmed === '') {
    return { normalized: false, value: null };
  }

  if (isHashedMsisdn(trimmed)) {
    return { normalized: false, value: trimmed };
  }

  if (isMaskedMsisdn(trimmed)) {
    return { normalized: false, value: trimmed };
  }

  return { normalized: true, value: normalizePhoneNumber(trimmed) };
}

/**
 * Convert any accepted Kenyan phone input to national storage form `0XXXXXXXXX`.
 */
export function toNationalPhoneNumber(phone: string): string {
  const international = normalizePhoneNumber(phone);
  return `0${international.slice(3)}`;
}

/**
 * Safe national conversion for messaging persistence (returns null if invalid).
 */
export function tryToNationalPhoneNumber(phone: string | null | undefined): string | null {
  if (!phone || typeof phone !== 'string' || !phone.trim()) return null;
  try {
    return toNationalPhoneNumber(phone.trim());
  } catch {
    return null;
  }
}

/** Match stored national (07…) and legacy international (254…) recipient phones. */
export function recipientPhoneSearchVariants(input: string): string[] {
  const digits = input.replace(/\D/g, '');
  if (!digits) return [];
  const variants = new Set<string>([digits]);
  if (digits.startsWith('254') && digits.length >= 12) {
    variants.add(`0${digits.slice(3)}`);
    variants.add(digits.slice(3));
  } else if (digits.startsWith('0') && digits.length >= 10) {
    variants.add(`254${digits.slice(1)}`);
    variants.add(digits.slice(1));
  } else if (digits.length === 9) {
    variants.add(`0${digits}`);
    variants.add(`254${digits}`);
  }
  return Array.from(variants);
}

