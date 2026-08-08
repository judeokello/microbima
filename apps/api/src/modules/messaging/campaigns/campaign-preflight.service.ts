import { Injectable } from '@nestjs/common';
import { CampaignAudienceService } from './campaign-audience.service';
import { sanitizeCampaignHtml, stripHtmlToPlainText } from './campaign-html.sanitizer';
import {
  CampaignAudienceInput,
  CampaignCandidate,
  CampaignChannel,
  LARGE_AUDIENCE_WARN_THRESHOLD,
  PerSchemeCount,
} from './campaign.types';

export interface PreflightRow {
  customerName?: string | null;
  phone?: string | null;
  email?: string | null;
  customerId?: string | null;
  error: string;
}

export interface PreflightResult {
  sendable: CampaignCandidate[];
  blockingErrors: PreflightRow[];
  softSkips: PreflightRow[];
  sample: CampaignCandidate | null;
  sendableCount: number;
  largeAudienceWarning: boolean;
  characterCount: number;
  smsSegmentCount: number | null;
  bodyForPersist: string;
  subjectForPersist: string | null;
  /** Populated by callers that know scheme names; counts computed via computePerSchemeCounts. */
  perSchemeCounts?: PerSchemeCount[];
}

@Injectable()
export class CampaignPreflightService {
  constructor(private readonly audienceService: CampaignAudienceService) {}

  isEmptyBody(channel: CampaignChannel, body: string | null | undefined): boolean {
    if (body == null) return true;
    if (channel === 'EMAIL') {
      return stripHtmlToPlainText(body).length === 0;
    }
    return body.trim().length === 0;
  }

  /**
   * Per-scheme pills after dedupe: count sendable attributed via contributingSchemeIds.
   * Paste-only recipients (no scheme) do not inflate scheme counts (FR-029).
   */
  computePerSchemeCounts(
    schemeMeta: Array<{ id: number; schemeName: string }>,
    sendable: CampaignCandidate[],
  ): PerSchemeCount[] {
    return schemeMeta.map((s) => ({
      schemeId: s.id,
      schemeName: s.schemeName,
      recipientCount: sendable.filter((c) =>
        (c.contributingSchemeIds ?? (c.schemeId != null ? [c.schemeId] : [])).includes(s.id),
      ).length,
    }));
  }

  selectSample(sendable: CampaignCandidate[]): CampaignCandidate | null {
    if (sendable.length === 0) return null;
    const sorted = [...sendable].sort((a, b) => {
      const cmpNullable = (x: string | null, y: string | null) => {
        if (x == null && y == null) return 0;
        if (x == null) return 1; // nulls last
        if (y == null) return -1;
        return x.localeCompare(y);
      };
      return (
        cmpNullable(a.customerId, b.customerId) ||
        cmpNullable(a.policyId, b.policyId) ||
        cmpNullable(a.normalizedAddress, b.normalizedAddress)
      );
    });
    return sorted[0] ?? null;
  }

  async run(input: CampaignAudienceInput): Promise<PreflightResult> {
    const bodyForPersist =
      input.channel === 'EMAIL' ? sanitizeCampaignHtml(input.body ?? '') : (input.body ?? '');
    const subjectForPersist =
      input.channel === 'EMAIL' ? (input.subject ?? null) : null;

    const expandInput: CampaignAudienceInput = {
      ...input,
      body: bodyForPersist,
      subject: subjectForPersist,
    };

    const { candidates, softSkipsFromExpand } = await this.audienceService.expand(expandInput);

    const blockingErrors: PreflightRow[] = [];
    const softSkips: PreflightRow[] = [...softSkipsFromExpand];

    for (const c of candidates) {
      if (c.blockingError) {
        blockingErrors.push(this.toRow(c, c.blockingError));
      } else if (c.softSkip) {
        softSkips.push(this.toRow(c, c.softSkip));
      }
    }

    const sendable = this.audienceService.dedupeByAddressAndContent(
      candidates.filter((c) => !c.blockingError && !c.softSkip && c.normalizedAddress),
    );

    if (sendable.length === 0 && blockingErrors.length === 0) {
      blockingErrors.push({
        customerName: null,
        phone: null,
        email: null,
        customerId: null,
        error: 'Zero sendable recipients after expand, skip, and dedupe',
      });
    }

    const sample = this.selectSample(sendable);
    const characterCount = bodyForPersist.length;
    const smsSegmentCount =
      input.channel === 'SMS' ? Math.max(1, Math.ceil(characterCount / 160)) : null;

    return {
      sendable,
      blockingErrors,
      softSkips,
      sample,
      sendableCount: sendable.length,
      largeAudienceWarning: sendable.length >= LARGE_AUDIENCE_WARN_THRESHOLD,
      characterCount,
      smsSegmentCount,
      bodyForPersist,
      subjectForPersist,
    };
  }

  private toRow(c: CampaignCandidate, error: string): PreflightRow {
    return {
      customerName: c.customerName,
      phone: c.channel === 'SMS' ? c.normalizedAddress : null,
      email: c.channel === 'EMAIL' ? c.normalizedAddress : null,
      customerId: c.customerId,
      error,
    };
  }
}
