const DEFAULT_MASK_CHAR = '*';
const DEFAULT_VISIBLE_START = 2;
const DEFAULT_VISIBLE_END = 2;

/**
 * Mask an ID number for list/detail API responses.
 * Shows the first and last two characters. Already-masked values are left unchanged.
 */
export function maskIdNumberForDisplay(
  idNumber: string | null | undefined,
  maskChar: string = DEFAULT_MASK_CHAR,
  visibleStart: number = DEFAULT_VISIBLE_START,
  visibleEnd: number = DEFAULT_VISIBLE_END
): string | null {
  if (idNumber == null) {
    return null;
  }
  const trimmed = idNumber.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.includes(maskChar)) {
    return trimmed;
  }
  if (trimmed.length < visibleStart + visibleEnd) {
    return maskChar.repeat(trimmed.length);
  }
  const start = trimmed.substring(0, visibleStart);
  const end = trimmed.substring(trimmed.length - visibleEnd);
  const maskedMiddle = maskChar.repeat(Math.max(2, trimmed.length - visibleStart - visibleEnd));
  return `${start}${maskedMiddle}${end}`;
}

export function maskIdNumberOrEmpty(idNumber: string | null | undefined): string {
  return maskIdNumberForDisplay(idNumber) ?? '';
}
