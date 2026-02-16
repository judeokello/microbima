import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../../services/supabase.service';

@Injectable()
export class MessagingAttachmentService {
  private readonly logger = new Logger(MessagingAttachmentService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  // Implemented in T032 (upload/list/download; expiry checks).
  async listAttachmentsForDelivery(_deliveryId: string) {
    this.logger.debug('listAttachmentsForDelivery() called');
    return [];
  }
}

