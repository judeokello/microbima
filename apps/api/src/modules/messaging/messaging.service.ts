import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SystemSettingsService } from './settings/system-settings.service';
import { EnqueueMessageRequest } from './messaging.types';
import { ValidationException } from '../../exceptions/validation.exception';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemSettings: SystemSettingsService,
  ) {}

  /**
   * Enqueue one or more deliveries based on routing (SMS, Email, or both).
   *
   * T017: Full enqueue implementation with routing + recipient validation.
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

    // 2. Fetch customer for recipient details + language
    const customer = await this.prisma.customer.findUnique({
      where: { id: req.customerId },
      select: { id: true, phoneNumber: true, email: true, defaultMessagingLanguage: true },
    });

    if (!customer) {
      throw ValidationException.forField('customerId', `Customer not found: ${req.customerId}`);
    }

    // 3. Get settings snapshot
    const settings = await this.systemSettings.getSnapshot();

    // 4. Determine final requested language (explicit or customer default or system default)
    const requestedLanguage = req.requestedLanguage ?? customer.defaultMessagingLanguage ?? settings.defaultMessagingLanguage;

    // 5. Create delivery records for each enabled channel
    const createdDeliveryIds: string[] = [];
    const now = new Date();

    if (route.smsEnabled) {
      const smsDelivery = await this.createDelivery({
        channel: 'SMS',
        customerId: customer.id,
        policyId: req.policyId,
        templateKey: req.templateKey,
        requestedLanguage,
        correlationId,
        recipient: customer.phoneNumber,
        missingRecipientReason: customer.phoneNumber ? null : 'Phone number not set for customer',
        maxAttempts: settings.smsMaxAttempts,
        createdAt: now,
      });
      createdDeliveryIds.push(smsDelivery.id);
    }

    if (route.emailEnabled) {
      const emailDelivery = await this.createDelivery({
        channel: 'EMAIL',
        customerId: customer.id,
        policyId: req.policyId,
        templateKey: req.templateKey,
        requestedLanguage,
        correlationId,
        recipient: customer.email,
        missingRecipientReason: customer.email ? null : 'Email not set for customer',
        maxAttempts: settings.emailMaxAttempts,
        createdAt: now,
        dynamicAttachmentSpecs: req.dynamicAttachmentSpecs ?? undefined,
      });
      createdDeliveryIds.push(emailDelivery.id);
    }

    this.logger.log(`Enqueued ${createdDeliveryIds.length} deliveries for templateKey=${req.templateKey}, correlationId=${correlationId}`);

    return { createdDeliveryIds, correlationId };
  }

  /**
   * Create a delivery record (PENDING if recipient exists, FAILED if missing).
   * T019: Missing recipient details create-and-fail delivery records.
   */
  private async createDelivery(params: {
    channel: 'SMS' | 'EMAIL';
    customerId: string;
    policyId?: string | null;
    templateKey: string;
    requestedLanguage: string;
    correlationId: string;
    recipient: string | null;
    missingRecipientReason: string | null;
    maxAttempts: number;
    createdAt: Date;
    dynamicAttachmentSpecs?: Array<{ attachmentTemplateId: string; params: Record<string, string> }>;
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

