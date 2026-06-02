import { normalizePhoneNumber } from './phone-number.util';

const SYNTHETIC_DOMAIN = 'maishapoa.customer';

/** National format 07XXXXXXXX (10 digits) for Kenya MSISDN display and synthetic email local-part. */
export function international254ToNational07(international254: string): string {
  const normalized = normalizePhoneNumber(international254);
  if (!normalized.startsWith('254') || normalized.length !== 12) {
    throw new Error(`Expected 254… international MSISDN, got length ${normalized.length}`);
  }
  return `0${normalized.slice(3)}`;
}

/**
 * Build canonical national 07… string and Supabase synthetic email from stored customer phone (any supported format).
 */
export function buildSyntheticCustomerEmail(storedPhone: string): { national07: string; email: string } {
  const national07 = international254ToNational07(storedPhone);
  const email = `${national07}@${SYNTHETIC_DOMAIN}`;
  return { national07, email };
}

/**
 * Deep-link display mask per DESIGN.md: 07••••• + last 4 digits.
 */
export function maskNationalPhoneForPortal(national07: string): string {
  const digits = national07.replace(/\D/g, '');
  if (digits.length < 10) {
    return '';
  }
  const last4 = digits.slice(-4);
  return `07•••••${last4}`;
}

/** Default registration OTP length (research R4). */
export const PORTAL_REGISTRATION_OTP_LENGTH = 6;

export function generatePortalRegistrationOtp(length: number = PORTAL_REGISTRATION_OTP_LENGTH): string {
  const n = Math.max(4, Math.min(10, length));
  let out = '';
  for (let i = 0; i < n; i++) {
    out += Math.floor(Math.random() * 10).toString();
  }
  return out;
}
