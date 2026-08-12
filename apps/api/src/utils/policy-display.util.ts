import type { PolicyStatus } from '@prisma/client';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Format UTC date as `DD Mon YY` for policy dropdown labels. */
export function formatPolicyLabelDate(date: Date): string {
  const day = date.getUTCDate();
  const month = MONTHS_SHORT[date.getUTCMonth()] ?? '';
  const year = String(date.getUTCFullYear() % 100).padStart(2, '0');
  return `${day} ${month} ${year}`;
}

/** Term span for dropdown: `31 Mar 26–30 Mar 27`. */
export function formatPolicyTermRange(
  startDate?: Date | null,
  endDate?: Date | null
): string | null {
  if (startDate && endDate) {
    return `${formatPolicyLabelDate(startDate)}–${formatPolicyLabelDate(endDate)}`;
  }
  if (startDate) return `from ${formatPolicyLabelDate(startDate)}`;
  if (endDate) return `ended ${formatPolicyLabelDate(endDate)}`;
  return null;
}

export function buildPolicyDisplayText(params: {
  packageName: string;
  planName?: string | null;
  status: PolicyStatus;
  startDate?: Date | null;
  endDate?: Date | null;
  deactivatedAt?: Date | null;
}): string {
  const base = params.planName
    ? `${params.packageName} - ${params.planName}`
    : params.packageName;

  const status = params.status;
  const term = formatPolicyTermRange(params.startDate, params.endDate);

  if (status === 'DEACTIVATED' || status === 'TERMINATED') {
    const parts: string[] = [status];
    if (term) parts.push(term);
    if (params.deactivatedAt) {
      parts.push(`off ${formatPolicyLabelDate(params.deactivatedAt)}`);
    } else if (!term && params.endDate) {
      parts.push(`ended ${formatPolicyLabelDate(params.endDate)}`);
    }
    return parts.length > 1 ? `${base} (${parts.join(', ')})` : `${base} (${status})`;
  }

  if (status === 'ACTIVE' || status === 'PENDING_ACTIVATION' || status === 'SUSPENDED' || status === 'INACTIVE') {
    return term ? `${base} (${status}, ${term})` : `${base} (${status})`;
  }

  if (status === 'EXPIRED') {
    const ended = params.endDate;
    const suffix = ended
      ? `(EXPIRED, ended ${formatPolicyLabelDate(ended)})`
      : '(EXPIRED)';
    return `${base} ${suffix}`;
  }

  return `${base} (${status})`;
}
