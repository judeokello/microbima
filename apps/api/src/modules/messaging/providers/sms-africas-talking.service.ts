import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AfricasTalkingSmsService {
  private readonly logger = new Logger(AfricasTalkingSmsService.name);

  // Implemented in T031 (Africa's Talking send + provider IDs).
  async sendSms() {
    this.logger.debug('sendSms() called');
    throw new Error('AfricasTalkingSmsService not implemented yet');
  }
}

