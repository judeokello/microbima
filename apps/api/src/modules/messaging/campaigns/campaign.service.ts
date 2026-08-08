import { createHash } from 'crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as Sentry from '@sentry/nestjs';
import { PrismaService } from '../../../prisma/prisma.service';
import { ValidationException } from '../../../exceptions/validation.exception';
import { ErrorCodes } from '../../../enums/error-codes.enum';
import { SystemSettingsService } from '../settings/system-settings.service';
import { CampaignAudienceService } from './campaign-audience.service';
import { CampaignPreflightService, PreflightResult } from './campaign-preflight.service';
import { CampaignCsvRow, serializeCampaignCsv } from './campaign-csv';
import {
  AudienceModeDto,
  CampaignComposeRequestDto,
} from '../../../dto/messaging/campaign.dto';
import {
  AudienceMode,
  CampaignChannel,
  isCancellableCampaignStatus,
  LARGE_AUDIENCE_WARN_THRESHOLD,
  MessagingCampaignStatus,
  templateKeyForChannel,
} from './campaign.types';

const COLOR_TOKENS = ['ph-0', 'ph-1', 'ph-2', 'ph-3', 'ph-4', 'ph-5', 'ph-6', 'ph-7'];

@Injectable()
export class CampaignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemSettings: SystemSettingsService,
    private readonly audienceService: CampaignAudienceService,
    private readonly preflightService: CampaignPreflightService,
  ) {}

  async preview(dto: CampaignComposeRequestDto, _actorUserId: string) {
    this.validateComposeBasics(dto);
    const settings = await this.systemSettings.getSnapshot();
    const result = await this.runPreflight(dto, settings);

    return {
      sendableCount: result.sendableCount,
      largeAudienceWarning: result.largeAudienceWarning,
      requiresNameConfirmation: result.sendableCount >= settings.campaignConfirmThreshold,
      perSchemeCounts: await this.computePerSchemeCounts(dto, result),
      sample: result.sample
        ? {
            customerId: result.sample.customerId,
            address: result.sample.normalizedAddress ?? '',
            renderedSubject: result.sample.renderedSubject,
            renderedBody: result.sample.renderedBody,
            placeholderHighlights: Object.entries(result.sample.placeholderValues)
              .filter(([key]) => (dto.body ?? '').includes(`{${key}}`) || (dto.subject ?? '').includes(`{${key}}`))
              .map(([key, value], i) => ({
                key,
                value,
                colorToken: COLOR_TOKENS[i % COLOR_TOKENS.length],
              })),
          }
        : null,
      blockingErrors: result.blockingErrors,
      softSkips: result.softSkips,
      characterCount: result.characterCount,
      smsSegmentCount: result.smsSegmentCount,
    };
  }

  async create(
    dto: CampaignComposeRequestDto,
    actorUserId: string,
    options?: { idempotencyKey?: string; correlationId?: string },
  ) {
    this.validateComposeBasics(dto);
    const settings = await this.systemSettings.getSnapshot();

    if (options?.idempotencyKey) {
      const existing = await this.prisma.messagingCampaign.findUnique({
        where: { idempotencyKey: options.idempotencyKey },
      });
      if (existing) return this.toDetail(existing);
    }

    const result = await this.runPreflight(dto, settings);
    const contentHash = this.audienceService.contentHash(result.subjectForPersist, result.bodyForPersist);
    const audienceHash = this.hashAudience(dto);

    await this.assertIdempotencyWindow(dto.name, contentHash, audienceHash, settings.campaignIdempotencyWindowMinutes);

    if (result.sendableCount >= settings.campaignConfirmThreshold) {
      if (!dto.confirmationName || dto.confirmationName !== dto.name) {
        throw ValidationException.forField(
          'confirmationName',
          'Must type the exact campaign name to confirm',
          ErrorCodes.VALIDATION_ERROR,
        );
      }
    }

    const hasBlocking = result.blockingErrors.length > 0;
    if (hasBlocking) {
      const failedName = await this.nextFailedName(dto.name);
      const campaign = await this.prisma.messagingCampaign.create({
        data: {
          name: failedName,
          requestedName: dto.name,
          channel: dto.channel,
          templateKey: templateKeyForChannel(dto.channel),
          status: 'FAILED_PREFLIGHT',
          bodyWithPlaceholders: result.bodyForPersist,
          subjectWithPlaceholders: result.subjectForPersist,
          audienceSnapshot: this.buildAudienceSnapshot(dto, result) as Prisma.InputJsonValue,
          contentHash,
          audienceHash,
          targetedCount: 0,
          idempotencyKey: options?.idempotencyKey ?? null,
          createdBy: actorUserId,
          correlationId: options?.correlationId ?? null,
          preflightErrors: result.blockingErrors as unknown as Prisma.InputJsonValue,
          preflightSkips: result.softSkips as unknown as Prisma.InputJsonValue,
          auditEvents: {
            create: {
              eventType: 'FAILED_PREFLIGHT',
              actorUserId,
              payload: {
                requestedName: dto.name,
                name: failedName,
                blockingCount: result.blockingErrors.length,
              } as Prisma.InputJsonValue,
            },
          },
        },
      });

      Sentry.captureMessage('Campaign failed preflight', {
        level: 'error',
        tags: {
          service: 'CampaignService',
          operation: 'create',
          reason: 'failed_preflight',
          channel: dto.channel,
        },
        extra: {
          campaignId: campaign.id,
          requestedName: dto.name,
          failedName,
          blockingCount: result.blockingErrors.length,
          blockingErrorsSample: result.blockingErrors.slice(0, 20),
          correlationId: options?.correlationId,
          actorUserId,
        },
      });

      return {
        ...this.toDetail(campaign),
        blockingErrors: result.blockingErrors,
        softSkips: result.softSkips,
        _failedPreflight: true as const,
      };
    }

    const delaySeconds =
      dto.channel === 'SMS' ? settings.campaignSmsDelaySeconds : settings.campaignEmailDelaySeconds;
    const dispatchStartsAt = new Date(Date.now() + delaySeconds * 1000);

    const campaign = await this.prisma.messagingCampaign.create({
      data: {
        name: dto.name,
        requestedName: dto.name,
        channel: dto.channel,
        templateKey: templateKeyForChannel(dto.channel),
        status: 'DELAYED',
        bodyWithPlaceholders: result.bodyForPersist,
        subjectWithPlaceholders: result.subjectForPersist,
        audienceSnapshot: this.buildAudienceSnapshot(dto, result) as Prisma.InputJsonValue,
        contentHash,
        audienceHash,
        targetedCount: result.sendableCount,
        idempotencyKey: options?.idempotencyKey ?? null,
        dispatchStartsAt,
        createdBy: actorUserId,
        correlationId: options?.correlationId ?? null,
        preflightErrors: result.blockingErrors as unknown as Prisma.InputJsonValue,
        preflightSkips: result.softSkips as unknown as Prisma.InputJsonValue,
        auditEvents: {
          create: {
            eventType: 'DELAY_STARTED',
            actorUserId,
            payload: {
              dispatchStartsAt: dispatchStartsAt.toISOString(),
              targetedCount: result.sendableCount,
            } as Prisma.InputJsonValue,
          },
        },
      },
    });

    return this.toDetail(campaign);
  }

  async getById(campaignId: string) {
    const campaign = await this.prisma.messagingCampaign.findUnique({
      where: { id: campaignId },
      include: { auditEvents: { orderBy: { createdAt: 'asc' } } },
    });
    if (!campaign) {
      throw new NotFoundException({
        error: { code: ErrorCodes.NOT_FOUND, message: 'Campaign not found' },
      });
    }
    const progress = await this.progressFor(campaign.id, campaign.targetedCount);
    return {
      ...this.toDetail(campaign),
      progress,
      auditEvents: campaign.auditEvents,
      blockingErrors: (campaign.preflightErrors as unknown[]) ?? [],
      softSkips: (campaign.preflightSkips as unknown[]) ?? [],
    };
  }

  async list(params: {
    channel?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const where: Prisma.MessagingCampaignWhereInput = {};
    if (params.channel === 'SMS' || params.channel === 'EMAIL') {
      where.channel = params.channel;
    }
    if (params.status) {
      where.status = params.status as MessagingCampaignStatus;
    }

    const [total, rows] = await Promise.all([
      this.prisma.messagingCampaign.count({ where }),
      this.prisma.messagingCampaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const data = await Promise.all(
      rows.map(async (row) => {
        const progress = await this.progressFor(row.id, row.targetedCount);
        return { ...this.toDetail(row), progress };
      }),
    );

    return { data, page, pageSize, total };
  }

  async getCsv(campaignId: string, kind: 'errors' | 'skips'): Promise<string> {
    const campaign = await this.prisma.messagingCampaign.findUnique({
      where: { id: campaignId },
      select: { preflightErrors: true, preflightSkips: true },
    });
    if (!campaign) {
      throw new NotFoundException({
        error: { code: ErrorCodes.NOT_FOUND, message: 'Campaign not found' },
      });
    }
    const raw = kind === 'errors' ? campaign.preflightErrors : campaign.preflightSkips;
    const rows = (Array.isArray(raw) ? raw : []) as unknown as CampaignCsvRow[];
    return serializeCampaignCsv(rows);
  }

  async cancel(campaignId: string, actorUserId: string) {
    const campaign = await this.prisma.messagingCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign) {
      throw new NotFoundException({
        error: { code: ErrorCodes.NOT_FOUND, message: 'Campaign not found' },
      });
    }
    if (!isCancellableCampaignStatus(campaign.status as MessagingCampaignStatus)) {
      throw new ConflictException({
        error: {
          code: ErrorCodes.RESOURCE_CONFLICT,
          status: 409,
          message: `Campaign cannot be cancelled in status ${campaign.status}`,
        },
      });
    }

    const now = new Date();
    await this.prisma.messagingDelivery.updateMany({
      where: {
        campaignId,
        status: { in: ['PENDING', 'RETRY_WAIT'] },
      },
      data: { status: 'CANCELLED' },
    });

    const updated = await this.prisma.messagingCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'CANCELLED',
        cancelledAt: now,
        cancelledBy: actorUserId,
        completedAt: now,
      },
    });

    await this.prisma.messagingCampaignAuditEvent.create({
      data: {
        campaignId,
        eventType: 'CANCELLED',
        actorUserId,
        payload: { previousStatus: campaign.status } as Prisma.InputJsonValue,
      },
    });

    const progress = await this.progressFor(updated.id, updated.targetedCount);
    return { ...this.toDetail(updated), progress };
  }

  /** Campaigns are immutable after Send — no content update API. */
  assertImmutable(_campaignId: string): void {
    throw ValidationException.forField(
      'campaign',
      'Campaign content cannot be updated after Send; cancel and recreate',
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  private validateComposeBasics(dto: CampaignComposeRequestDto) {
    const errors: Record<string, string> = {};
    if (!dto.name?.trim()) errors['name'] = 'Name is required';
    if (!dto.channel) errors['channel'] = 'Channel is required';
    if (!dto.audience?.modes?.length) errors['audience.modes'] = 'At least one audience mode is required';

    const modes = new Set(dto.audience?.modes ?? []);
    if (dto.channel === 'SMS' && this.preflightService.isEmptyBody('SMS', dto.body)) {
      errors['body'] = 'SMS body is required';
    }
    if (dto.channel === 'EMAIL') {
      if (!dto.subject?.trim()) errors['subject'] = 'Email subject is required';
      if (this.preflightService.isEmptyBody('EMAIL', dto.body)) {
        errors['body'] = 'Email body is required';
      }
    }

    if (modes.has(AudienceModeDto.SCHEME_CUSTOMERS)) {
      if (!dto.audience.schemeIds?.length) errors['audience.schemeIds'] = 'Scheme is required';
      if (!dto.audience.packageIds?.length) errors['audience.packageIds'] = 'At least one package is required';
      if (!dto.audience.customerStatuses?.length) {
        errors['audience.customerStatuses'] = 'At least one customer status is required';
      }
      if (!dto.audience.policyStatuses?.length) {
        errors['audience.policyStatuses'] = 'At least one policy status is required';
      }
    }

    if (modes.has(AudienceModeDto.SCHEME_CONTACTS) && !dto.audience.schemeIds?.length) {
      errors['audience.schemeIds'] = 'Scheme is required for contacts';
    }

    // Channel-pure: EMAIL paste list must be emails, not phone numbers
    if (dto.channel === 'EMAIL' && modes.has(AudienceModeDto.PASTE_LIST)) {
      const paste = dto.audience.pasteList ?? [];
      const phoneOnlyLines = paste.filter((line) => {
        const asPhone = this.audienceService.normalizePhone(line);
        const asEmail = this.audienceService.normalizeEmail(line);
        return asPhone != null && asEmail == null;
      });
      if (phoneOnlyLines.length > 0) {
        errors['audience.pasteList'] =
          'Email campaigns require email addresses; phone numbers are not allowed';
      }
    }

    if (Object.keys(errors).length > 0) {
      throw ValidationException.withMultipleErrors(errors);
    }
  }

  private async runPreflight(
    dto: CampaignComposeRequestDto,
    settings: Awaited<ReturnType<SystemSettingsService['getSnapshot']>>,
  ): Promise<PreflightResult> {
    return this.preflightService.run({
      channel: dto.channel as CampaignChannel,
      modes: (dto.audience.modes ?? []) as AudienceMode[],
      schemeIds: dto.audience.schemeIds ?? [],
      packageIds: dto.audience.packageIds ?? [],
      customerStatuses: dto.audience.customerStatuses ?? [],
      policyStatuses: dto.audience.policyStatuses ?? [],
      pasteList: dto.audience.pasteList,
      body: dto.body ?? '',
      subject: dto.subject,
      supportNumbers: {
        general_support_number: settings.general_support_number,
        medical_support_number: settings.medical_support_number,
      },
    });
  }

  private hashAudience(dto: CampaignComposeRequestDto): string {
    const payload = JSON.stringify({
      modes: dto.audience.modes,
      schemeIds: [...(dto.audience.schemeIds ?? [])].sort(),
      packageIds: [...(dto.audience.packageIds ?? [])].sort(),
      customerStatuses: [...(dto.audience.customerStatuses ?? [])].sort(),
      policyStatuses: [...(dto.audience.policyStatuses ?? [])].sort(),
      pasteList: [...(dto.audience.pasteList ?? [])].map((x) => x.trim().toLowerCase()).sort(),
    });
    return createHash('sha256').update(payload).digest('hex');
  }

  private async assertIdempotencyWindow(
    name: string,
    contentHash: string,
    audienceHash: string,
    windowMinutes: number,
  ) {
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);
    const dup = await this.prisma.messagingCampaign.findFirst({
      where: {
        requestedName: { equals: name, mode: 'insensitive' },
        contentHash,
        audienceHash,
        createdAt: { gte: since },
        status: { not: 'FAILED_PREFLIGHT' },
      },
    });
    if (dup) {
      throw new ConflictException({
        error: {
          code: ErrorCodes.RESOURCE_CONFLICT,
          status: 409,
          message: 'Duplicate campaign Send within idempotency window',
          details: { campaignId: dup.id },
        },
      });
    }
  }

  private async nextFailedName(requestedName: string): Promise<string> {
    let n = 1;
    for (;;) {
      const candidate = `${requestedName}_failed${n}`;
      const exists = await this.prisma.messagingCampaign.findFirst({
        where: { name: { equals: candidate, mode: 'insensitive' } },
      });
      if (!exists) return candidate;
      n += 1;
    }
  }

  private buildAudienceSnapshot(dto: CampaignComposeRequestDto, result: PreflightResult) {
    return {
      modes: dto.audience.modes,
      schemeIds: dto.audience.schemeIds ?? [],
      packageIds: dto.audience.packageIds ?? [],
      customerStatuses: dto.audience.customerStatuses ?? [],
      policyStatuses: dto.audience.policyStatuses ?? [],
      pasteList: dto.audience.pasteList ?? [],
      sendableCount: result.sendableCount,
      largeAudienceWarnThreshold: LARGE_AUDIENCE_WARN_THRESHOLD,
    };
  }

  private async computePerSchemeCounts(dto: CampaignComposeRequestDto, result: PreflightResult) {
    const schemeIds = dto.audience.schemeIds ?? [];
    if (schemeIds.length === 0) return [];
    const schemes = await this.prisma.scheme.findMany({
      where: { id: { in: schemeIds } },
      select: { id: true, schemeName: true },
    });
    return this.preflightService.computePerSchemeCounts(schemes, result.sendable);
  }

  private async progressFor(campaignId: string, targetedCount: number) {
    const [handedOffCount, receiptConfirmedCount] = await Promise.all([
      this.prisma.messagingDelivery.count({
        where: { campaignId, handedOffAt: { not: null } },
      }),
      this.prisma.messagingDelivery.count({
        where: { campaignId, receiptConfirmedAt: { not: null } },
      }),
    ]);
    return { targetedCount, handedOffCount, receiptConfirmedCount };
  }

  private toDetail(campaign: {
    id: string;
    name: string;
    requestedName: string;
    channel: string;
    templateKey: string;
    status: string;
    subjectWithPlaceholders: string | null;
    bodyWithPlaceholders: string;
    audienceSnapshot: unknown;
    targetedCount: number;
    dispatchStartsAt: Date | null;
    dispatchStartedAt: Date | null;
    completedAt: Date | null;
    cancelledAt: Date | null;
    cancelledBy: string | null;
    createdBy: string;
    createdAt: Date;
  }) {
    return {
      id: campaign.id,
      name: campaign.name,
      requestedName: campaign.requestedName,
      channel: campaign.channel,
      templateKey: campaign.templateKey,
      status: campaign.status,
      subjectWithPlaceholders: campaign.subjectWithPlaceholders,
      bodyWithPlaceholders: campaign.bodyWithPlaceholders,
      audienceSnapshot: campaign.audienceSnapshot as Record<string, unknown>,
      progress: {
        targetedCount: campaign.targetedCount,
        handedOffCount: 0,
        receiptConfirmedCount: 0,
      },
      dispatchStartsAt: campaign.dispatchStartsAt,
      dispatchStartedAt: campaign.dispatchStartedAt,
      completedAt: campaign.completedAt,
      cancelledAt: campaign.cancelledAt,
      cancelledBy: campaign.cancelledBy,
      createdBy: campaign.createdBy,
      createdAt: campaign.createdAt,
    };
  }
}
