import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SystemSettingsService } from './settings/system-settings.service';

@Injectable()
export class MessagingWorker {
  private readonly logger = new Logger(MessagingWorker.name);

  constructor(private readonly systemSettings: SystemSettingsService) {}

  /**
   * Scheduled outbox processor.
   *
   * NOTE: Implemented in T030. We keep a safe no-op tick for now.
   */
  @Cron('*/5 * * * * *')
  async tick() {
    const settings = await this.systemSettings.getSnapshot();
    // In T030, this will use settings.workerPollIntervalSeconds rather than fixed cron.
    this.logger.debug(`worker tick (batchSize=${settings.workerBatchSize})`);
  }
}

