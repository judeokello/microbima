import { Injectable, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseService } from '../../services/supabase.service';
import { SystemSettingsService } from './settings/system-settings.service';
import { EnqueueMessageRequest } from './messaging.types';
import { getNonProdMessagingTag } from './non-prod-messaging.util';
import { ValidationException } from '../../exceptions/validation.exception';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemSettings: SystemSettingsService,
    private readonly supabaseService: SupabaseService,
  ) {}

  /**
   * Enqueue one or more deliveries based on routing (SMS, Email, or both).
   *
   * In development/staging, customer-linked messages are redirected to the
   * registering user's phone/email. Missing createdBy or phone skips enqueue + Sentry.
   */
  async enqueue(req: EnqueueMessageRequest) {
    const correlationId = req.correlationId ?? uuidv4();

    // 1. Fetch route to determine enabled channels
    const route = await this.prisma.messagingRoute.findUnique({
      where: { templateKey: req.templateKey },
    });

    if (!route) {
      throw ValidationException.forField('templateKey', `No route found for template key: ${req.templateKey}`);
    }

    const isPhoneOnly = !req.customerId && !!req.overrideRecipientPhone?.trim();
    if (!req.customerId && !isPhoneOnly) {
      throw ValidationException.forField(
        'customerId',
        'customerId is required unless overrideRecipientPhone is provided for phone-only delivery',
      );
    }

    // 2. Fetch customer when linked to a customer record
    const customer = req.customerId
      ? await this.prisma.customer.findUnique({
          where: { id: req.customerId },
          select: {
            id: true,
            phoneNumber: true,
            email: true,
            defaultMessagingLanguage: true,
            createdBy: true,
          },
        })
      : null;

    if (req.customerId && !customer) {
      throw ValidationException.forField('customerId', `Customer not found: ${req.customerId}`);
    }

    // 3. Get settings snapshot
    const settings = await this.systemSettings.getSnapshot();

    // 4. Determine final requested language
    const requestedLanguage =
      req.requestedLanguage ??
      customer?.defaultMessagingLanguage ??
      settings.defaultMessagingLanguage;

    // 5. Resolve recipients (non-prod redirect for customer-linked messages)
    const overridePhoneRaw = req.overrideRecipientPhone?.trim();
    const overridePhone =
      overridePhoneRaw !== undefined && overridePhoneRaw.length > 0 ? overridePhoneRaw : null;
    let smsRecipient = overridePhone ?? customer?.phoneNumber ?? null;
    let emailRecipient = customer?.email ?? null;
    let skipEmailForMissingCreatorEmail = false;

    const nonProdTag = getNonProdMessagingTag(process.env.NODE_ENV);
    if (nonProdTag && customer) {
      const redirect = await this.resolveNonProdCreatorRecipients({
        customerId: customer.id,
        createdBy: customer.createdBy,
        templateKey: req.templateKey,
        correlationId,
      });
      if (!redirect.ok) {
        return { createdDeliveryIds: [] as string[], correlationId };
      }
      smsRecipient = redirect.phone;
      emailRecipient = redirect.email;
      skipEmailForMissingCreatorEmail = !redirect.email;
    }

    // 6. Create delivery records for each enabled channel
    const createdDeliveryIds: string[] = [];
    const now = new Date();

    const enqueuePlaceholderContext = this.serializePlaceholderContext(req.placeholderValues);

    if (route.smsEnabled) {
      const smsDelivery = await this.createDelivery({
        channel: 'SMS',
        customerId: customer?.id ?? null,
        policyId: req.policyId,
        templateKey: req.templateKey,
        requestedLanguage,
        correlationId,
        recipient: smsRecipient,
        missingRecipientReason: smsRecipient ? null : 'Phone number not set for customer',
        maxAttempts: settings.smsMaxAttempts,
        createdAt: now,
        enqueuePlaceholderContext,
      });
      createdDeliveryIds.push(smsDelivery.id);
    }

    if (route.emailEnabled) {
      if (isPhoneOnly) {
        this.logger.debug(
          `Skipping email for phone-only enqueue templateKey=${req.templateKey}, correlationId=${correlationId}`,
        );
      } else if (skipEmailForMissingCreatorEmail) {
        const message =
          `Non-prod messaging: creator has no email; skipping EMAIL for customerId=${customer!.id}, ` +
          `createdBy=${customer!.createdBy}, templateKey=${req.templateKey}`;
        this.logger.error(`[${correlationId}] ${message}`);
        Sentry.captureMessage(message, {
          level: 'error',
          tags: {
            service: 'MessagingService',
            operation: 'enqueue',
            reason: 'creator_email_missing',
            templateKey: req.templateKey,
          },
          extra: {
            customerId: customer!.id,
            createdBy: customer!.createdBy,
            correlationId,
          },
        });
      } else {
        const emailDelivery = await this.createDelivery({
          channel: 'EMAIL',
          customerId: customer!.id,
          policyId: req.policyId,
          templateKey: req.templateKey,
          requestedLanguage,
          correlationId,
          recipient: emailRecipient,
          missingRecipientReason: emailRecipient ? null : 'Email not set for customer',
          maxAttempts: settings.emailMaxAttempts,
          createdAt: now,
          dynamicAttachmentSpecs: req.dynamicAttachmentSpecs ?? undefined,
          enqueuePlaceholderContext,
        });
        createdDeliveryIds.push(emailDelivery.id);
      }
    }

    this.logger.log(`Enqueued ${createdDeliveryIds.length} deliveries for templateKey=${req.templateKey}, correlationId=${correlationId}`);

    return { createdDeliveryIds, correlationId };
  }

  /**
   * Resolve registering user contacts for non-prod redirect.
   * Fail loudly (skip + Sentry) when createdBy or phone is missing.
   */
  private async resolveNonProdCreatorRecipients(params: {
    customerId: string;
    createdBy: string | null;
    templateKey: string;
    correlationId: string;
  }): Promise<
    | { ok: true; phone: string; email: string | null }
    | { ok: false }
  > {
    const { customerId, createdBy, templateKey, correlationId } = params;

    if (!createdBy) {
      this.captureNonProdRedirectFailure({
        correlationId,
        customerId,
        createdBy: null,
        templateKey,
        reason: 'createdBy_missing',
        message: `Non-prod messaging: customer has no createdBy; skipping enqueue for templateKey=${templateKey}`,
      });
      return { ok: false };
    }

    const contacts = await this.supabaseService.getUserMessagingContacts(createdBy);
    if (!contacts) {
      this.captureNonProdRedirectFailure({
        correlationId,
        customerId,
        createdBy,
        templateKey,
        reason: 'creator_user_not_found',
        message: `Non-prod messaging: creator user not found; skipping enqueue for templateKey=${templateKey}`,
      });
      return { ok: false };
    }

    if (!contacts.phone) {
      this.captureNonProdRedirectFailure({
        correlationId,
        customerId,
        createdBy,
        templateKey,
        reason: 'creator_phone_missing',
        message: `Non-prod messaging: creator user_metadata.phone missing; skipping enqueue for templateKey=${templateKey}`,
      });
      return { ok: false };
    }

    return { ok: true, phone: contacts.phone, email: contacts.email };
  }

  private captureNonProdRedirectFailure(params: {
    correlationId: string;
    customerId: string;
    createdBy: string | null;
    templateKey: string;
    reason: string;
    message: string;
  }): void {
    this.logger.error(`[${params.correlationId}] ${params.message}`);
    Sentry.captureMessage(params.message, {
      level: 'error',
      tags: {
        service: 'MessagingService',
        operation: 'enqueue',
        reason: params.reason,
        templateKey: params.templateKey,
      },
      extra: {
        customerId: params.customerId,
        createdBy: params.createdBy,
        correlationId: params.correlationId,
      },
    });
  }

  private serializePlaceholderContext(
    values: Record<string, string | number | boolean | Date>,
  ): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(values)) {
      if (v instanceof Date) out[k] = v.toISOString();
      else out[k] = v === undefined || v === null ? '' : String(v);
    }
    return out;
  }

  /**
   * Create a delivery record (PENDING if recipient exists, FAILED if missing).
   * T019: Missing recipient details create-and-fail delivery records.
   */
  private async createDelivery(params: {
    channel: 'SMS' | 'EMAIL';
    customerId: string | null;
    policyId?: string | null;
    templateKey: string;
    requestedLanguage: string;
    correlationId: string;
    recipient: string | null;
    missingRecipientReason: string | null;
    maxAttempts: number;
    createdAt: Date;
    dynamicAttachmentSpecs?: Array<{ attachmentTemplateId: string; params: Record<string, string> }>;
    enqueuePlaceholderContext?: Record<string, string> | null;
  }) {
    if (!params.recipient) {
      // T019: Missing recipient → FAILED delivery with failureReason
      return this.prisma.messagingDelivery.create({
        data: {
          channel: params.channel,
          customerId: params.customerId,
          policyId: params.policyId,
          templateKey: params.templateKey,
          requestedLanguage: params.requestedLanguage,
          correlationId: params.correlationId,
          status: 'FAILED',
          attemptCount: 0,
          maxAttempts: params.maxAttempts,
          lastError: params.missingRecipientReason!,
          renderedBody: '', // Empty since it never got rendered
          createdAt: params.createdAt,
          enqueuePlaceholderContext: params.enqueuePlaceholderContext ?? undefined,
        },
      });
    }

    // Create PENDING delivery (will be picked up by worker)
    return this.prisma.messagingDelivery.create({
      data: {
        channel: params.channel,
        customerId: params.customerId,
        policyId: params.policyId,
        templateKey: params.templateKey,
        requestedLanguage: params.requestedLanguage,
        correlationId: params.correlationId,
        recipientPhone: params.channel === 'SMS' ? params.recipient : null,
        recipientEmail: params.channel === 'EMAIL' ? params.recipient : null,
        status: 'PENDING',
        attemptCount: 0,
        maxAttempts: params.maxAttempts,
        renderedBody: '', // Will be rendered by worker
        createdAt: params.createdAt,
        dynamicAttachmentSpecs: params.dynamicAttachmentSpecs ?? undefined,
        enqueuePlaceholderContext: params.enqueuePlaceholderContext ?? undefined,
      },
    });
  }

  /**
   * Resend a specific prior delivery (per selected channel).
   * T027-T029: Creates new linked delivery, reuses original rendered content.
   */
  async resendDelivery(deliveryId: string, correlationId: string) {
    this.logger.log(`[${correlationId}] Resending delivery ${deliveryId}`);

    // Fetch original delivery with rendered content
    const original = await this.prisma.messagingDelivery.findUnique({
      where: { id: deliveryId },
      include: { attachments: true },
    });

    if (!original) {
      throw ValidationException.forField('deliveryId', `Delivery not found: ${deliveryId}`);
    }

    // Get current settings for maxAttempts
    const settings = await this.systemSettings.getSnapshot();
    const maxAttempts = original.channel === 'SMS' ? settings.smsMaxAttempts : settings.emailMaxAttempts;

    // Create new delivery linked to original, reusing rendered content
    // T028: Reuse original rendered SMS text for SMS
    // T029: Reuse original rendered email content (subject/body/textBody) for email
    const newDelivery = await this.prisma.messagingDelivery.create({
      data: {
        templateKey: original.templateKey,
        channel: original.channel,
        customerId: original.customerId,
        policyId: original.policyId,
        recipientPhone: original.recipientPhone,
        recipientEmail: original.recipientEmail,
        requestedLanguage: original.requestedLanguage,
        usedLanguage: original.usedLanguage,
        renderedSubject: original.renderedSubject,
        renderedBody: original.renderedBody,
        renderedTextBody: original.renderedTextBody,
        status: 'PENDING',
        attemptCount: 0,
        maxAttempts,
        correlationId,
        originalDeliveryId: original.id,
        createdAt: new Date(),
      },
    });

    // Link attachments if any (reuse attachment references for resend)
    if (original.attachments.length > 0) {
      for (const att of original.attachments) {
        await this.prisma.messagingAttachment.create({
          data: {
            deliveryId: newDelivery.id,
            fileName: att.fileName,
            storageBucket: att.storageBucket,
            storagePath: att.storagePath,
            mimeType: att.mimeType,
            sizeBytes: att.sizeBytes,
            expiresAt: att.expiresAt,
            deletedAt: att.deletedAt,
          },
        });
      }
    }

    this.logger.log(
      `[${correlationId}] Created resend delivery ${newDelivery.id} for original ${original.id} (channel=${original.channel})`
    );

    return newDelivery.id;
  }

  /**
   * List deliveries for admin/support views.
   * T020: Implemented with filters and pagination.
   */
  async listDeliveries(filters: {
    customerId?: string;
    policyId?: string;
    channel?: 'SMS' | 'EMAIL';
    status?: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'RETRY_WAIT';
    skip: number;
    take: number;
  }) {
    const where: Record<string, unknown> = {};
    if (filters.customerId) where['customerId'] = filters.customerId;
    if (filters.policyId) where['policyId'] = filters.policyId;
    if (filters.channel) where['channel'] = filters.channel;
    if (filters.status) where['status'] = filters.status;

    return this.prisma.messagingDelivery.findMany({
      where,
      skip: filters.skip,
      take: filters.take,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true } },
        policy: { select: { id: true, policyNumber: true } },
      },
    });
  }
}
