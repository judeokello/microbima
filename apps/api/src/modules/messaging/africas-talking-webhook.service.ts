import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagingProvider } from '@prisma/client';
import { createHash } from 'crypto';

/**
 * T036/T038: Africa's Talking SMS webhook handler.
 * - Store raw payload for audit (MessagingProviderEvent).
 * - Dedupe by providerEventId (idempotent).
 * - Best-effort link to delivery by providerMessageId.
 * - T038: Only update delivery status if not already terminal (SENT/FAILED).
 */
@Injectable()
export class AfricasTalkingWebhookService {
  private readonly logger = new Logger(AfricasTalkingWebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Process webhook payload: store for audit, optionally link to delivery and update status.
   * Always returns (no throw) so controller can return 200.
   */
  async handlePayload(payload: unknown): Promise<void> {
    const payloadObj = this.normalizePayload(payload);
    const providerEventId = this.deriveProviderEventId(payloadObj);

    try {
      // Idempotency: skip if we already have this event (T038)
      const existing = await this.prisma.messagingProviderEvent.findFirst({
        where: {
          provider: MessagingProvider.AFRICAS_TALKING,
          providerEventId,
        },
      });
      if (existing) {
        this.logger.debug(`Africa's Talking webhook dedupe: providerEventId=${providerEventId}`);
        return;
      }

      const deliveryId = await this.tryResolveDeliveryId(payloadObj);
      const eventType = this.extractEventType(payloadObj);
      const occurredAt = this.extractOccurredAt(payloadObj);
      const providerMessageId = this.extractProviderMessageId(payloadObj);

      await this.prisma.messagingProviderEvent.create({
        data: {
          provider: MessagingProvider.AFRICAS_TALKING,
          providerEventId,
          providerMessageId: providerMessageId ?? null,
          deliveryId,
          eventType,
          occurredAt,
          payload: payloadObj as object,
        },
      });

      // T038: Update delivery status only if not already terminal (SENT/FAILED)
      if (deliveryId) {
        await this.maybeUpdateDeliveryStatus(deliveryId, payloadObj);
      }
    } catch (error) {
      this.logger.error(
        `Africa's Talking webhook store failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined
      );
      // Still return 200 per contract - we stored nothing but don't leak errors
    }
  }

  private normalizePayload(payload: unknown): Record<string, unknown> {
    if (payload !== null && typeof payload === 'object' && !Array.isArray(payload)) {
      return payload as Record<string, unknown>;
    }
    if (typeof payload === 'string') {
      try {
        const parsed = JSON.parse(payload) as unknown;
        return this.normalizePayload(parsed);
      } catch {
        return { raw: payload };
      }
    }
    return { _unknown: String(payload) };
  }

  private deriveProviderEventId(payload: Record<string, unknown>): string {
    const id =
      (payload.id as string) ??
      (payload.requestId as string) ??
      (payload.messageId as string) ??
      (payload.eventId as string);
    if (id && typeof id === 'string') {
      return id.slice(0, 200);
    }
    const hash = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex')
      .slice(0, 64);
    return `hash:${hash}`;
  }

  /**
   * Extract provider message ID from webhook payload.
   * Per Africa's Talking docs, delivery reports send the same identifier as the send response's
   * messageId, in the payload.id field. Compare with MessagingDelivery.providerMessageId.
   */
  private extractProviderMessageId(payload: Record<string, unknown>): string | null {
    const id = payload.id as string;
    return id && typeof id === 'string' ? id : null;
  }

  private extractEventType(payload: Record<string, unknown>): string {
    const type = (payload.status as string) ?? (payload.eventType as string) ?? (payload.event as string);
    return type && typeof type === 'string' ? type.slice(0, 100) : 'UNKNOWN';
  }

  private extractOccurredAt(payload: Record<string, unknown>): Date | null {
    const ts = payload.timestamp ?? payload.occurredAt ?? payload.createdAt;
    if (typeof ts === 'number' && ts > 0) {
      return new Date(ts * 1000);
    }
    if (typeof ts === 'string') {
      const d = new Date(ts);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  private async tryResolveDeliveryId(payload: Record<string, unknown>): Promise<string | null> {
    const messageId = this.extractProviderMessageId(payload);
    if (!messageId) return null;

    const delivery = await this.prisma.messagingDelivery.findFirst({
      where: { providerMessageId: messageId },
      select: { id: true },
    });
    return delivery?.id ?? null;
  }

  /**
   * T038: Only update delivery to terminal status if it is not already SENT or FAILED.
   */
  private async maybeUpdateDeliveryStatus(deliveryId: string, payload: Record<string, unknown>): Promise<void> {
    const delivery = await this.prisma.messagingDelivery.findUnique({
      where: { id: deliveryId },
      select: { status: true },
    });
    if (!delivery) return;

    const terminalStatuses = ['SENT', 'FAILED'];
    if (terminalStatuses.includes(delivery.status)) {
      this.logger.debug(`Skip status update for delivery ${deliveryId}: already ${delivery.status}`);
      return;
    }

    const status = (payload.status as string)?.toUpperCase?.() ?? payload.eventType ?? payload.event;
    let newStatus: 'SENT' | 'FAILED' | null = null;
    if (status === 'SUCCESS' || status === 'DELIVERED' || status === 'ACCEPTED') {
      newStatus = 'SENT';
    } else if (status === 'FAILED' || status === 'REJECTED' || status === 'UNDELIVERABLE') {
      newStatus = 'FAILED';
    }
    if (!newStatus) return;

    await this.prisma.messagingDelivery.update({
      where: { id: deliveryId },
      data: {
        status: newStatus,
        lastAttemptAt: new Date(),
        lastError: newStatus === 'FAILED' ? (payload.reason as string) ?? (payload.description as string) ?? 'Provider reported failure' : null,
      },
    });
    this.logger.log(`Delivery ${deliveryId} updated to ${newStatus} from Africa's Talking webhook`);
  }
}
