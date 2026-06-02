/**
 * Customer portal chosen-PIN rules (spec FR-019). Shared by API and portal UI.
 * PIN length: 6 digits (Supabase minimum password length requirement).
 */
export function isEasilyGuessablePortalPin(pin: string): boolean {
  if (!/^[0-9]{6}$/.test(pin)) {
    return true;
  }
  if (/^(\d)\1{5}$/.test(pin)) {
    return true;
  }
  const d = [...pin].map(Number);
  let ascending = true;
  let descending = true;
  for (let i = 1; i < d.length; i++) {
    if (d[i] !== d[i - 1] + 1) ascending = false;
    if (d[i] !== d[i - 1] - 1) descending = false;
  }
  return ascending || descending;
}

export const WEAK_PORTAL_PIN_MESSAGE =
  'This PIN is too easy to guess. Avoid repeated digits or simple sequences such as 123456 or 654321.';
