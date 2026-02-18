import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { MessagingAttachmentService } from './attachment.service';

/**
 * T046: Scheduled attachment retention cleanup job.
 *
 * Runs daily at 03:00 UTC to:
 * - Find attachments with expiresAt <= now and deletedAt is null
 * - Delete objects from storage (Supabase or local)
 * - Mark attachment records as deleted (deletedAt) for audit visibility
 */
@Injectable()
export class AttachmentRetentionCleanupService {
  private readonly logger = new Logger(AttachmentRetentionCleanupService.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly attachmentService: MessagingAttachmentService,
  ) {}

  @Cron('0 3 * * *') // 03:00 UTC daily
  async runCleanup() {
    if (this.isRunning) {
      this.logger.debug('Skipping retention cleanup - previous run still in progress');
      return;
    }

    this.isRunning = true;
    const now = new Date();
    let processed = 0;

    try {
      const expired = await this.prisma.messagingAttachment.findMany({
        where: {
          expiresAt: { lte: now },
          deletedAt: null,
        },
        select: { id: true, storagePath: true },
      });

      for (const att of expired) {
        try {
          await this.attachmentService.deleteAttachment(att.storagePath);
          await this.prisma.messagingAttachment.update({
            where: { id: att.id },
            data: { deletedAt: now },
          });
          processed++;
        } catch (err) {
          this.logger.error(
            `Failed to delete expired attachment ${att.id}: ${err instanceof Error ? err.message : String(err)}`,
            err instanceof Error ? err.stack : undefined
          );
          // Continue with next; do not mark as deleted if storage delete failed
        }
      }

      if (processed > 0) {
        this.logger.log(`Attachment retention cleanup: deleted ${processed} expired attachment(s)`);
      }
    } finally {
      this.isRunning = false;
    }
  }
}
