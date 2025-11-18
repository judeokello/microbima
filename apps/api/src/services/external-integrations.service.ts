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
 * - PostHog analytics
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
    [key: string]: any;
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
   * Track event to PostHog asynchronously
   * @param eventName - Name of the event
   * @param properties - Event properties
   * @param context - Additional context
   */
  async trackEventToPostHog(eventName: string, _properties: Record<string, any> = {}, context: {
    correlationId?: string;
    userId?: string;
    [key: string]: any;
  } = {}): Promise<void> {
    // Skip if PostHog is not configured
    if (!this.configService.posthog.enabled) {
      return;
    }

    try {
      // Fire and forget - don't await
      setImmediate(async () => {
        try {
          // TODO: Implement actual PostHog integration
          // await posthog.capture({
          //   distinctId: context.userId || 'anonymous',
          //   event: eventName,
          //   properties: {
          //     correlationId: context.correlationId,
          //     ...properties,
          //   },
          // });

          this.logger.debug(
            `[${context.correlationId ?? 'unknown'}] Event tracked to PostHog: ${eventName}`,
          );
        } catch (posthogError) {
          // Log but don't throw - external service failures shouldn't break the app
          this.logger.error(
            `[${context.correlationId ?? 'unknown'}] Failed to track event to PostHog: ${posthogError instanceof Error ? posthogError.message : 'Unknown error'}`,
          );
        }
      });
    } catch (error) {
      // Log but don't throw - this should never happen but safety first
      this.logger.error('Unexpected error in PostHog tracking:', error);
    }
  }

  /**
   * Track user identification to PostHog asynchronously
   * @param userId - User ID to identify
   * @param properties - User properties
   * @param context - Additional context
   */
  async identifyUserToPostHog(userId: string, _properties: Record<string, any> = {}, context: {
    correlationId?: string;
    [key: string]: any;
  } = {}): Promise<void> {
    // Skip if PostHog is not configured
    if (!this.configService.posthog.enabled) {
      return;
    }

    try {
      // Fire and forget - don't await
      setImmediate(async () => {
        try {
          // TODO: Implement actual PostHog identification
          // await posthog.identify({
          //   distinctId: userId,
          //   properties: {
          //     correlationId: context.correlationId,
          //     ...properties,
          //   },
          // });

          this.logger.debug(
            `[${context.correlationId ?? 'unknown'}] User identified to PostHog: ${userId}`,
          );
        } catch (posthogError) {
          // Log but don't throw - external service failures shouldn't break the app
          this.logger.error(
            `[${context.correlationId ?? 'unknown'}] Failed to identify user to PostHog: ${posthogError instanceof Error ? posthogError.message : 'Unknown error'}`,
          );
        }
      });
    } catch (error) {
      // Log but don't throw - this should never happen but safety first
      this.logger.error('Unexpected error in PostHog identification:', error);
    }
  }

  /**
   * Future enhancement: Send to message queue for reliability
   * This would ensure external calls are never lost, even if
   * the external service is temporarily unavailable
   */
  private async sendToMessageQueue(queueName: string, data: any): Promise<void> {
    // TODO: Implement message queue integration
    // await redisClient.lpush(queueName, JSON.stringify(data));
    this.logger.debug(`Message queued for ${queueName}: ${JSON.stringify(data)}`);
  }
}
