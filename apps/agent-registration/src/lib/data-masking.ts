/**
 * Data masking utilities for sensitive information
 */

/**
 * Masks a phone number for display purposes
 * @param phoneNumber - The phone number to mask
 * @param maskChar - Character to use for masking (default: '*')
 * @param visibleStart - Number of characters to show at start (default: 4)
 * @param visibleEnd - Number of characters to show at end (default: 3)
 * @returns Masked phone number string
 *
 * @example
 * maskPhoneNumber('+254712345678') // '+254***678'
 * maskPhoneNumber('0712345678') // '0712***678'
 */
export function maskPhoneNumber(
  phoneNumber: string | null | undefined,
  maskChar: string = '*',
  visibleStart: number = 4,
  visibleEnd: number = 3
): string {
  if (!phoneNumber || phoneNumber.trim() === '') {
    return 'N/A';
  }

  const cleanPhone = phoneNumber.replace(/\D/g, ''); // Remove non-digits

  if (cleanPhone.length < visibleStart + visibleEnd) {
    // If phone is too short, just show first few characters
    return cleanPhone.substring(0, visibleStart) + maskChar.repeat(3);
  }

  const start = cleanPhone.substring(0, visibleStart);
  const end = cleanPhone.substring(cleanPhone.length - visibleEnd);
  const maskedMiddle = maskChar.repeat(Math.max(3, cleanPhone.length - visibleStart - visibleEnd));

  // Preserve original format if it had country code or other formatting
  if (phoneNumber.startsWith('+')) {
    return `+${start}${maskedMiddle}${end}`;
  }

  return `${start}${maskedMiddle}${end}`;
}

/**
 * Formats a phone number for display (unmasked)
 * @param phoneNumber - The phone number to format
 * @returns Formatted phone number string
 */
export function formatPhoneNumber(phoneNumber: string | null | undefined): string {
  if (!phoneNumber || phoneNumber.trim() === '') {
    return 'N/A';
  }

  // Clean the phone number
  const cleanPhone = phoneNumber.replace(/\D/g, '');

  // Format Kenyan phone numbers
  if (cleanPhone.length === 10 && (cleanPhone.startsWith('01') || cleanPhone.startsWith('07'))) {
    return `+254${cleanPhone.substring(1)}`;
  }

  if (cleanPhone.length === 12 && cleanPhone.startsWith('254')) {
    return `+${cleanPhone}`;
  }

  // Return as-is if it doesn't match expected patterns
  return phoneNumber;
}

/**
 * Masks an ID number for display purposes
 * @param idNumber - The ID number to mask
 * @param maskChar - Character to use for masking (default: '*')
 * @param visibleStart - Number of characters to show at start (default: 2)
 * @param visibleEnd - Number of characters to show at end (default: 2)
 * @returns Masked ID number string
 */
export function maskIdNumber(
  idNumber: string | null | undefined,
  maskChar: string = '*',
  visibleStart: number = 2,
  visibleEnd: number = 2
): string {
  if (!idNumber || idNumber.trim() === '') {
    return 'N/A';
  }

  if (idNumber.length < visibleStart + visibleEnd) {
    return maskChar.repeat(idNumber.length);
  }

  const start = idNumber.substring(0, visibleStart);
  const end = idNumber.substring(idNumber.length - visibleEnd);
  const maskedMiddle = maskChar.repeat(Math.max(2, idNumber.length - visibleStart - visibleEnd));

  return `${start}${maskedMiddle}${end}`;
}

/**
 * Formats a full name from individual name components
 * @param firstName - First name
 * @param middleName - Middle name (optional)
 * @param lastName - Last name
 * @returns Formatted full name string
 */
export function formatFullName(
  firstName: string | null | undefined,
  middleName?: string | null | undefined,
  lastName?: string | null | undefined
): string {
  const parts = [firstName, middleName, lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : 'N/A';
}

/**
 * Formats a first name only
 * @param firstName - First name
 * @returns Formatted first name string
 */
export function formatFirstName(firstName: string | null | undefined): string {
  return firstName?.trim() ?? 'N/A';
}
