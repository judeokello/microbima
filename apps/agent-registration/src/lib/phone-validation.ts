/**
 * Phone number validation utilities
 * Validates Kenyan phone numbers: must be 10 digits starting with 01 or 07
 *
 * These functions are used across all forms that handle phone numbers:
 * - /register/customer (principal member, spouse, children)
 * - /register/beneficiary
 * - Customer detail edit dialogs (customer, dependant, beneficiary)
 */

/**
 * Validates a phone number
 * @param phone - Phone number string
 * @returns true if valid (10 digits starting with 01 or 07), false otherwise
 * @note Empty strings return false - callers should check for empty separately for optional fields
 */
export const validatePhoneNumber = (phone: string): boolean => {
  // Remove any non-digit characters
  const cleanPhone = phone.replace(/\D/g, '');
  // Check if it starts with 01 or 07 and is exactly 10 digits
  return /^(01|07)\d{8}$/.test(cleanPhone);
};

/**
 * Formats a phone number by removing non-digit characters and limiting to 10 digits
 * @param phone - Phone number string
 * @returns Formatted phone number (digits only, max 10)
 */
export const formatPhoneNumber = (phone: string): string => {
  // Remove any non-digit characters and limit to 10 digits
  return phone.replace(/\D/g, '').substring(0, 10);
};

/**
 * Gets phone number validation error message
 * @param phone - Phone number string
 * @returns Error message or null if valid
 * @note Returns null for empty strings (treats as optional field)
 */
export const getPhoneValidationError = (phone: string): string | null => {
  if (!phone || phone.trim() === '') return null; // Optional field, empty is valid
  if (!validatePhoneNumber(phone)) {
    return 'Phone number must be 10 digits starting with 01 or 07';
  }
  return null;
};

