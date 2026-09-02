const MASK_CHAR = '*';
const PHONE_VISIBLE_START = 4;
const PHONE_VISIBLE_END = 3;
const PHONE_MASK_LEN = 3;

/**
 * Mask a phone number for list/detail API responses.
 * Shows the first four and last three digits with three mask characters in between.
 * Already-masked values are left unchanged.
 */
export function maskPhoneNumberForDisplay(
  phoneNumber: string | null | undefined
): string | null {
  if (phoneNumber == null) {
    return null;
  }
  const trimmed = phoneNumber.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.includes(MASK_CHAR)) {
    return trimmed;
  }

  const cleanPhone = trimmed.replace(/\D/g, '');
  if (!cleanPhone) {
    return null;
  }
  if (cleanPhone.length < PHONE_VISIBLE_START + PHONE_VISIBLE_END) {
    return MASK_CHAR.repeat(Math.max(PHONE_MASK_LEN, cleanPhone.length));
  }

  const start = cleanPhone.substring(0, PHONE_VISIBLE_START);
  const end = cleanPhone.substring(cleanPhone.length - PHONE_VISIBLE_END);
  const masked = `${start}${MASK_CHAR.repeat(PHONE_MASK_LEN)}${end}`;
  return trimmed.startsWith('+') ? `+${masked}` : masked;
}

export function maskPhoneNumberOrEmpty(phoneNumber: string | null | undefined): string {
  return maskPhoneNumberForDisplay(phoneNumber) ?? '';
}

/**
 * Mask a date of birth for list/detail API responses.
 * Returns the four-digit year only. Already year-only values are left unchanged.
 */
export function maskDateOfBirthForDisplay(
  dateOfBirth: Date | string | null | undefined
): string | null {
  if (dateOfBirth == null) {
    return null;
  }
  if (typeof dateOfBirth === 'string') {
    const trimmed = dateOfBirth.trim();
    if (!trimmed) {
      return null;
    }
    if (/^\d{4}$/.test(trimmed)) {
      return trimmed;
    }
    if (trimmed.includes(MASK_CHAR)) {
      return trimmed;
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return String(parsed.getUTCFullYear());
  }
  if (Number.isNaN(dateOfBirth.getTime())) {
    return null;
  }
  return String(dateOfBirth.getUTCFullYear());
}

export function maskDateOfBirthOrEmpty(
  dateOfBirth: Date | string | null | undefined
): string {
  return maskDateOfBirthForDisplay(dateOfBirth) ?? '';
}
