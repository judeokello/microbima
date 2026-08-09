export type CampaignChannel = 'SMS' | 'EMAIL';

export type AudienceMode = 'SCHEME_CUSTOMERS' | 'SCHEME_CONTACTS' | 'PASTE_LIST';

export const ADMIN_TEMPLATE_SMS = 'admin_template_sms';
export const ADMIN_TEMPLATE_EMAIL = 'admin_template_email';

export const LARGE_AUDIENCE_WARN_THRESHOLD = 5000;

export type MessagingCampaignStatus =
  | 'DELAYED'
  | 'DISPATCHING'
  | 'COMPLETED'
  | 'COMPLETED_WITH_FAILURES'
  | 'CANCELLED'
  | 'FAILED_PREFLIGHT';

export interface CampaignSupportNumbers {
  general_support_number: string;
  medical_support_number: string;
}

export interface CampaignAudienceInput {
  channel: CampaignChannel;
  modes: AudienceMode[];
  schemeIds: number[];
  packageIds: number[];
  customerStatuses: string[];
  policyStatuses: string[];
  pasteList?: string[];
  body: string;
  subject?: string | null;
  supportNumbers: CampaignSupportNumbers;
}

export interface CampaignCandidate {
  channel: CampaignChannel;
  normalizedAddress: string | null;
  customerId: string | null;
  policyId: string | null;
  /** Primary scheme attribution (first selected scheme when multi-scheme). */
  schemeId: number | null;
  /**
   * All schemes this candidate contributes to for per-scheme pills (FR-029).
   * Merged across modes/schemes when address+content dedupe keeps one send.
   */
  contributingSchemeIds: number[];
  /** Package attribution for per-package compose pills. */
  packageId: number | null;
  contributingPackageIds: number[];
  customerName: string | null;
  renderedSubject: string | null;
  renderedBody: string;
  contentHash: string;
  placeholderValues: Record<string, string>;
  softSkip: string | null;
  blockingError: string | null;
}

export interface PerSchemeCount {
  schemeId: number;
  schemeName: string;
  recipientCount: number;
}

export interface PerPackageCount {
  packageId: number;
  packageName: string;
  recipientCount: number;
}

export interface CampaignAudienceExpandResult {
  candidates: CampaignCandidate[];
  softSkipsFromExpand: Array<{
    customerName?: string | null;
    phone?: string | null;
    email?: string | null;
    customerId?: string | null;
    error: string;
  }>;
}

export function templateKeyForChannel(channel: CampaignChannel): string {
  return channel === 'SMS' ? ADMIN_TEMPLATE_SMS : ADMIN_TEMPLATE_EMAIL;
}

export function isTerminalCampaignStatus(status: MessagingCampaignStatus): boolean {
  return (
    status === 'COMPLETED' ||
    status === 'COMPLETED_WITH_FAILURES' ||
    status === 'CANCELLED' ||
    status === 'FAILED_PREFLIGHT'
  );
}

export function isCancellableCampaignStatus(status: MessagingCampaignStatus): boolean {
  return status === 'DELAYED' || status === 'DISPATCHING';
}
