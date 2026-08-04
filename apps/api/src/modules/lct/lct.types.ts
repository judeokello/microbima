import { LctPendingAction, PolicyStatus } from '@prisma/client';
import { normalizePhoneNumber } from '../../utils/phone-number.util';

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
  /** Scheme display name for LCT CSV + admin UI */
  schemeName: string;
  /** Policy coverage dates — CSV only (DD-MM-YYYY) */
  policyStartDate: string;
  policyEndDate: string;
  /** Package name only — CSV PRODUCT column */
  productName: string;
  /** Package plan name (title case) — CSV PLAN column */
  planName: string;
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

/** Title-case words for LCT PLAN column (e.g. gold → Gold). */
export function toTitleCase(value: string | null | undefined): string {
  if (!value?.trim()) return '';
  return value
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Normalize phone for LCT CSV: 254XXXXXXXXX without "+".
 * Invalid / blank → '' so callers can apply spouse/child fallback.
 */
export function formatLctPhone(raw: string | null | undefined): string {
  if (!raw?.trim()) return '';
  try {
    return normalizePhoneNumber(raw.trim());
  } catch {
    return '';
  }
}

const RELATIONSHIP_SORT_ORDER: Record<string, number> = {
  PRINCIPAL: 0,
  SPOUSE: 1,
  CHILD: 2,
};

function relationshipSortRank(relationship: string): number {
  return RELATIONSHIP_SORT_ORDER[relationship] ?? 99;
}

/**
 * Sort export rows: families by principal memberNumber, within family
 * Principal → Spouse → Children → other, then memberNumber ascending.
 */
export function sortLctExportIntents<T extends { intent: LctMemberSyncIntent }>(
  items: T[]
): T[] {
  const byPolicy = new Map<string, T[]>();
  for (const item of items) {
    const key = item.intent.policyId;
    const list = byPolicy.get(key);
    if (list) list.push(item);
    else byPolicy.set(key, [item]);
  }

  const familyKeys = Array.from(byPolicy.keys()).sort((a, b) => {
    const aPrincipal =
      byPolicy.get(a)?.find((x) => x.intent.relationship === 'PRINCIPAL')?.intent
        .memberNumber ??
      byPolicy.get(a)?.[0]?.intent.memberNumber ??
      '';
    const bPrincipal =
      byPolicy.get(b)?.find((x) => x.intent.relationship === 'PRINCIPAL')?.intent
        .memberNumber ??
      byPolicy.get(b)?.[0]?.intent.memberNumber ??
      '';
    return aPrincipal.localeCompare(bPrincipal);
  });

  const sorted: T[] = [];
  for (const key of familyKeys) {
    const family = byPolicy.get(key)!;
    family.sort((a, b) => {
      const rel = relationshipSortRank(a.intent.relationship) - relationshipSortRank(b.intent.relationship);
      if (rel !== 0) return rel;
      return a.intent.memberNumber.localeCompare(b.intent.memberNumber);
    });
    sorted.push(...family);
  }
  return sorted;
}

/** Sort pending UI dependants: Spouse → Children → other, then memberNumber. */
export function sortLctPendingDependants<
  T extends { relationship: string; memberNumber: string },
>(dependants: T[]): T[] {
  return [...dependants].sort((a, b) => {
    const rel = relationshipSortRank(a.relationship) - relationshipSortRank(b.relationship);
    if (rel !== 0) return rel;
    return a.memberNumber.localeCompare(b.memberNumber);
  });
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
