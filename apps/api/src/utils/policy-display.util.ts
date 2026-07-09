import type { PolicyStatus } from '@prisma/client';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Format UTC date as `DD Mon` for policy dropdown labels. */
export function formatPolicyLabelDate(date: Date): string {
  const day = date.getUTCDate();
  const month = MONTHS_SHORT[date.getUTCMonth()] ?? '';
  return `${day} ${month}`;
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
  if (status === 'DEACTIVATED' || status === 'TERMINATED') {
    const ended = params.endDate ?? params.deactivatedAt;
    const suffix = ended
      ? `(${status}, ended ${formatPolicyLabelDate(ended)})`
      : `(${status})`;
    return `${base} ${suffix}`;
  }

  if (status === 'ACTIVE' || status === 'PENDING_ACTIVATION' || status === 'SUSPENDED') {
    const suffix = params.startDate
      ? `(${status}, from ${formatPolicyLabelDate(params.startDate)})`
      : `(${status})`;
    return `${base} ${suffix}`;
  }

  return `${base} (${status})`;
}
