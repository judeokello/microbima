import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SystemSettingsService } from './settings/system-settings.service';
import { EnqueueMessageRequest } from './messaging.types';

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
   * NOTE: Full routing/template logic implemented in later tasks.
   */
  async enqueue(_req: EnqueueMessageRequest) {
    // Placeholder: will be implemented in T017.
    this.logger.debug('enqueue() called');
    return { createdDeliveryIds: [] as string[] };
  }

  /**
   * Resend a specific prior delivery (per selected channel).
   *
   * NOTE: Implemented in later tasks (T027–T029).
   */
  async resendDelivery(_deliveryId: string) {
    this.logger.debug('resendDelivery() called');
    return { newDeliveryId: '' };
  }

  /**
   * List deliveries for admin/support views.
   *
   * NOTE: Implemented in later tasks (T020).
   */
  async listDeliveries() {
    this.logger.debug('listDeliveries() called');
    return [];
  }
}

