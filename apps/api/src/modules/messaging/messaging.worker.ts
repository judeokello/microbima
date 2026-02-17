import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigurationService } from '../../config/configuration.service';
import { SystemSettingsService } from './settings/system-settings.service';
import { MessagingOutboxRepository } from './messaging-outbox.repository';
import { TemplateResolverService } from './rendering/template-resolver.service';
import { PlaceholderRendererService } from './rendering/placeholder-renderer.service';
import { AfricasTalkingSmsService } from './providers/sms-africas-talking.service';
import { SmtpEmailService } from './providers/email-smtp.service';
import { AttachmentGeneratorService } from './attachments/attachment-generator.service';
import { MessagingAttachmentService } from './attachments/attachment.service';
import { MessagingAttachmentTemplatesService } from './messaging-attachment-templates.service';
import * as Sentry from '@sentry/nestjs';
import { MessagingAttachmentTemplateType, Prisma } from '@prisma/client';

/** Claimed delivery shape (includes optional dynamicAttachmentSpecs). */
type ClaimedDelivery = Awaited<ReturnType<MessagingOutboxRepository['claimEligibleDeliveries']>>[number];

@Injectable()
export class MessagingWorker {
  private readonly logger = new Logger(MessagingWorker.name);
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigurationService,
    private readonly systemSettings: SystemSettingsService,
    private readonly outbox: MessagingOutboxRepository,
    private readonly templateResolver: TemplateResolverService,
    private readonly placeholderRenderer: PlaceholderRendererService,
    private readonly smsProvider: AfricasTalkingSmsService,
    private readonly emailProvider: SmtpEmailService,
    private readonly attachmentGenerator: AttachmentGeneratorService,
    private readonly attachmentService: MessagingAttachmentService,
    private readonly attachmentTemplates: MessagingAttachmentTemplatesService,
  ) {}

  /**
   * T030: Scheduled outbox processor.
   * Polls for eligible deliveries, renders, and sends them.
   */
  @Cron('*/5 * * * * *')
  async tick() {
    if (this.isProcessing) {
      this.logger.debug('Skipping tick - previous batch still processing');
      return;
    }

    this.isProcessing = true;
    try {
      const settings = await this.systemSettings.getSnapshot();
      const deliveries = await this.outbox.claimEligibleDeliveries(settings.workerBatchSize);

      if (deliveries.length === 0) {
        this.logger.debug('No eligible deliveries to process');
        return;
      }

      this.logger.log(`Processing ${deliveries.length} claimed deliveries`);

      // Process each delivery
      for (const delivery of deliveries) {
        try {
          await this.processDelivery(delivery);
        } catch (error) {
          this.logger.error(
            `Error processing delivery ${delivery.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            error instanceof Error ? error.stack : undefined
          );
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async processDelivery(delivery: ClaimedDelivery) {
    const _correlationId = `worker-${Date.now()}`;

    try {
      // 1. Generate dynamic attachments first (EMAIL only)
      const specs = delivery.dynamicAttachmentSpecs as Array<{ attachmentTemplateId: string; params: Record<string, string> }> | null | undefined;
      if (delivery.channel === 'EMAIL' && Array.isArray(specs) && specs.length > 0) {
        await this.generateAndAttachDynamicAttachments(delivery.id, specs);
        // Reload delivery to get updated state (and any new attachments)
        const updated = await this.prisma.messagingDelivery.findUnique({
          where: { id: delivery.id },
          include: { attachments: true },
        });
        if (updated) {
          (delivery).attachments = updated.attachments;
          (delivery).dynamicAttachmentSpecs = null;
        }
      }

      // 2. If already rendered (e.g., from resend), skip rendering and send directly
      const needsRendering = !delivery.renderedBody || delivery.renderedBody.trim() === '';

      if (needsRendering) {
        // Render template + placeholders (not yet implemented for initial deliveries in this worker)
        this.logger.warn(`Delivery ${delivery.id} needs rendering - skipping for now (not yet implemented)`);
        await this.outbox.updateDeliveryStatus(delivery.id, {
          status: 'FAILED',
          lastError: 'Rendering not yet implemented in worker',
        });
        return;
      }

      // 3. Send via provider
      if (delivery.channel === 'SMS') {
        if (!delivery.recipientPhone) {
          await this.outbox.updateDeliveryStatus(delivery.id, {
            status: 'FAILED',
            lastError: 'No recipient phone number',
          });
          return;
        }

        await this.smsProvider.sendSms({
          to: delivery.recipientPhone,
          message: delivery.renderedBody,
        });

        await this.outbox.updateDeliveryStatus(delivery.id, {
          status: 'SENT',
          attemptCount: { increment: 1 },
        });
      } else if (delivery.channel === 'EMAIL') {
        if (!delivery.recipientEmail) {
          await this.outbox.updateDeliveryStatus(delivery.id, {
            status: 'FAILED',
            lastError: 'No recipient email',
          });
          return;
        }

        const attachments = (delivery).attachments ?? [];
        const emailAttachments = attachments
          .filter((a) => !a.deletedAt)
          .map(async (a) => {
            const { buffer, contentType } = await this.attachmentService.getAttachment(a.storagePath);
            return { filename: a.fileName, content: buffer, contentType };
          });
        const resolvedAttachments = await Promise.all(emailAttachments);

        await this.emailProvider.sendEmail({
          to: delivery.recipientEmail,
          subject: (delivery.renderedSubject as string) ?? 'Message from MicroBima',
          htmlBody: delivery.renderedBody,
          textBody: delivery.renderedTextBody ?? undefined,
          attachments: resolvedAttachments.length > 0 ? resolvedAttachments : undefined,
        });

        await this.outbox.updateDeliveryStatus(delivery.id, {
          status: 'SENT',
          attemptCount: { increment: 1 },
        });
      }

      this.logger.log(`Delivery ${delivery.id} sent successfully (channel=${delivery.channel})`);
    } catch (error) {
      this.logger.error(
        `Failed to process delivery ${delivery.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      // Report to Sentry
      Sentry.captureException(error, {
        tags: {
          service: 'MessagingWorker',
          operation: 'processDelivery',
          deliveryId: delivery.id,
          channel: delivery.channel,
        },
      });

      // Mark as failed or retry
      await this.outbox.updateDeliveryStatus(delivery.id, {
        status: 'FAILED',
        lastError: error instanceof Error ? error.message : 'Unknown error',
        attemptCount: { increment: 1 },
      });
    }
  }

  /**
   * Generate PDFs from dynamic attachment specs, upload to storage, create MessagingAttachment records,
   * and clear dynamicAttachmentSpecs on the delivery.
   */
  private async generateAndAttachDynamicAttachments(
    deliveryId: string,
    specs: Array<{ attachmentTemplateId: string; params: Record<string, string> }>,
  ): Promise<void> {
    const settings = await this.systemSettings.getSnapshot();
    const retentionMonths = Math.max(0, settings.messagingAttachmentRetentionMonths);
    const bucket = this.config.messaging.supabaseMessagingAttachmentsBucket;
    const now = new Date();
    const expiresAt = this.attachmentService.getExpiresAt(now, retentionMonths);

    for (const spec of specs) {
      const template = await this.attachmentTemplates.getById(spec.attachmentTemplateId);
      if (!template) {
        this.logger.warn(`Attachment template ${spec.attachmentTemplateId} not found, skipping`);
        continue;
      }

      try {
        let generated: { buffer: Buffer; fileName: string; mimeType: string };
        if (template.attachmentType === MessagingAttachmentTemplateType.MEMBER_CARD) {
          const policyId = spec.params['policyId'];
          const memberIndex = parseInt(spec.params['memberIndex'] ?? '0', 10);
          if (!policyId) {
            this.logger.warn('MEMBER_CARD attachment missing policyId, skipping');
            continue;
          }
          generated = await this.attachmentGenerator.generateMemberCardPdf(policyId, memberIndex);
        } else {
          const placeholderValues: Record<string, string> = {};
          for (const [k, v] of Object.entries(spec.params)) placeholderValues[k] = String(v);
          generated = await this.attachmentGenerator.generateFromGenericHtml(
            template.templatePath,
            placeholderValues,
            template.name + '.pdf',
          );
        }

        const attachmentId = crypto.randomUUID();
        const storagePath = await this.attachmentService.uploadAttachment(
          deliveryId,
          attachmentId,
          generated.fileName,
          generated.buffer,
        );

        await this.prisma.messagingAttachment.create({
          data: {
            id: attachmentId,
            deliveryId,
            fileName: generated.fileName,
            mimeType: generated.mimeType,
            storageBucket: bucket,
            storagePath,
            sizeBytes: generated.buffer.length,
            expiresAt,
          },
        });

        this.logger.log(`Generated and attached ${generated.fileName} for delivery ${deliveryId}`);
      } catch (err) {
        this.logger.error(
          `Failed to generate attachment for template ${template.id}: ${err instanceof Error ? err.message : 'Unknown error'}`,
          err instanceof Error ? err.stack : undefined,
        );
        Sentry.captureException(err, {
          tags: { service: 'MessagingWorker', operation: 'generateAndAttachDynamicAttachments', templateId: template.id },
        });
        throw err;
      }
    }

    await this.prisma.messagingDelivery.update({
      where: { id: deliveryId },
      data: { dynamicAttachmentSpecs: Prisma.JsonNull },
    });
  }
}

