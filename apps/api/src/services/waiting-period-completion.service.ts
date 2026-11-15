import { Injectable, Logger } from '@nestjs/common';
import { PolicyStatus, Prisma } from '@prisma/client';
import * as Sentry from '@sentry/nestjs';
import { PrismaService } from '../prisma/prisma.service';
import { LctSyncService } from '../modules/lct/lct-sync.service';
import { MessagingService } from '../modules/messaging/messaging.service';
import { SystemSettingsService } from '../modules/messaging/settings/system-settings.service';
import {
  isWaitingAccessOnDay,
  isWaitingAccessReached,
} from '../utils/waiting-period.util';

export const WAITING_PERIOD_ENDED_SCHEDULE_KEY = 'WAITING_PERIOD_ENDED';
export const WAITING_PERIOD_ENDED_TEMPLATE = 'waiting_period_ended';

/**
 * After the daily lifecycle run has suspended, inactivated, and expired policies,
 * enroll still-active members whose waiting period has elapsed and text those
 * whose access date is this UTC day.
 */
@Injectable()
export class WaitingPeriodCompletionService {
  private readonly logger = new Logger(WaitingPeriodCompletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lctSyncService: LctSyncService,
    private readonly messagingService: MessagingService,
    private readonly systemSettings: SystemSettingsService,
  ) {}

  async evaluate(
    asOf: Date,
    correlationId: string,
  ): Promise<{ lctEnrolled: number; smsQueued: number }> {
    const policies = await this.prisma.policy.findMany({
      where: {
        status: PolicyStatus.ACTIVE,
        startDate: { not: null },
        customer: { isTestUser: false },
      },
      select: {
        id: true,
        customerId: true,
        packageId: true,
        startDate: true,
        productName: true,
        lctMemberSyncTargets: {
          select: { pendingAction: true, lastSentAt: true },
        },
      },
    });

    const customerIds = [...new Set(policies.map((policy) => policy.customerId))];
    const links =
      customerIds.length === 0
        ? []
        : await this.prisma.packageSchemeCustomer.findMany({
            where: { customerId: { in: customerIds } },
            select: {
              customerId: true,
              packageScheme: {
                select: { packageId: true, generalSchemeWaitingPeriod: true },
              },
            },
          });

    const waitingByKey = new Map<string, number>();
    for (const link of links) {
      const days = link.packageScheme.generalSchemeWaitingPeriod;
      if (days == null) continue;
      waitingByKey.set(`${link.customerId}:${link.packageScheme.packageId}`, days);
    }

    const settings = await this.systemSettings.getSnapshot();
    let lctEnrolled = 0;
    let smsQueued = 0;

    for (const policy of policies) {
      if (!policy.startDate) continue;
      const days = waitingByKey.get(`${policy.customerId}:${policy.packageId}`);
      if (days == null || days <= 0) continue;

      if (isWaitingAccessReached(policy.startDate, days, asOf)) {
        const alreadyEnrolled = policy.lctMemberSyncTargets.some(
          (target) => target.pendingAction != null || target.lastSentAt != null,
        );
        if (!alreadyEnrolled) {
          try {
            await this.lctSyncService.onPolicyActivated(policy.id, correlationId);
            lctEnrolled += 1;
          } catch (error) {
            this.logger.error(
              `[${correlationId}] Waiting-period LCT enroll failed policy=${policy.id}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
            Sentry.captureException(error, {
              tags: { service: 'WaitingPeriodCompletionService', operation: 'lctEnroll' },
              extra: { correlationId, policyId: policy.id },
            });
          }
        }
      }

      if (isWaitingAccessOnDay(policy.startDate, days, asOf)) {
        try {
          const queued = await this.enqueueEndedSms(
            policy.id,
            policy.customerId,
            policy.productName,
            settings.general_support_number,
            correlationId,
          );
          if (queued) smsQueued += 1;
        } catch (error) {
          this.logger.error(
            `[${correlationId}] Waiting-period SMS failed policy=${policy.id}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          Sentry.captureException(error, {
            tags: { service: 'WaitingPeriodCompletionService', operation: 'sms' },
            extra: { correlationId, policyId: policy.id },
          });
        }
      }
    }

    this.logger.log(
      `[${correlationId}] Waiting-period completion lctEnrolled=${lctEnrolled} smsQueued=${smsQueued}`,
    );
    return { lctEnrolled, smsQueued };
  }

  /**
   * Queue the SMS first, then record the ledger, so a failed enqueue can be retried
   * on a later run the same UTC day.
   */
  private async enqueueEndedSms(
    policyId: string,
    customerId: string,
    productName: string,
    generalSupportNumber: string,
    correlationId: string,
  ): Promise<boolean> {
    const existing = await this.prisma.policyLifecycleNotification.findUnique({
      where: {
        policyId_scheduleKey: {
          policyId,
          scheduleKey: WAITING_PERIOD_ENDED_SCHEDULE_KEY,
        },
      },
      select: { id: true },
    });
    if (existing) return false;

    await this.messagingService.enqueue({
      templateKey: WAITING_PERIOD_ENDED_TEMPLATE,
      customerId,
      policyId,
      placeholderValues: {
        product_name: productName ?? '',
        general_support_number: generalSupportNumber,
      },
      correlationId,
    });

    try {
      await this.prisma.policyLifecycleNotification.create({
        data: {
          policyId,
          scheduleKey: WAITING_PERIOD_ENDED_SCHEDULE_KEY,
          templateKey: WAITING_PERIOD_ENDED_TEMPLATE,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return true;
      }
      throw error;
    }

    return true;
  }
}
