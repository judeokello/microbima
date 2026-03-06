/**
 * Returns the trimmed string, or null if the result is empty.
 * Used for optional string fields so the DB stores null instead of empty string.
 */
export function trimOrNull(value: string | undefined | null): string | null {
  if (value == null) return null;
  const t = value.trim();
  return t === '' ? null : t;
}
