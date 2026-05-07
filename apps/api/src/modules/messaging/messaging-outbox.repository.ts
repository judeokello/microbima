import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class MessagingOutboxRepository {
  private readonly logger = new Logger(MessagingOutboxRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Claim eligible deliveries atomically using FOR UPDATE SKIP LOCKED.
   * Returns claimed deliveries (status updated to PROCESSING).
   */
  async claimEligibleDeliveries(batchSize: number) {
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const eligible = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM messaging_deliveries
        WHERE status IN ('PENDING', 'RETRY_WAIT')
          AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= ${now})
        ORDER BY "nextAttemptAt" ASC NULLS FIRST, "createdAt" ASC
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      `;

      if (eligible.length === 0) return [];

      const ids = eligible.map((r) => r.id);
      await tx.messagingDelivery.updateMany({
        where: { id: { in: ids } },
        data: {
          status: 'PROCESSING',
          lastAttemptAt: now,
        },
      });

      return tx.messagingDelivery.findMany({
        where: { id: { in: ids } },
        include: { customer: true, attachments: true },
      });
    });
  }

  /**
   * Reset deliveries stuck in PROCESSING back to PENDING.
   *
   * This guards against pod restarts or crashes mid-tick: if a delivery was
   * claimed (set to PROCESSING) but the process died before the send completed,
   * no code path would ever move it out of PROCESSING without this recovery step.
   * Any delivery that has been in PROCESSING for longer than staleAfterMinutes is
   * assumed to be orphaned and is returned to the PENDING queue.
   */
  async resetStaleProcessingDeliveries(staleAfterMinutes = 10): Promise<number> {
    const staleThreshold = new Date(Date.now() - staleAfterMinutes * 60 * 1_000);
    const result = await this.prisma.messagingDelivery.updateMany({
      where: {
        status: 'PROCESSING',
        lastAttemptAt: { lt: staleThreshold },
      },
      data: { status: 'PENDING' },
    });
    if (result.count > 0) {
      this.logger.warn(`Recovered ${result.count} stale PROCESSING deliveries → PENDING`);
    }
    return result.count;
  }

  /**
   * Update delivery status and attempt counters.
   */
  async updateDeliveryStatus(deliveryId: string, update: Prisma.MessagingDeliveryUpdateInput) {
    return this.prisma.messagingDelivery.update({
      where: { id: deliveryId },
      data: update,
    });
  }
}

