import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagingService } from './messaging.service';
import { SystemSettingsService } from './settings/system-settings.service';
import { formatSmsAmount, formatSmsDate } from '../../utils/sms-format.util';

export const PENDING_ACTIVATION_SCHEDULE = {
  D3: 'PENDING_D3',
  D7: 'PENDING_D7',
} as const;

export const PENDING_ACTIVATION_TEMPLATE = {
  D3: 'pending_activation_d3',
  D7: 'pending_activation_d7',
} as const;

export const GRACE_SCHEDULE = {
  DUE: 'GRACE_DUE',
  D7: 'GRACE_D7',
  D10: 'GRACE_D10',
  D13: 'GRACE_D13',
} as const;

export const GRACE_TEMPLATE = {
  DUE: 'grace_due',
  D7: 'grace_d7',
  D10: 'grace_d10',
  D13: 'grace_d13',
} as const;

export const SUSPEND_SCHEDULE = {
  D1: 'SUSPEND_D1',
  D7: 'SUSPEND_D7',
  D13: 'SUSPEND_D13',
} as const;

export const SUSPEND_TEMPLATE = {
  NOTICE: 'policy_suspended',
  D1: 'suspend_d1',
  D7: 'suspend_d7',
  D13: 'suspend_d13',
  REACTIVATE: 'policy_reactivated',
} as const;

export type PendingActivationScheduleKey =
  (typeof PENDING_ACTIVATION_SCHEDULE)[keyof typeof PENDING_ACTIVATION_SCHEDULE];

export interface EnqueueLifecycleNotificationParams {
  policyId: string;
  customerId: string;
  scheduleKey: string;
  templateKey: string;
  placeholderValues: Record<string, string>;
  correlationId: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Lifecycle SMS with PolicyLifecycleNotification ledger dedupe.
 * Insert ledger row before enqueue; unique (policyId, scheduleKey) = already sent/suppressed.
 */
@Injectable()
export class PolicyLifecycleMessagingService {
  private readonly logger = new Logger(PolicyLifecycleMessagingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messagingService: MessagingService,
    private readonly systemSettings: SystemSettingsService
  ) {}

  /**
   * Fire-and-forget wrapper for lifecycle notifications.
   */
  enqueueLifecycleNotificationAsync(params: EnqueueLifecycleNotificationParams): void {
    this.enqueueLifecycleNotification(params).catch((error) => {
      this.logger.warn(
        `[${params.correlationId}] Failed lifecycle SMS scheduleKey=${params.scheduleKey} policy=${params.policyId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    });
  }

  /**
   * Insert ledger then enqueue. Returns false if scheduleKey already recorded (idempotent).
   */
  async enqueueLifecycleNotification(
    params: EnqueueLifecycleNotificationParams
  ): Promise<boolean> {
    try {
      await this.prisma.policyLifecycleNotification.create({
        data: {
          policyId: params.policyId,
          scheduleKey: params.scheduleKey,
          templateKey: params.templateKey,
          metadata: params.metadata ?? Prisma.JsonNull,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.debug(
          `[${params.correlationId}] Lifecycle SMS already recorded policy=${params.policyId} key=${params.scheduleKey}`
        );
        return false;
      }
      throw error;
    }

    await this.messagingService.enqueue({
      templateKey: params.templateKey,
      customerId: params.customerId,
      policyId: params.policyId,
      placeholderValues: params.placeholderValues,
      correlationId: params.correlationId,
    });

    this.logger.log(
      `[${params.correlationId}] Enqueued lifecycle SMS ${params.templateKey} for policy ${params.policyId}`
    );
    return true;
  }

  /**
   * Mark PENDING_D3 / PENDING_D7 as suppressed without sending SMS so daily eval skips them.
   */
  async suppressPendingActivationReminders(
    policyId: string,
    correlationId: string,
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const client = tx ?? this.prisma;
    const keys: Array<{ scheduleKey: string; templateKey: string }> = [
      {
        scheduleKey: PENDING_ACTIVATION_SCHEDULE.D3,
        templateKey: PENDING_ACTIVATION_TEMPLATE.D3,
      },
      {
        scheduleKey: PENDING_ACTIVATION_SCHEDULE.D7,
        templateKey: PENDING_ACTIVATION_TEMPLATE.D7,
      },
    ];

    // Use createMany + skipDuplicates (ON CONFLICT DO NOTHING) so existing
    // schedule keys do not abort a shared Postgres transaction (P2002 / 25P02).
    await client.policyLifecycleNotification.createMany({
      data: keys.map((row) => ({
        policyId,
        scheduleKey: row.scheduleKey,
        templateKey: row.templateKey,
        metadata: {
          suppressed: true,
          reason: 'activated',
          correlationId,
        },
      })),
      skipDuplicates: true,
    });

    this.logger.log(
      `[${correlationId}] Suppressed pending-activation reminders for policy ${policyId}`
    );
  }

  async buildPendingReminderPlaceholders(params: {
    firstName: string;
    productName: string;
  }): Promise<Record<string, string>> {
    const settings = await this.systemSettings.getSnapshot();
    return {
      first_name: params.firstName,
      product_name: params.productName,
      general_support_number: settings.general_support_number ?? '',
    };
  }

  async buildGraceReminderPlaceholders(params: {
    firstName: string;
    productName: string;
    arrears: number;
    dueDate: Date;
  }): Promise<Record<string, string>> {
    const settings = await this.systemSettings.getSnapshot();
    return {
      first_name: params.firstName,
      product_name: params.productName,
      amount_due: formatSmsAmount(params.arrears, settings.defaultSystemCurrency),
      due_date: formatSmsDate(params.dueDate),
      general_support_number: settings.general_support_number ?? '',
    };
  }
}
