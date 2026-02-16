import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SendGridEmailService {
  private readonly logger = new Logger(SendGridEmailService.name);

  // Implemented in T031 (SendGrid send + provider IDs).
  async sendEmail() {
    this.logger.debug('sendEmail() called');
    throw new Error('SendGridEmailService not implemented yet');
  }
}

