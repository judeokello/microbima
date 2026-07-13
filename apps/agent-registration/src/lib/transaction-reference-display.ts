const QUERY_PENDING_PREFIX = 'QUERY-PENDING-';
const PENDING_STK_PREFIX = 'PENDING-STK-';

/** Display-only: first segment of suffix, capped at 8 characters. */
function shortenSuffix(suffix: string): string {
  const first = suffix.split('-')[0] ?? suffix;
  return first.slice(0, 8);
}

/**
 * Shorten QUERY-PENDING / PENDING-STK placeholder references for read-only UI.
 * Backend values are unchanged.
 */
export function formatTransactionReferenceForDisplay(
  ref: string | null | undefined
): string {
  if (!ref) return '—';
  if (ref.startsWith(QUERY_PENDING_PREFIX)) {
    const id = ref.slice(QUERY_PENDING_PREFIX.length);
    return `${QUERY_PENDING_PREFIX}${shortenSuffix(id)}`;
  }
  if (ref.startsWith(PENDING_STK_PREFIX)) {
    const id = ref.slice(PENDING_STK_PREFIX.length);
    return `${PENDING_STK_PREFIX}${shortenSuffix(id)}`;
  }
  return ref;
}

/** Human-readable suffix for modify-product payment picker only. */
export function formatMigrationPaymentStatusLabel(
  status: string | null | undefined
): string {
  if (status === 'COMPLETED') return '(Completed)';
  if (status === 'COMPLETED_PENDING_RECEIPT') return '(Pending receipt)';
  return '';
}
