import { formatPhoneNumber, validatePhoneNumber } from '@/lib/phone-validation';

const SYNTHETIC_DOMAIN = 'maishapoa.customer';

/**
 * Maps national Kenyan mobile (01/07 + 8 digits) to Supabase synthetic email (matches API `buildSyntheticCustomerEmail`).
 */
export function nationalPhoneToSyntheticEmail(nationalPhone: string): string {
  const digits = formatPhoneNumber(nationalPhone);
  if (!validatePhoneNumber(digits)) {
    throw new Error('Enter a valid 10-digit mobile number starting with 01 or 07');
  }
  return `${digits}@${SYNTHETIC_DOMAIN}`;
}
