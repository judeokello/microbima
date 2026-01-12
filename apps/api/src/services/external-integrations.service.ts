import { Injectable, Logger } from '@nestjs/common';
import { ConfigurationService } from '../config/configuration.service';
import * as Sentry from '@sentry/nestjs';

/**
 * External Integrations Service
 *
 * Handles all external service calls asynchronously to avoid blocking
 * the main request flow. In the future, this could be enhanced with
 * message queues for better reliability.
 *
 * Current integrations:
 * - Sentry error reporting
 *
 * Future enhancements:
 * - Message queue integration (Redis/RabbitMQ)
 * - Retry mechanisms
 * - Circuit breaker patterns
 */
@Injectable()
export class ExternalIntegrationsService {
  private readonly logger = new Logger(ExternalIntegrationsService.name);

  constructor(private readonly configService: ConfigurationService) {}

  /**
   * Report error to Sentry asynchronously
   * @param error - The error to report
   * @param context - Additional context (correlationId, request info, etc.)
   */
  async reportErrorToSentry(error: Error, context: {
    correlationId?: string;
    requestUrl?: string;
    requestMethod?: string;
    userId?: string;
    [key: string]: unknown;
  } = {}): Promise<void> {
    // Skip if Sentry is not enabled
    if (!this.configService.sentry.enabled) {
      return;
    }

    try {
      // Fire and forget - don't await
      setImmediate(async () => {
        try {
          Sentry.captureException(error, {
            tags: {
              correlationId: context.correlationId,
              endpoint: context.requestUrl,
              method: context.requestMethod,
            },
            extra: {
              userId: context.userId,
              ...context,
            },
          });

          this.logger.debug(
            `[${context.correlationId ?? 'unknown'}] Error reported to Sentry: ${error.message}`,
          );
        } catch (sentryError) {
          // Log but don't throw - external service failures shouldn't break the app
          this.logger.error(
            `[${context.correlationId ?? 'unknown'}] Failed to report error to Sentry: ${sentryError instanceof Error ? sentryError.message : 'Unknown error'}`,
          );
        }
      });
    } catch (error) {
      // Log but don't throw - this should never happen but safety first
      this.logger.error('Unexpected error in Sentry reporting:', error);
    }
  }

  /**
   * Future enhancement: Send to message queue for reliability
   * This would ensure external calls are never lost, even if
   * the external service is temporarily unavailable
   */
  private async sendToMessageQueue(queueName: string, data: unknown): Promise<void> {
    // TODO: Implement message queue integration
    // await redisClient.lpush(queueName, JSON.stringify(data));
    this.logger.debug(`Message queued for ${queueName}: ${JSON.stringify(data)}`);
  }
}
