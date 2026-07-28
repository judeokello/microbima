import { LctPendingAction, PolicyStatus } from '@prisma/client';

/** Shared domain intent for CSV (and future LCT HTTP) adapters */
export interface LctMemberSyncIntent {
  memberNumber: string;
  action: LctPendingAction;
  policyId: string;
  customerId: string;
  dependantId?: string | null;
  subjectType: 'PRINCIPAL' | 'DEPENDANT';
  reasons: string[];
  employeeName: string;
  staffNumber: string;
  memberName: string;
  gender: string;
  dateOfBirth: string;
  relationship: string;
  email: string;
  phoneNumber: string;
  idNumber: string;
  principalMemberNumber: string;
}

export const LCT_TEMPLATE_KEY = 'lct_customer_export';

export const LCT_PENDING_REASONS = {
  NEW: 'NEW',
  STATUS_CHANGE: 'STATUS_CHANGE',
  PROFILE_CHANGE: 'PROFILE_CHANGE',
  DEPENDANT_REMOVED: 'DEPENDANT_REMOVED',
  POLICY_REPLACED: 'POLICY_REPLACED',
} as const;

export const LCT_ERROR_CODES = {
  ORPHAN_PRINCIPAL: 'ORPHAN_PRINCIPAL',
  MISSING_SPOUSE_ID: 'MISSING_SPOUSE_ID',
} as const;

const DEACTIVATE_STATUSES: PolicyStatus[] = [
  PolicyStatus.INACTIVE,
  PolicyStatus.DEACTIVATED,
  PolicyStatus.TERMINATED,
  PolicyStatus.EXPIRED,
];

/** Map policy status → CSV action, or null if not syncable */
export function mapPolicyStatusToLctAction(
  status: PolicyStatus | string
): LctPendingAction | null {
  switch (status) {
    case PolicyStatus.ACTIVE:
      return LctPendingAction.ACTIVATE;
    case PolicyStatus.SUSPENDED:
      return LctPendingAction.SUSPENDED;
    case PolicyStatus.INACTIVE:
    case PolicyStatus.DEACTIVATED:
    case PolicyStatus.TERMINATED:
    case PolicyStatus.EXPIRED:
      return LctPendingAction.DEACTIVATE;
    case PolicyStatus.PENDING_ACTIVATION:
    default:
      return null;
  }
}

/** Whether a status transition should enqueue an LCT pending action */
export function shouldEnqueueStatusChange(
  fromStatus: string,
  toStatus: string
): boolean {
  const toAction = mapPolicyStatusToLctAction(toStatus);
  if (!toAction) return false;

  if (toStatus === PolicyStatus.ACTIVE) {
    // First activation / reactivation / return from suspended etc.
    return fromStatus !== PolicyStatus.ACTIVE;
  }

  if (toStatus === PolicyStatus.SUSPENDED) {
    return fromStatus !== PolicyStatus.SUSPENDED;
  }

  // DEACTIVATE family: only queue when leaving an actionable "active-like" state
  if (DEACTIVATE_STATUSES.includes(toStatus as PolicyStatus)) {
    const fromActionable =
      fromStatus === PolicyStatus.ACTIVE || fromStatus === PolicyStatus.SUSPENDED;
    // non-active → non-active (e.g. SUSPENDED → TERMINATED): do NOT queue
    // Plan: SUSPENDED → TERMINATED does not queue. ACTIVE → TERMINATED does.
    if (fromStatus === PolicyStatus.SUSPENDED) {
      return false;
    }
    return fromActionable || fromStatus === PolicyStatus.ACTIVE;
  }

  return false;
}

export function normalizeEmailList(emails: string[] | undefined | null): string[] {
  if (!emails?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of emails) {
    const e = (raw ?? '').trim().toLowerCase();
    if (!e || seen.has(e)) continue;
    seen.add(e);
    out.push(e);
  }
  return out;
}

export function formatLctDob(date: Date | null | undefined): string {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export function formatLctGender(gender: string | null | undefined): string {
  if (!gender) return '';
  if (gender === 'MALE') return 'Male';
  if (gender === 'FEMALE') return 'Female';
  return '';
}

/**
 * Locked subject format. Datetime uses Africa/Nairobi wall clock for operator readability.
 * Comment: intentionally Africa/Nairobi (EAT), not UTC.
 */
export function buildLctExportSubject(at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(at);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';

  const day = get('day');
  const month = get('month');
  const year = get('year');
  const hour = get('hour');
  const minute = get('minute');
  const dayPeriod = get('dayPeriod').toLowerCase().replace(/\s/g, '');

  return `Maisha Poa Customer Export - ${day} ${month} ${year} ${hour}:${minute}${dayPeriod}`;
}
