import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as Sentry from '@sentry/nestjs';
import { PolicyLifecycleService } from './policy-lifecycle.service';

/**
 * Daily policy lifecycle evaluation job (@Cron 01:00 UTC).
 */
@Injectable()
export class PolicyLifecycleJobService {
  private readonly logger = new Logger(PolicyLifecycleJobService.name);
  private isRunning = false;

  constructor(private readonly lifecycleService: PolicyLifecycleService) {}

  @Cron('0 1 * * *', { timeZone: 'UTC' })
  async handleCron(): Promise<void> {
    const correlationId = `lifecycle-cron-${Date.now()}`;
    try {
      await this.runDaily(correlationId);
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Daily lifecycle cron failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined
      );
      Sentry.captureException(error, {
        tags: { service: 'PolicyLifecycleJobService', operation: 'handleCron' },
        extra: { correlationId },
      });
    }
  }

  async runDaily(correlationId?: string): Promise<{
    evaluatedAt: string;
    graceEntered: number;
    graceCleared: number;
    suspended: number;
    inactivated: number;
    expired: number;
    notificationsQueued: number;
    correlationId: string;
    durationMs: number;
  }> {
    const cid = correlationId ?? `lifecycle-daily-${Date.now()}`;
    if (this.isRunning) {
      this.logger.warn(`[${cid}] Skipping daily run — previous run still in progress`);
      return {
        evaluatedAt: new Date().toISOString(),
        graceEntered: 0,
        graceCleared: 0,
        suspended: 0,
        inactivated: 0,
        expired: 0,
        notificationsQueued: 0,
        correlationId: cid,
        durationMs: 0,
      };
    }

    this.isRunning = true;
    const started = Date.now();
    this.logger.log(`[${cid}] PolicyLifecycleJobService.runDaily starting`);

    try {
      const asOf = new Date();

      // DEACTIVATED/TERMINATED are excluded inside each evaluator; Suspended past end
      // is frozen (no Inactive/Expired) inside evaluateInactive / evaluateTermEnd.
      const pendingQueued =
        await this.lifecycleService.evaluatePendingActivationReminders(asOf, cid);
      const grace = await this.lifecycleService.evaluateGraceForActivePolicies(asOf, cid);
      const suspend = await this.lifecycleService.evaluateSuspendForActivePolicies(asOf, cid);
      const inactive = await this.lifecycleService.evaluateInactiveForSuspendedPolicies(
        asOf,
        cid
      );
      const termEnd = await this.lifecycleService.evaluateTermEndTransitions(asOf, cid);
      const renewalQueued = await this.lifecycleService.evaluateRenewalReminders(asOf, cid);

      const durationMs = Date.now() - started;
      const result = {
        evaluatedAt: asOf.toISOString(),
        graceEntered: grace.graceEntered,
        graceCleared: grace.graceCleared,
        suspended: suspend.suspended,
        inactivated: inactive.inactivated,
        expired: termEnd.expired,
        notificationsQueued:
          pendingQueued +
          grace.notificationsQueued +
          suspend.notificationsQueued +
          inactive.notificationsQueued +
          renewalQueued,
        correlationId: cid,
        durationMs,
      };

      this.logger.log(
        `[${cid}] PolicyLifecycleJobService.runDaily finished in ${durationMs}ms ` +
          `graceEntered=${result.graceEntered} suspended=${result.suspended} ` +
          `inactivated=${result.inactivated} expired=${result.expired} ` +
          `notificationsQueued=${result.notificationsQueued}`
      );

      return result;
    } catch (error) {
      const durationMs = Date.now() - started;
      this.logger.error(
        `[${cid}] PolicyLifecycleJobService.runDaily failed after ${durationMs}ms: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined
      );
      Sentry.captureException(error, {
        tags: { service: 'PolicyLifecycleJobService', operation: 'runDaily' },
        extra: { correlationId: cid, durationMs },
      });
      throw error;
    } finally {
      this.isRunning = false;
    }
  }
}
