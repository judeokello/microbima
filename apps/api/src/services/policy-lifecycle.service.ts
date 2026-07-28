import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CustomerStatus,
  PaymentFrequency,
  PaymentStatus,
  PaymentType,
  PolicyStatus,
  Prisma,
  StatusChangeEntityType,
  StatusChangeTrigger,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EntityStatusChangeService } from './entity-status-change.service';
import { PolicyService } from './policy.service';
import { ValidationException } from '../exceptions/validation.exception';
import { ErrorCodes } from '../enums/error-codes.enum';
import { PAYMENT_CADENCE } from '../constants/payment-cadence.constants';
import { policyDatesFromPayment, policyEndDateFromStart } from '../utils/policy-dates.util';
import {
  getBasePolicyNumber,
  nextDisabledPolicyNumber,
} from '../utils/disabled-policy-number.util';
import {
  deriveFamilyCategoryFromDependants,
  hasAdditionalSpousePremium,
} from '../utils/family-category.util';
import {
  ActivatePolicyRequestDto,
  DeactivatePolicyRequestDto,
  ModifyPolicyOptionsResponseDto,
  ModifyPolicyRequestDto,
  PolicyLifecycleResponseDto,
  PolicyNumberChoice,
  ResetPolicyStartDateRequestDto,
  TerminatePolicyRequestDto,
} from '../dto/policy-lifecycle/policy-lifecycle.dto';
import {
  amountRequiredToRestoreInactive,
  amountRequiredToRestoreSuspended,
  daysOverdue,
  isPolicyEndDatePassed,
  nextUnpaidExpectedDueDate,
  outstandingArrears,
  utcCalendarDaysBetween,
} from '../utils/policy-due-date.util';
import { assertPolicyMayBecomeActive } from '../utils/policy-activation-gate.util';
import {
  addUtcCalendarDays,
  buildOutstandingTransactionReference,
  computeInstallmentBackfillSlots,
} from '../utils/installment-backfill.util';
import {
  GRACE_SCHEDULE,
  GRACE_TEMPLATE,
  PENDING_ACTIVATION_SCHEDULE,
  PENDING_ACTIVATION_TEMPLATE,
  PolicyLifecycleMessagingService,
  SUSPEND_SCHEDULE,
  SUSPEND_TEMPLATE,
} from '../modules/messaging/policy-lifecycle-messaging.service';
import { LctSyncService } from '../modules/lct/lct-sync.service';
import { utcDayStart, utcDayEnd, sumConfirmedPaidThroughAsOf, computeExpectedPremiumThroughAsOf } from '../utils/premium-statement-math';
import {
  CONFIRMED_PAYMENT_STATUSES,
  confirmedActivePaymentWhere,
  notDetachedPaymentWhere,
} from '../utils/policy-payment-filters';

/** Well-known actor UUID for SYSTEM / payment-lifecycle automated transitions. */
export const LIFECYCLE_SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000001';

const ADMIN_ROLE = 'registration_admin';

@Injectable()
export class PolicyLifecycleService {
  private readonly logger = new Logger(PolicyLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly statusChangeService: EntityStatusChangeService,
    private readonly policyService: PolicyService,
    private readonly lifecycleMessaging: PolicyLifecycleMessagingService,
    private readonly lctSyncService: LctSyncService
  ) {}

  assertAdmin(userRoles: string[]): void {
    if (userRoles.includes(ADMIN_ROLE)) return;
    throw new ForbiddenException({
      error: {
        code: ErrorCodes.INSUFFICIENT_PERMISSIONS,
        status: 403,
        message: 'Admin role required',
      },
    });
  }

  private calculatePaymentCadence(frequency: PaymentFrequency, customDays?: number): number {
    switch (frequency) {
      case PaymentFrequency.DAILY:
        return PAYMENT_CADENCE.DAILY;
      case PaymentFrequency.WEEKLY:
        return PAYMENT_CADENCE.WEEKLY;
      case PaymentFrequency.MONTHLY:
        return PAYMENT_CADENCE.MONTHLY;
      case PaymentFrequency.QUARTERLY:
        return PAYMENT_CADENCE.QUARTERLY;
      case PaymentFrequency.ANNUALLY:
        return PAYMENT_CADENCE.ANNUALLY;
      case PaymentFrequency.CUSTOM:
        if (!customDays || customDays <= 0) {
          throw new BadRequestException('Custom days must be provided for CUSTOM frequency');
        }
        return customDays;
      default:
        throw new BadRequestException(`Invalid payment frequency: ${frequency}`);
    }
  }

  private async loadPolicyForCustomer(customerId: string, policyId: string) {
    const policy = await this.prisma.policy.findFirst({
      where: { id: policyId, customerId },
      include: {
        package: { select: { id: true, name: true } },
        packagePlan: { select: { id: true, name: true } },
        customer: { select: { id: true, status: true, firstName: true } },
      },
    });
    if (!policy) {
      throw new NotFoundException('Policy not found or does not belong to this customer');
    }
    return policy;
  }

  private assertCustomerNotTerminated(customerStatus: CustomerStatus): void {
    if (customerStatus === CustomerStatus.TERMINATED) {
      throw ValidationException.forField(
        'customer',
        'Terminated customers cannot have policy lifecycle changes'
      );
    }
  }

  /**
   * Shared gate: policy must not become Active after end date, or from terminal statuses.
   * Used by admin activate and payment restore paths.
   */
  private assertPolicyMayBecomeActive(policy: {
    status: PolicyStatus;
    endDate: Date | null;
  }): void {
    assertPolicyMayBecomeActive(policy);
  }

  /**
   * Pending-activation D3/D7 reminders for policies still unpaid (callable from daily job stub).
   */
  async evaluatePendingActivationReminders(
    asOfUtc: Date = new Date(),
    correlationId: string
  ): Promise<number> {
    const pending = await this.prisma.policy.findMany({
      where: { status: PolicyStatus.PENDING_ACTIVATION },
      select: {
        id: true,
        createdAt: true,
        productName: true,
        customerId: true,
        customer: { select: { firstName: true } },
        policyPayments: {
          where: {
            ...notDetachedPaymentWhere(),
            paymentStatus: { in: CONFIRMED_PAYMENT_STATUSES },
            actualPaymentDate: { not: null },
          },
          take: 1,
          select: { id: true },
        },
      },
    });

    let queued = 0;
    for (const policy of pending) {
      if (policy.policyPayments.length > 0) {
        continue;
      }

      const daysSinceCreation = utcCalendarDaysBetween(policy.createdAt, asOfUtc);
      const placeholders = await this.lifecycleMessaging.buildPendingReminderPlaceholders({
        firstName: policy.customer.firstName ?? '',
        productName: policy.productName ?? '',
      });

      if (daysSinceCreation >= 3) {
        const sent = await this.lifecycleMessaging.enqueueLifecycleNotification({
          policyId: policy.id,
          customerId: policy.customerId,
          scheduleKey: PENDING_ACTIVATION_SCHEDULE.D3,
          templateKey: PENDING_ACTIVATION_TEMPLATE.D3,
          placeholderValues: placeholders,
          correlationId,
          metadata: { daysSinceCreation },
        });
        if (sent) queued += 1;
      }

      if (daysSinceCreation >= 7) {
        const sent = await this.lifecycleMessaging.enqueueLifecycleNotification({
          policyId: policy.id,
          customerId: policy.customerId,
          scheduleKey: PENDING_ACTIVATION_SCHEDULE.D7,
          templateKey: PENDING_ACTIVATION_TEMPLATE.D7,
          placeholderValues: placeholders,
          correlationId,
          metadata: { daysSinceCreation },
        });
        if (sent) queued += 1;
      }
    }

    this.logger.log(
      `[${correlationId}] Pending-activation reminder eval: ${queued} queued (${pending.length} pending policies)`
    );
    return queued;
  }

  /**
   * Skip remaining pending-activation reminders after first payment activates the policy.
   */
  async suppressPendingActivationRemindersOnActivation(
    policyId: string,
    correlationId: string,
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    await this.lifecycleMessaging.suppressPendingActivationReminders(
      policyId,
      correlationId,
      tx
    );
  }

  /**
   * Enter / update / clear grace overlay for Active policies (overdue 1–14 days).
   * Does not suspend (US3) or expire (US4).
   */
  async evaluateGraceForActivePolicies(
    asOfUtc: Date = new Date(),
    correlationId: string
  ): Promise<{ graceEntered: number; graceCleared: number; notificationsQueued: number }> {
    const policies = await this.prisma.policy.findMany({
      where: {
        status: PolicyStatus.ACTIVE,
        startDate: { not: null },
      },
      select: {
        id: true,
        customerId: true,
        productName: true,
        premium: true,
        paymentCadence: true,
        startDate: true,
        endDate: true,
        inGracePeriod: true,
        overdueAnchorDueDate: true,
        customer: { select: { firstName: true } },
        policyPayments: {
          where: notDetachedPaymentWhere(),
          select: {
            amount: true,
            paymentStatus: true,
            expectedPaymentDate: true,
          },
        },
      },
    });

    let graceEntered = 0;
    let graceCleared = 0;
    let notificationsQueued = 0;

    for (const policy of policies) {
      if (!policy.startDate) continue;
      if (isPolicyEndDatePassed(policy.endDate, asOfUtc)) continue;

      const installmentAmount = Number(policy.premium);
      if (policy.paymentCadence <= 0 || installmentAmount <= 0) continue;

      const policyStartDay = utcDayStart(
        policy.startDate.getUTCFullYear(),
        policy.startDate.getUTCMonth(),
        policy.startDate.getUTCDate()
      );
      const asOfEnd = utcDayEnd(
        asOfUtc.getUTCFullYear(),
        asOfUtc.getUTCMonth(),
        asOfUtc.getUTCDate()
      );
      const paidThroughAsOf = sumConfirmedPaidThroughAsOf(
        policy.policyPayments,
        policyStartDay,
        asOfEnd,
        CONFIRMED_PAYMENT_STATUSES
      );

      const nextDue = nextUnpaidExpectedDueDate({
        policyStart: policy.startDate,
        paymentCadenceDays: policy.paymentCadence,
        installmentAmount,
        paidThroughAsOf,
        asOfUtc,
      });
      const overdue = daysOverdue({ nextUnpaidDueDate: nextDue, asOfUtc });
      const arrears = outstandingArrears({
        policyStart: policy.startDate,
        paymentCadenceDays: policy.paymentCadence,
        installmentAmount,
        paidThroughAsOf,
        asOfUtc,
      });

      // Fully current or not yet overdue → clear grace if set
      if (overdue < 1 || arrears <= 0) {
        if (policy.inGracePeriod) {
          await this.clearGraceOverlay(policy, correlationId);
          graceCleared += 1;
        }
        continue;
      }

      // Overdue >14 → leave for suspend evaluation (US3)
      if (overdue > 14) {
        continue;
      }

      // Overdue 1–14 → ensure grace overlay
      const entered = await this.ensureGraceOverlay({
        policy,
        nextDue,
        overdue,
        arrears,
        correlationId,
        asOfUtc,
      });
      if (entered) graceEntered += 1;

      const placeholders = await this.lifecycleMessaging.buildGraceReminderPlaceholders({
        firstName: policy.customer.firstName ?? '',
        productName: policy.productName ?? '',
        arrears,
        dueDate: nextDue,
      });

      const schedulePoints: Array<{ minDays: number; scheduleKey: string; templateKey: string }> = [
        { minDays: 1, scheduleKey: GRACE_SCHEDULE.DUE, templateKey: GRACE_TEMPLATE.DUE },
        { minDays: 7, scheduleKey: GRACE_SCHEDULE.D7, templateKey: GRACE_TEMPLATE.D7 },
        { minDays: 10, scheduleKey: GRACE_SCHEDULE.D10, templateKey: GRACE_TEMPLATE.D10 },
        { minDays: 13, scheduleKey: GRACE_SCHEDULE.D13, templateKey: GRACE_TEMPLATE.D13 },
      ];

      for (const point of schedulePoints) {
        if (overdue < point.minDays) continue;
        const sent = await this.lifecycleMessaging.enqueueLifecycleNotification({
          policyId: policy.id,
          customerId: policy.customerId,
          scheduleKey: point.scheduleKey,
          templateKey: point.templateKey,
          placeholderValues: placeholders,
          correlationId,
          metadata: { overdueDays: overdue, anchorDueDate: nextDue.toISOString(), arrears },
        });
        if (sent) notificationsQueued += 1;
      }
    }

    this.logger.log(
      `[${correlationId}] Grace eval: entered=${graceEntered} cleared=${graceCleared} sms=${notificationsQueued}`
    );
    return { graceEntered, graceCleared, notificationsQueued };
  }

  private async ensureGraceOverlay(params: {
    policy: {
      id: string;
      customerId: string;
      inGracePeriod: boolean;
      overdueAnchorDueDate: Date | null;
    };
    nextDue: Date;
    overdue: number;
    arrears: number;
    correlationId: string;
    asOfUtc: Date;
  }): Promise<boolean> {
    const { policy, nextDue, overdue, arrears, correlationId, asOfUtc } = params;
    if (policy.inGracePeriod) {
      // Update anchor if the unpaid slot moved earlier
      if (
        policy.overdueAnchorDueDate == null ||
        nextDue.getTime() < policy.overdueAnchorDueDate.getTime()
      ) {
        await this.prisma.policy.update({
          where: { id: policy.id },
          data: { overdueAnchorDueDate: nextDue },
        });
      }
      return false;
    }

    await this.prisma.$transaction(async (tx) => {
      await this.statusChangeService.recordGraceEnter({
        customerId: policy.customerId,
        policyId: policy.id,
        reason: `Premium overdue ${overdue} day(s); entered grace`,
        trigger: StatusChangeTrigger.SYSTEM,
        changedBy: LIFECYCLE_SYSTEM_ACTOR_ID,
        correlationId,
        metadata: {
          overdueDays: overdue,
          anchorDueDate: nextDue.toISOString(),
          arrears,
        },
        tx,
      });

      await tx.policy.update({
        where: { id: policy.id },
        data: {
          inGracePeriod: true,
          graceEnteredAt: asOfUtc,
          overdueAnchorDueDate: nextDue,
        },
      });
    });

    return true;
  }

  async clearGraceOverlay(
    policy: { id: string; customerId: string; inGracePeriod: boolean },
    correlationId: string,
    trigger: StatusChangeTrigger = StatusChangeTrigger.SYSTEM,
    changedBy: string = LIFECYCLE_SYSTEM_ACTOR_ID,
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    if (!policy.inGracePeriod) return;

    const run = async (client: Prisma.TransactionClient) => {
      await this.statusChangeService.recordGraceExit({
        customerId: policy.customerId,
        policyId: policy.id,
        reason: 'Grace period cleared',
        trigger,
        changedBy,
        correlationId,
        tx: client,
      });
      await client.policy.update({
        where: { id: policy.id },
        data: {
          inGracePeriod: false,
          graceEnteredAt: null,
          overdueAnchorDueDate: null,
        },
      });
    };

    if (tx) {
      await run(tx);
    } else {
      await this.prisma.$transaction(run);
    }
  }

  /**
   * Active/Grace overdue &gt;14 days → Suspended (before end date).
   */
  async evaluateSuspendForActivePolicies(
    asOfUtc: Date = new Date(),
    correlationId: string
  ): Promise<{ suspended: number; notificationsQueued: number }> {
    const policies = await this.prisma.policy.findMany({
      where: {
        status: PolicyStatus.ACTIVE,
        startDate: { not: null },
      },
      select: {
        id: true,
        customerId: true,
        productName: true,
        premium: true,
        paymentCadence: true,
        startDate: true,
        endDate: true,
        inGracePeriod: true,
        customer: { select: { firstName: true } },
        policyPayments: {
          where: notDetachedPaymentWhere(),
          select: {
            amount: true,
            paymentStatus: true,
            expectedPaymentDate: true,
          },
        },
      },
    });

    let suspended = 0;
    let notificationsQueued = 0;

    for (const policy of policies) {
      if (!policy.startDate) continue;
      if (isPolicyEndDatePassed(policy.endDate, asOfUtc)) continue;

      const installmentAmount = Number(policy.premium);
      if (policy.paymentCadence <= 0 || installmentAmount <= 0) continue;

      const paidThroughAsOf = this.paidThroughAsOf(
        policy.startDate,
        policy.policyPayments,
        asOfUtc
      );
      const nextDue = nextUnpaidExpectedDueDate({
        policyStart: policy.startDate,
        paymentCadenceDays: policy.paymentCadence,
        installmentAmount,
        paidThroughAsOf,
        asOfUtc,
      });
      const overdue = daysOverdue({ nextUnpaidDueDate: nextDue, asOfUtc });
      if (overdue <= 14) continue;

      const arrears = outstandingArrears({
        policyStart: policy.startDate,
        paymentCadenceDays: policy.paymentCadence,
        installmentAmount,
        paidThroughAsOf,
        asOfUtc,
      });

      await this.prisma.$transaction(async (tx) => {
        if (policy.inGracePeriod) {
          await this.statusChangeService.recordGraceExit({
            customerId: policy.customerId,
            policyId: policy.id,
            reason: 'Grace ended; suspending for overdue >14 days',
            trigger: StatusChangeTrigger.SYSTEM,
            changedBy: LIFECYCLE_SYSTEM_ACTOR_ID,
            correlationId,
            toStatus: PolicyStatus.SUSPENDED,
            tx,
          });
        }

        await this.statusChangeService.recordPolicyChange({
          customerId: policy.customerId,
          policyId: policy.id,
          fromStatus: PolicyStatus.ACTIVE,
          toStatus: PolicyStatus.SUSPENDED,
          reason: `Premium overdue ${overdue} days; suspended`,
          trigger: StatusChangeTrigger.SYSTEM,
          changedBy: LIFECYCLE_SYSTEM_ACTOR_ID,
          correlationId,
          metadata: { overdueDays: overdue, arrears, anchorDueDate: nextDue.toISOString() },
          tx,
        });

        await tx.policy.update({
          where: { id: policy.id },
          data: {
            status: PolicyStatus.SUSPENDED,
            suspendedAt: asOfUtc,
            inGracePeriod: false,
            graceEnteredAt: null,
            overdueAnchorDueDate: null,
          },
        });

        await this.syncCustomerStatusAfterPolicyChange(
          policy.customerId,
          LIFECYCLE_SYSTEM_ACTOR_ID,
          correlationId,
          tx
        );
      });

      suspended += 1;

      const placeholders = await this.lifecycleMessaging.buildGraceReminderPlaceholders({
        firstName: policy.customer.firstName ?? '',
        productName: policy.productName ?? '',
        arrears,
        dueDate: nextDue,
      });
      const sent = await this.lifecycleMessaging.enqueueLifecycleNotification({
        policyId: policy.id,
        customerId: policy.customerId,
        scheduleKey: SUSPEND_SCHEDULE.D1,
        templateKey: SUSPEND_TEMPLATE.NOTICE,
        placeholderValues: placeholders,
        correlationId,
        metadata: { overdueDays: overdue, arrears },
      });
      if (sent) notificationsQueued += 1;
    }

    this.logger.log(`[${correlationId}] Suspend eval: suspended=${suspended} sms=${notificationsQueued}`);
    return { suspended, notificationsQueued };
  }

  /**
   * Suspended ≥30 days before end → Inactive.
   */
  async evaluateInactiveForSuspendedPolicies(
    asOfUtc: Date = new Date(),
    correlationId: string
  ): Promise<{ inactivated: number; notificationsQueued: number }> {
    const policies = await this.prisma.policy.findMany({
      where: {
        status: PolicyStatus.SUSPENDED,
        suspendedAt: { not: null },
      },
      select: {
        id: true,
        customerId: true,
        productName: true,
        endDate: true,
        suspendedAt: true,
        customer: { select: { firstName: true } },
      },
    });

    let inactivated = 0;
    let notificationsQueued = 0;

    for (const policy of policies) {
      if (!policy.suspendedAt) continue;
      if (isPolicyEndDatePassed(policy.endDate, asOfUtc)) continue;

      const daysSuspended = utcCalendarDaysBetween(policy.suspendedAt, asOfUtc);
      if (daysSuspended < 30) continue;

      await this.prisma.$transaction(async (tx) => {
        await this.statusChangeService.recordPolicyChange({
          customerId: policy.customerId,
          policyId: policy.id,
          fromStatus: PolicyStatus.SUSPENDED,
          toStatus: PolicyStatus.INACTIVE,
          reason: `Suspended ${daysSuspended} days; inactivated before end date`,
          trigger: StatusChangeTrigger.SYSTEM,
          changedBy: LIFECYCLE_SYSTEM_ACTOR_ID,
          correlationId,
          metadata: { daysSuspended },
          tx,
        });
        await tx.policy.update({
          where: { id: policy.id },
          data: {
            status: PolicyStatus.INACTIVE,
            inactivatedAt: asOfUtc,
            suspendedAt: null,
          },
        });
        await this.syncCustomerStatusAfterPolicyChange(
          policy.customerId,
          LIFECYCLE_SYSTEM_ACTOR_ID,
          correlationId,
          tx
        );
      });

      inactivated += 1;
      const placeholders = await this.lifecycleMessaging.buildPendingReminderPlaceholders({
        firstName: policy.customer.firstName ?? '',
        productName: policy.productName ?? '',
      });
      const sent = await this.lifecycleMessaging.enqueueLifecycleNotification({
        policyId: policy.id,
        customerId: policy.customerId,
        scheduleKey: 'INACTIVE_NOTICE',
        templateKey: 'policy_inactive',
        placeholderValues: placeholders,
        correlationId,
      });
      if (sent) notificationsQueued += 1;
    }

    this.logger.log(
      `[${correlationId}] Inactive eval: inactivated=${inactivated} sms=${notificationsQueued}`
    );
    return { inactivated, notificationsQueued };
  }

  /**
   * Term-end: Active/Grace → Expired; Inactive → Expired; Suspended unchanged.
   */
  async evaluateTermEndTransitions(
    asOfUtc: Date = new Date(),
    correlationId: string
  ): Promise<{ expired: number }> {
    const policies = await this.prisma.policy.findMany({
      where: {
        status: { in: [PolicyStatus.ACTIVE, PolicyStatus.INACTIVE] },
        endDate: { not: null, lte: asOfUtc },
      },
      select: {
        id: true,
        customerId: true,
        status: true,
        inGracePeriod: true,
        endDate: true,
      },
    });

    let expired = 0;
    for (const policy of policies) {
      if (!isPolicyEndDatePassed(policy.endDate, asOfUtc)) continue;

      await this.prisma.$transaction(async (tx) => {
        if (policy.inGracePeriod) {
          await this.statusChangeService.recordGraceExit({
            customerId: policy.customerId,
            policyId: policy.id,
            reason: 'Grace cleared at term end → Expired',
            trigger: StatusChangeTrigger.SYSTEM,
            changedBy: LIFECYCLE_SYSTEM_ACTOR_ID,
            correlationId,
            toStatus: PolicyStatus.EXPIRED,
            tx,
          });
        }
        await this.statusChangeService.recordPolicyChange({
          customerId: policy.customerId,
          policyId: policy.id,
          fromStatus: policy.status,
          toStatus: PolicyStatus.EXPIRED,
          reason: 'Policy end date passed',
          trigger: StatusChangeTrigger.SYSTEM,
          changedBy: LIFECYCLE_SYSTEM_ACTOR_ID,
          correlationId,
          tx,
        });
        await tx.policy.update({
          where: { id: policy.id },
          data: {
            status: PolicyStatus.EXPIRED,
            expiredAt: asOfUtc,
            inGracePeriod: false,
            graceEnteredAt: null,
            overdueAnchorDueDate: null,
          },
        });
        await this.syncCustomerStatusAfterPolicyChange(
          policy.customerId,
          LIFECYCLE_SYSTEM_ACTOR_ID,
          correlationId,
          tx
        );
      });
      expired += 1;
    }

    this.logger.log(`[${correlationId}] Term-end eval: expired=${expired}`);
    return { expired };
  }

  /**
   * Renewal reminder schedule points before/after expiry (ledger-deduped).
   * Before: 30/14/7/3 days and ~24h. After: 1/3/7/14/30 days.
   */
  async evaluateRenewalReminders(
    asOfUtc: Date = new Date(),
    correlationId: string
  ): Promise<number> {
    const policies = await this.prisma.policy.findMany({
      where: {
        endDate: { not: null },
        status: {
          in: [
            PolicyStatus.ACTIVE,
            PolicyStatus.SUSPENDED,
            PolicyStatus.INACTIVE,
            PolicyStatus.EXPIRED,
          ],
        },
      },
      select: {
        id: true,
        customerId: true,
        productName: true,
        endDate: true,
        status: true,
        customer: { select: { firstName: true } },
      },
    });

    const beforePoints = [
      { days: 30, key: 'RENEWAL_BEFORE_30', message: 'expires in 30 days' },
      { days: 14, key: 'RENEWAL_BEFORE_14', message: 'expires in 14 days' },
      { days: 7, key: 'RENEWAL_BEFORE_7', message: 'expires in 7 days' },
      { days: 3, key: 'RENEWAL_BEFORE_3', message: 'expires in 3 days' },
      { days: 1, key: 'RENEWAL_BEFORE_1', message: 'expires within 24 hours' },
    ];
    const afterPoints = [
      { days: 1, key: 'RENEWAL_AFTER_1', message: 'expired yesterday — renew now' },
      { days: 3, key: 'RENEWAL_AFTER_3', message: 'expired 3 days ago — renew now' },
      { days: 7, key: 'RENEWAL_AFTER_7', message: 'expired 7 days ago — renew now' },
      { days: 14, key: 'RENEWAL_AFTER_14', message: 'expired 14 days ago — renew now' },
      { days: 30, key: 'RENEWAL_AFTER_30', message: 'expired 30 days ago — renew now' },
    ];

    let queued = 0;
    for (const policy of policies) {
      if (!policy.endDate) continue;
      // Skip DEACTIVATED/TERMINATED via query; freeze Suspended past end for inactive only —
      // renewal reminders still allowed for Suspended/Expired past end.
      const daysToEnd = utcCalendarDaysBetween(asOfUtc, policy.endDate);
      const daysAfterEnd = utcCalendarDaysBetween(policy.endDate, asOfUtc);

      const settings = await this.systemSettingsPlaceholders(policy);

      if (daysToEnd >= 0) {
        for (const point of beforePoints) {
          if (daysToEnd === point.days) {
            const sent = await this.lifecycleMessaging.enqueueLifecycleNotification({
              policyId: policy.id,
              customerId: policy.customerId,
              scheduleKey: point.key,
              templateKey: 'renewal_reminder',
              placeholderValues: {
                ...settings,
                renewal_message: point.message,
              },
              correlationId,
              metadata: { daysToEnd },
            });
            if (sent) queued += 1;
          }
        }
      } else {
        for (const point of afterPoints) {
          if (daysAfterEnd === point.days) {
            const sent = await this.lifecycleMessaging.enqueueLifecycleNotification({
              policyId: policy.id,
              customerId: policy.customerId,
              scheduleKey: point.key,
              templateKey: 'renewal_reminder',
              placeholderValues: {
                ...settings,
                renewal_message: point.message,
              },
              correlationId,
              metadata: { daysAfterEnd },
            });
            if (sent) queued += 1;
          }
        }
      }
    }

    this.logger.log(`[${correlationId}] Renewal reminder eval: queued=${queued}`);
    return queued;
  }

  private async systemSettingsPlaceholders(policy: {
    customer: { firstName: string | null };
    productName: string;
  }): Promise<Record<string, string>> {
    return this.lifecycleMessaging.buildPendingReminderPlaceholders({
      firstName: policy.customer.firstName ?? '',
      productName: policy.productName ?? '',
    });
  }

  /**
   * Create a new Active renewal policy from a finished-cycle prior policy.
   */
  async renewPolicyFromPrior(
    priorPolicyId: string,
    paymentDate: Date,
    correlationId: string
  ): Promise<{ newPolicyId: string }> {
    const prior = await this.prisma.policy.findUniqueOrThrow({
      where: { id: priorPolicyId },
      include: { customer: { select: { firstName: true } } },
    });
    if (!prior.endDate) {
      throw ValidationException.forField('endDate', 'Prior policy must have an end date to renew');
    }

    const daysAfterEnd = utcCalendarDaysBetween(prior.endDate, paymentDate);
    const within30 = daysAfterEnd <= 30;
    const startDate = within30
      ? addUtcCalendarDays(prior.endDate, 1)
      : new Date(paymentDate);
    const endDate = policyEndDateFromStart(startDate);

    const newPolicy = await this.prisma.$transaction(async (tx) => {
      const paymentAcNumber = prior.paymentAcNumber;
      if (paymentAcNumber) {
        await tx.policy.update({
          where: { id: prior.id },
          data: { paymentAcNumber: null },
        });
      }

      const policyNumber = await this.policyService.generatePolicyNumberForPackage(
        prior.packageId,
        tx,
        correlationId
      );

      const created = await tx.policy.create({
        data: {
          customerId: prior.customerId,
          packageId: prior.packageId,
          packagePlanId: prior.packagePlanId,
          productName: prior.productName,
          premium: prior.premium,
          frequency: prior.frequency,
          paymentCadence: prior.paymentCadence,
          paymentAcNumber,
          policyNumber,
          status: PolicyStatus.ACTIVE,
          startDate,
          endDate,
          supersedesPolicyId: prior.id,
        },
      });

      await tx.policy.update({
        where: { id: prior.id },
        data: {
          supersededByPolicyId: created.id,
          ...(prior.status === PolicyStatus.SUSPENDED || prior.status === PolicyStatus.INACTIVE
            ? { status: PolicyStatus.EXPIRED, expiredAt: paymentDate, suspendedAt: null }
            : {}),
        },
      });

      if (prior.status === PolicyStatus.SUSPENDED || prior.status === PolicyStatus.INACTIVE) {
        await this.statusChangeService.recordPolicyChange({
          customerId: prior.customerId,
          policyId: prior.id,
          fromStatus: prior.status,
          toStatus: PolicyStatus.EXPIRED,
          reason: 'Prior policy expired on renewal after debt cleared',
          trigger: StatusChangeTrigger.PAYMENT_LIFECYCLE,
          changedBy: LIFECYCLE_SYSTEM_ACTOR_ID,
          correlationId,
          metadata: { newPolicyId: created.id },
          tx,
        });
      }

      await this.statusChangeService.recordPolicyChange({
        customerId: prior.customerId,
        policyId: created.id,
        fromStatus: PolicyStatus.PENDING_ACTIVATION,
        toStatus: PolicyStatus.ACTIVE,
        reason: within30
          ? 'Renewal within 30 days of expiry'
          : 'Renewal more than 30 days after expiry',
        trigger: StatusChangeTrigger.PAYMENT_LIFECYCLE,
        changedBy: LIFECYCLE_SYSTEM_ACTOR_ID,
        correlationId,
        metadata: {
          priorPolicyId: prior.id,
          within30,
          startDate: startDate.toISOString(),
        },
        tx,
      });

      await this.syncCustomerStatusAfterPolicyChange(
        prior.customerId,
        LIFECYCLE_SYSTEM_ACTOR_ID,
        correlationId,
        tx
      );

      return created;
    });

    // Activate member records if needed (reuse existing principal when present)
    try {
      await this.policyService.activatePolicy(newPolicy.id, correlationId);
    } catch (error) {
      this.logger.warn(
        `[${correlationId}] renewPolicyFromPrior activatePolicy note: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    return { newPolicyId: newPolicy.id };
  }

  /**
   * Payment-driven lifecycle: clear grace, restore Suspended/Inactive before end, or
   * expire Suspended when debt cleared after end (surplus renew deferred to US4).
   */
  async applyPaymentToPolicyLifecycle(
    policyId: string,
    correlationId: string,
    options?: { requireFullRestore?: boolean }
  ): Promise<{ action: string }> {
    const policy = await this.prisma.policy.findUnique({
      where: { id: policyId },
      include: {
        customer: { select: { firstName: true } },
        policyPayments: {
          where: notDetachedPaymentWhere(),
          select: {
            amount: true,
            paymentStatus: true,
            expectedPaymentDate: true,
          },
        },
      },
    });
    if (!policy || !policy.startDate) {
      return { action: 'noop' };
    }
    if (
      policy.status === PolicyStatus.DEACTIVATED ||
      policy.status === PolicyStatus.TERMINATED ||
      policy.status === PolicyStatus.PENDING_ACTIVATION
    ) {
      return { action: 'noop' };
    }

    const asOfUtc = new Date();
    const installmentAmount = Number(policy.premium);
    const paidThroughAsOf = this.paidThroughAsOf(
      policy.startDate,
      policy.policyPayments,
      asOfUtc
    );
    const arrears = outstandingArrears({
      policyStart: policy.startDate,
      paymentCadenceDays: policy.paymentCadence,
      installmentAmount,
      paidThroughAsOf,
      asOfUtc,
    });
    const endPassed = isPolicyEndDatePassed(policy.endDate, asOfUtc);

    // Active + grace: clear when current
    if (policy.status === PolicyStatus.ACTIVE && policy.inGracePeriod && arrears <= 0) {
      await this.clearGraceOverlay(
        policy,
        correlationId,
        StatusChangeTrigger.PAYMENT_LIFECYCLE,
        LIFECYCLE_SYSTEM_ACTOR_ID
      );
      return { action: 'grace_cleared' };
    }

    if (policy.status === PolicyStatus.SUSPENDED) {
      if (endPassed) {
        if (arrears <= 0) {
          await this.expirePolicyFromSuspended(policy, correlationId, asOfUtc);
          const surplus = this.estimatePostEndSurplus(
            policy,
            paidThroughAsOf,
            installmentAmount,
            asOfUtc
          );
          if (surplus > 0) {
            const { newPolicyId } = await this.renewPolicyFromPrior(
              policy.id,
              asOfUtc,
              correlationId
            );
            return { action: `expired_and_renewed:${newPolicyId}` };
          }
          return { action: 'expired_after_debt_cleared' };
        }
        return { action: 'debt_only_post_end' };
      }

      const required = amountRequiredToRestoreSuspended({
        paymentCadenceDays: policy.paymentCadence,
        installmentAmount,
        arrears,
      });
      const twoWeek = amountRequiredToRestoreSuspended({
        paymentCadenceDays: policy.paymentCadence,
        installmentAmount,
        arrears: 0,
      });
      const { expectedPremium } = computeExpectedPremiumThroughAsOf({
        policyStart: policy.startDate,
        statementGenerationUtc: asOfUtc,
        paymentCadenceDays: policy.paymentCadence,
        installmentAmount,
      });
      const coverageNeeded = expectedPremium + twoWeek;
      const canRestore = paidThroughAsOf >= coverageNeeded;

      if (!canRestore) {
        if (options?.requireFullRestore) {
          throw ValidationException.forField(
            'amount',
            `Insufficient payment to restore. Required at least ${required.toFixed(2)} (arrears + 2 weeks upfront)`
          );
        }
        return { action: 'insufficient_restore' };
      }

      await this.restorePolicyToActive(policy, correlationId, asOfUtc);
      return { action: 'restored_active' };
    }

    if (policy.status === PolicyStatus.INACTIVE) {
      if (endPassed) {
        await this.expirePolicyFromSuspended(
          { ...policy, status: PolicyStatus.INACTIVE },
          correlationId,
          asOfUtc
        );
        const surplus = this.estimatePostEndSurplus(
          policy,
          paidThroughAsOf,
          installmentAmount,
          asOfUtc
        );
        if (surplus > 0 || arrears <= 0) {
          const { newPolicyId } = await this.renewPolicyFromPrior(
            policy.id,
            asOfUtc,
            correlationId
          );
          return { action: `inactive_expired_renewed:${newPolicyId}` };
        }
        return { action: 'inactive_expired' };
      }

      const daysSinceInactive = policy.inactivatedAt
        ? utcCalendarDaysBetween(policy.inactivatedAt, asOfUtc)
        : 0;
      const required = amountRequiredToRestoreInactive({
        paymentCadenceDays: policy.paymentCadence,
        installmentAmount,
        arrears,
        daysSinceInactive,
      });
      const { expectedPremium } = computeExpectedPremiumThroughAsOf({
        policyStart: policy.startDate,
        statementGenerationUtc: asOfUtc,
        paymentCadenceDays: policy.paymentCadence,
        installmentAmount,
      });
      const oneMonth = amountRequiredToRestoreInactive({
        paymentCadenceDays: policy.paymentCadence,
        installmentAmount,
        arrears: 0,
        daysSinceInactive: 31,
      });
      const inactiveCanRestore =
        daysSinceInactive <= 30
          ? paidThroughAsOf >=
            expectedPremium +
              amountRequiredToRestoreSuspended({
                paymentCadenceDays: policy.paymentCadence,
                installmentAmount,
                arrears: 0,
              })
          : paidThroughAsOf >= oneMonth;

      if (!inactiveCanRestore) {
        if (options?.requireFullRestore) {
          throw ValidationException.forField(
            'amount',
            `Insufficient payment to restore inactive policy. Required at least ${required.toFixed(2)}`
          );
        }
        return { action: 'insufficient_inactive_restore' };
      }

      await this.restorePolicyToActive(policy, correlationId, asOfUtc);
      return { action: 'inactive_restored_active' };
    }

    if (policy.status === PolicyStatus.EXPIRED && endPassed) {
      const { newPolicyId } = await this.renewPolicyFromPrior(
        policy.id,
        asOfUtc,
        correlationId
      );
      return { action: `renewed_from_expired:${newPolicyId}` };
    }

    return { action: 'noop' };
  }

  /**
   * Re-evaluate a single policy after paid amount decreases (e.g. admin detach).
   * Applies the same overdue math as daily grace/suspend evaluators (can enter grace or suspend).
   */
  async recalculatePolicyLifecycleAfterPaidChange(
    policyId: string,
    correlationId: string
  ): Promise<{ action: string }> {
    const asOfUtc = new Date();
    const policy = await this.prisma.policy.findUnique({
      where: { id: policyId },
      select: {
        id: true,
        customerId: true,
        productName: true,
        premium: true,
        paymentCadence: true,
        startDate: true,
        endDate: true,
        status: true,
        inGracePeriod: true,
        overdueAnchorDueDate: true,
        customer: { select: { firstName: true } },
        policyPayments: {
          where: notDetachedPaymentWhere(),
          select: {
            amount: true,
            paymentStatus: true,
            expectedPaymentDate: true,
          },
        },
      },
    });

    if (!policy || !policy.startDate) {
      return { action: 'noop' };
    }
    if (policy.status !== PolicyStatus.ACTIVE) {
      return { action: 'noop' };
    }
    if (isPolicyEndDatePassed(policy.endDate, asOfUtc)) {
      return { action: 'noop' };
    }

    const installmentAmount = Number(policy.premium);
    if (policy.paymentCadence <= 0 || installmentAmount <= 0) {
      return { action: 'noop' };
    }

    const paidThroughAsOf = this.paidThroughAsOf(
      policy.startDate,
      policy.policyPayments,
      asOfUtc
    );
    const nextDue = nextUnpaidExpectedDueDate({
      policyStart: policy.startDate,
      paymentCadenceDays: policy.paymentCadence,
      installmentAmount,
      paidThroughAsOf,
      asOfUtc,
    });
    const overdue = daysOverdue({ nextUnpaidDueDate: nextDue, asOfUtc });
    const arrears = outstandingArrears({
      policyStart: policy.startDate,
      paymentCadenceDays: policy.paymentCadence,
      installmentAmount,
      paidThroughAsOf,
      asOfUtc,
    });

    if (overdue > 14) {
      await this.prisma.$transaction(async (tx) => {
        if (policy.inGracePeriod) {
          await this.statusChangeService.recordGraceExit({
            customerId: policy.customerId,
            policyId: policy.id,
            reason: 'Grace ended; suspending after payment detach (overdue >14 days)',
            trigger: StatusChangeTrigger.PAYMENT_LIFECYCLE,
            changedBy: LIFECYCLE_SYSTEM_ACTOR_ID,
            correlationId,
            toStatus: PolicyStatus.SUSPENDED,
            tx,
          });
        }

        await this.statusChangeService.recordPolicyChange({
          customerId: policy.customerId,
          policyId: policy.id,
          fromStatus: PolicyStatus.ACTIVE,
          toStatus: PolicyStatus.SUSPENDED,
          reason: `Premium overdue ${overdue} days after payment detach; suspended`,
          trigger: StatusChangeTrigger.PAYMENT_LIFECYCLE,
          changedBy: LIFECYCLE_SYSTEM_ACTOR_ID,
          correlationId,
          metadata: { overdueDays: overdue, arrears, anchorDueDate: nextDue.toISOString() },
          tx,
        });

        await tx.policy.update({
          where: { id: policy.id },
          data: {
            status: PolicyStatus.SUSPENDED,
            suspendedAt: asOfUtc,
            inGracePeriod: false,
            graceEnteredAt: null,
            overdueAnchorDueDate: null,
          },
        });

        await this.syncCustomerStatusAfterPolicyChange(
          policy.customerId,
          LIFECYCLE_SYSTEM_ACTOR_ID,
          correlationId,
          tx
        );
      });

      this.logger.log(
        `[${correlationId}] recalculate after paid change: policy ${policyId} suspended (overdue=${overdue})`
      );
      return { action: 'suspended' };
    }

    if (overdue < 1 || arrears <= 0) {
      if (policy.inGracePeriod) {
        await this.clearGraceOverlay(
          policy,
          correlationId,
          StatusChangeTrigger.PAYMENT_LIFECYCLE,
          LIFECYCLE_SYSTEM_ACTOR_ID
        );
        return { action: 'grace_cleared' };
      }
      return { action: 'noop' };
    }

    // Overdue 1–14 → ensure grace
    const entered = await this.ensureGraceOverlay({
      policy,
      nextDue,
      overdue,
      arrears,
      correlationId,
      asOfUtc,
    });
    // Patch grace enter trigger to PAYMENT_LIFECYCLE when entered via detach path:
    // ensureGraceOverlay always uses SYSTEM; for detach we already recorded via that helper.
    // Accept SYSTEM trigger for grace enter from this path for simplicity.
    return { action: entered ? 'grace_entered' : 'grace_updated' };
  }

  /** Approximate surplus after clearing post-end debt using latest confirmed payment. */
  private estimatePostEndSurplus(
    policy: {
      startDate: Date | null;
      paymentCadence: number;
      policyPayments: Array<{
        amount: unknown;
        paymentStatus: string;
        expectedPaymentDate: Date;
      }>;
    },
    paidThroughAsOf: number,
    installmentAmount: number,
    asOfUtc: Date
  ): number {
    if (!policy.startDate) return 0;
    const confirmed = policy.policyPayments
      .filter((p) => CONFIRMED_PAYMENT_STATUSES.includes(p.paymentStatus as PaymentStatus))
      .sort((a, b) => b.expectedPaymentDate.getTime() - a.expectedPaymentDate.getTime());
    if (confirmed.length === 0) return 0;
    const lastAmt = Number(confirmed[0].amount);
    const paidWithoutLast = Math.max(0, paidThroughAsOf - lastAmt);
    const arrearsWithoutLast = outstandingArrears({
      policyStart: policy.startDate,
      paymentCadenceDays: policy.paymentCadence,
      installmentAmount,
      paidThroughAsOf: paidWithoutLast,
      asOfUtc,
    });
    return Math.max(0, lastAmt - arrearsWithoutLast);
  }

  private paidThroughAsOf(
    startDate: Date,
    payments: Array<{ amount: unknown; paymentStatus: string; expectedPaymentDate: Date }>,
    asOfUtc: Date
  ): number {
    const policyStartDay = utcDayStart(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth(),
      startDate.getUTCDate()
    );
    const asOfEnd = utcDayEnd(
      asOfUtc.getUTCFullYear(),
      asOfUtc.getUTCMonth(),
      asOfUtc.getUTCDate()
    );
    return sumConfirmedPaidThroughAsOf(
      payments,
      policyStartDay,
      asOfEnd,
      CONFIRMED_PAYMENT_STATUSES
    );
  }

  private async restorePolicyToActive(
    policy: {
      id: string;
      customerId: string;
      status: PolicyStatus;
      endDate: Date | null;
      productName: string;
      customer: { firstName: string | null };
    },
    correlationId: string,
    asOfUtc: Date
  ): Promise<void> {
    assertPolicyMayBecomeActive(policy);

    await this.prisma.$transaction(async (tx) => {
      await this.statusChangeService.recordPolicyChange({
        customerId: policy.customerId,
        policyId: policy.id,
        fromStatus: policy.status,
        toStatus: PolicyStatus.ACTIVE,
        reason: 'Restored to Active after sufficient payment',
        trigger: StatusChangeTrigger.PAYMENT_LIFECYCLE,
        changedBy: LIFECYCLE_SYSTEM_ACTOR_ID,
        correlationId,
        tx,
      });

      await tx.policy.update({
        where: { id: policy.id },
        data: {
          status: PolicyStatus.ACTIVE,
          suspendedAt: null,
          inactivatedAt: null,
          inGracePeriod: false,
          graceEnteredAt: null,
          overdueAnchorDueDate: null,
          deactivatedAt: null,
        },
      });

      await this.syncCustomerStatusAfterPolicyChange(
        policy.customerId,
        LIFECYCLE_SYSTEM_ACTOR_ID,
        correlationId,
        tx
      );
    });

    const settings = await this.lifecycleMessaging.buildPendingReminderPlaceholders({
      firstName: policy.customer.firstName ?? '',
      productName: policy.productName ?? '',
    });
    await this.lifecycleMessaging.enqueueLifecycleNotification({
      policyId: policy.id,
      customerId: policy.customerId,
      scheduleKey: `REACTIVATE_${asOfUtc.toISOString().slice(0, 10)}`,
      templateKey: SUSPEND_TEMPLATE.REACTIVATE,
      placeholderValues: settings,
      correlationId,
    });
  }

  private async expirePolicyFromSuspended(
    policy: { id: string; customerId: string; status: PolicyStatus },
    correlationId: string,
    asOfUtc: Date
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.statusChangeService.recordPolicyChange({
        customerId: policy.customerId,
        policyId: policy.id,
        fromStatus: policy.status,
        toStatus: PolicyStatus.EXPIRED,
        reason: 'Suspended past end date; debt cleared → Expired',
        trigger: StatusChangeTrigger.PAYMENT_LIFECYCLE,
        changedBy: LIFECYCLE_SYSTEM_ACTOR_ID,
        correlationId,
        tx,
      });
      await tx.policy.update({
        where: { id: policy.id },
        data: {
          status: PolicyStatus.EXPIRED,
          expiredAt: asOfUtc,
          suspendedAt: null,
        },
      });
      await this.syncCustomerStatusAfterPolicyChange(
        policy.customerId,
        LIFECYCLE_SYSTEM_ACTOR_ID,
        correlationId,
        tx
      );
    });
  }

  private async syncCustomerStatusAfterPolicyChange(
    customerId: string,
    changedBy: string,
    correlationId: string,
    tx: Prisma.TransactionClient,
    options?: { whenNoOpenPolicies?: CustomerStatus }
  ): Promise<void> {
    const policies = await tx.policy.findMany({
      where: {
        customerId,
        status: {
          in: [
            PolicyStatus.ACTIVE,
            PolicyStatus.PENDING_ACTIVATION,
            PolicyStatus.SUSPENDED,
          ],
        },
      },
      select: { status: true },
    });

    const hasActive = policies.some((p) => p.status === PolicyStatus.ACTIVE);
    const hasPending = policies.some((p) => p.status === PolicyStatus.PENDING_ACTIVATION);
    const hasSuspended = policies.some((p) => p.status === PolicyStatus.SUSPENDED);

    const customer = await tx.customer.findUnique({ where: { id: customerId } });
    if (!customer) return;

    const closedStatus = options?.whenNoOpenPolicies ?? CustomerStatus.DEACTIVATED;

    let nextStatus: CustomerStatus | null = null;
    if (hasActive) {
      if (
        customer.status === CustomerStatus.DEACTIVATED ||
        customer.status === CustomerStatus.SUSPENDED ||
        customer.status === CustomerStatus.TERMINATED
      ) {
        nextStatus = CustomerStatus.ACTIVE;
      }
    } else if (hasPending) {
      if (customer.status !== CustomerStatus.PENDING_ACTIVATION) {
        nextStatus = CustomerStatus.PENDING_ACTIVATION;
      }
    } else if (hasSuspended) {
      if (customer.status !== CustomerStatus.SUSPENDED) {
        nextStatus = CustomerStatus.SUSPENDED;
      }
    } else {
      nextStatus = closedStatus;
    }

    if (nextStatus == null || nextStatus === customer.status) {
      return;
    }

    await this.statusChangeService.record({
      entityType: StatusChangeEntityType.CUSTOMER,
      customerId,
      fromStatus: customer.status,
      toStatus: nextStatus,
      reason: 'Automatic customer status update after policy change',
      trigger: StatusChangeTrigger.SYSTEM,
      changedBy,
      correlationId,
      tx,
    });

    await tx.customer.update({
      where: { id: customerId },
      data: {
        status: nextStatus,
        deactivatedAt:
          nextStatus === CustomerStatus.DEACTIVATED ||
          nextStatus === CustomerStatus.TERMINATED
            ? new Date()
            : null,
      },
    });
  }

  async terminatePolicy(
    customerId: string,
    policyId: string,
    dto: TerminatePolicyRequestDto,
    userId: string,
    userRoles: string[],
    correlationId: string
  ): Promise<PolicyLifecycleResponseDto> {
    this.assertAdmin(userRoles);
    const source = await this.loadPolicyForCustomer(customerId, policyId);

    if (source.status === PolicyStatus.TERMINATED) {
      throw ValidationException.forField('status', 'Policy is already terminated');
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.statusChangeService.recordPolicyChange({
        customerId,
        policyId,
        fromStatus: source.status,
        toStatus: PolicyStatus.TERMINATED,
        reason: dto.reason,
        trigger: StatusChangeTrigger.MANUAL_ADMIN,
        changedBy: userId,
        correlationId,
        metadata: { operation: 'TERMINATE' },
        tx,
      });

      const policy = await tx.policy.update({
        where: { id: policyId },
        data: {
          status: PolicyStatus.TERMINATED,
          inGracePeriod: false,
          graceEnteredAt: null,
          overdueAnchorDueDate: null,
          suspendedAt: null,
        },
      });

      await this.syncCustomerStatusAfterPolicyChange(
        customerId,
        userId,
        correlationId,
        tx,
        { whenNoOpenPolicies: CustomerStatus.TERMINATED }
      );
      return policy;
    });

    const placeholders = await this.lifecycleMessaging.buildPendingReminderPlaceholders({
      firstName: source.customer.firstName ?? '',
      productName: source.productName ?? '',
    });
    await this.lifecycleMessaging.enqueueLifecycleNotification({
      policyId,
      customerId,
      scheduleKey: `TERMINATE_${now.toISOString().slice(0, 10)}`,
      templateKey: 'policy_terminated',
      placeholderValues: placeholders,
      correlationId,
      metadata: { reason: dto.reason },
    });

    return {
      status: 200,
      correlationId,
      message: 'Policy terminated successfully',
      policy: {
        id: updated.id,
        policyNumber: updated.policyNumber,
        status: updated.status,
      },
    };
  }

  async deactivatePolicy(
    customerId: string,
    policyId: string,
    dto: DeactivatePolicyRequestDto,
    userId: string,
    userRoles: string[],
    correlationId: string
  ): Promise<PolicyLifecycleResponseDto> {
    this.assertAdmin(userRoles);
    const source = await this.loadPolicyForCustomer(customerId, policyId);
    this.assertCustomerNotTerminated(source.customer.status);

    if (
      source.status === PolicyStatus.DEACTIVATED ||
      source.status === PolicyStatus.TERMINATED
    ) {
      throw ValidationException.forField('status', 'Policy cannot be deactivated from this status');
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.statusChangeService.recordPolicyChange({
        customerId,
        policyId,
        fromStatus: source.status,
        toStatus: PolicyStatus.DEACTIVATED,
        reason: dto.reason,
        trigger: StatusChangeTrigger.MANUAL_ADMIN,
        changedBy: userId,
        correlationId,
        tx,
      });

      const policy = await tx.policy.update({
        where: { id: policyId },
        data: {
          status: PolicyStatus.DEACTIVATED,
          deactivatedAt: now,
          inGracePeriod: false,
          graceEnteredAt: null,
          overdueAnchorDueDate: null,
        },
      });

      await this.syncCustomerStatusAfterPolicyChange(customerId, userId, correlationId, tx);
      return policy;
    });

    return {
      status: 200,
      correlationId,
      message: 'Policy deactivated successfully',
      policy: {
        id: updated.id,
        policyNumber: updated.policyNumber,
        status: updated.status,
      },
    };
  }

  /**
   * One-off remediation: change policy status without the restore payment gate
   * (`paid >= expected + 2 weeks`). Always goes through EntityStatusChangeService → LCT.
   * Does not enqueue reactivation SMS.
   */
  async remediateStatusWithoutPaymentGate(params: {
    policyId: string;
    toStatus: typeof PolicyStatus.ACTIVE | typeof PolicyStatus.SUSPENDED;
    reason: string;
    correlationId: string;
    changedBy?: string;
  }): Promise<{ fromStatus: PolicyStatus; toStatus: PolicyStatus }> {
    const { policyId, toStatus, reason, correlationId } = params;
    const changedBy = params.changedBy ?? LIFECYCLE_SYSTEM_ACTOR_ID;
    const asOfUtc = new Date();

    const policy = await this.prisma.policy.findUnique({
      where: { id: policyId },
      select: {
        id: true,
        customerId: true,
        status: true,
        endDate: true,
      },
    });
    if (!policy) {
      throw ValidationException.forField('policyId', 'Policy not found');
    }

    if (policy.status === toStatus) {
      return { fromStatus: policy.status, toStatus };
    }

    if (toStatus === PolicyStatus.ACTIVE) {
      if (policy.status !== PolicyStatus.SUSPENDED) {
        throw ValidationException.forField(
          'status',
          `Remediate to ACTIVE only from SUSPENDED (was ${policy.status})`
        );
      }
      assertPolicyMayBecomeActive(policy);
    } else if (toStatus === PolicyStatus.SUSPENDED) {
      if (policy.status !== PolicyStatus.ACTIVE) {
        throw ValidationException.forField(
          'status',
          `Remediate to SUSPENDED only from ACTIVE (was ${policy.status})`
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await this.statusChangeService.recordPolicyChange({
        customerId: policy.customerId,
        policyId: policy.id,
        fromStatus: policy.status,
        toStatus,
        reason,
        trigger: StatusChangeTrigger.SYSTEM,
        changedBy,
        correlationId,
        metadata: { remediation: 'daily_premium_as_installment', noPaymentGate: true },
        tx,
      });

      await tx.policy.update({
        where: { id: policy.id },
        data:
          toStatus === PolicyStatus.ACTIVE
            ? {
                status: PolicyStatus.ACTIVE,
                suspendedAt: null,
                inactivatedAt: null,
                inGracePeriod: false,
                graceEnteredAt: null,
                overdueAnchorDueDate: null,
                deactivatedAt: null,
              }
            : {
                status: PolicyStatus.SUSPENDED,
                suspendedAt: asOfUtc,
                inGracePeriod: false,
                graceEnteredAt: null,
                overdueAnchorDueDate: null,
              },
      });

      await this.syncCustomerStatusAfterPolicyChange(
        policy.customerId,
        changedBy,
        correlationId,
        tx
      );
    });

    return { fromStatus: policy.status, toStatus };
  }

  async activatePolicy(
    customerId: string,
    policyId: string,
    dto: ActivatePolicyRequestDto,
    userId: string,
    userRoles: string[],
    correlationId: string
  ): Promise<PolicyLifecycleResponseDto> {
    this.assertAdmin(userRoles);
    const source = await this.loadPolicyForCustomer(customerId, policyId);
    this.assertCustomerNotTerminated(source.customer.status);

    if (source.status !== PolicyStatus.SUSPENDED) {
      throw ValidationException.forField(
        'status',
        'Only suspended policies can be manually activated'
      );
    }

    this.assertPolicyMayBecomeActive(source);

    const asOfUtc = new Date();
    if (!source.startDate) {
      throw ValidationException.forField('startDate', 'Policy start date is required to activate');
    }
    const payments = await this.prisma.policyPayment.findMany({
      where: { policyId, ...notDetachedPaymentWhere() },
      select: { amount: true, paymentStatus: true, expectedPaymentDate: true },
    });
    const installmentAmount = Number(source.premium);
    const paidThroughAsOf = this.paidThroughAsOf(source.startDate, payments, asOfUtc);
    const arrears = outstandingArrears({
      policyStart: source.startDate,
      paymentCadenceDays: source.paymentCadence,
      installmentAmount,
      paidThroughAsOf,
      asOfUtc,
    });
    const twoWeek = amountRequiredToRestoreSuspended({
      paymentCadenceDays: source.paymentCadence,
      installmentAmount,
      arrears: 0,
    });
    const { expectedPremium } = computeExpectedPremiumThroughAsOf({
      policyStart: source.startDate,
      statementGenerationUtc: asOfUtc,
      paymentCadenceDays: source.paymentCadence,
      installmentAmount,
    });
    if (paidThroughAsOf < expectedPremium + twoWeek) {
      const required = amountRequiredToRestoreSuspended({
        paymentCadenceDays: source.paymentCadence,
        installmentAmount,
        arrears,
      });
      throw ValidationException.forField(
        'amount',
        `Insufficient payment to restore. Required at least ${required.toFixed(2)} (arrears + 2 weeks upfront)`
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.statusChangeService.recordPolicyChange({
        customerId,
        policyId,
        fromStatus: source.status,
        toStatus: PolicyStatus.ACTIVE,
        reason: dto.reason,
        trigger: StatusChangeTrigger.MANUAL_ADMIN,
        changedBy: userId,
        correlationId,
        tx,
      });

      const policy = await tx.policy.update({
        where: { id: policyId },
        data: {
          status: PolicyStatus.ACTIVE,
          deactivatedAt: null,
          suspendedAt: null,
          inGracePeriod: false,
          graceEnteredAt: null,
          overdueAnchorDueDate: null,
        },
      });

      await this.syncCustomerStatusAfterPolicyChange(customerId, userId, correlationId, tx);
      return policy;
    });

    return {
      status: 200,
      correlationId,
      message: 'Policy activated successfully',
      policy: {
        id: updated.id,
        policyNumber: updated.policyNumber,
        status: updated.status,
      },
    };
  }

  async resetPolicyStartDate(
    customerId: string,
    policyId: string,
    dto: ResetPolicyStartDateRequestDto,
    userId: string,
    userRoles: string[],
    correlationId: string
  ): Promise<PolicyLifecycleResponseDto> {
    this.assertAdmin(userRoles);
    const source = await this.loadPolicyForCustomer(customerId, policyId);
    this.assertCustomerNotTerminated(source.customer.status);

    if (source.status !== PolicyStatus.ACTIVE && source.status !== PolicyStatus.SUSPENDED) {
      throw ValidationException.forField(
        'status',
        'Reset start date is only allowed for active or suspended policies'
      );
    }

    const newStart = new Date(dto.startDate);
    if (Number.isNaN(newStart.getTime())) {
      throw ValidationException.forField('startDate', 'Invalid start date');
    }

    const newEnd = policyEndDateFromStart(newStart);

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.statusChangeService.recordPolicyChange({
        customerId,
        policyId,
        fromStatus: source.status,
        toStatus: source.status,
        reason: dto.reason,
        trigger: StatusChangeTrigger.MANUAL_ADMIN,
        changedBy: userId,
        correlationId,
        metadata: {
          operation: 'RESET_START_DATE',
          previousStartDate: source.startDate?.toISOString() ?? null,
          newStartDate: newStart.toISOString(),
          previousEndDate: source.endDate?.toISOString() ?? null,
          newEndDate: newEnd.toISOString(),
        },
        tx,
      });

      return tx.policy.update({
        where: { id: policyId },
        data: { startDate: newStart, endDate: newEnd },
      });
    });

    return {
      status: 200,
      correlationId,
      message: 'Policy start date reset successfully',
      policy: {
        id: updated.id,
        policyNumber: updated.policyNumber,
        status: updated.status,
      },
    };
  }

  async getModifyOptions(
    customerId: string,
    policyId: string,
    userRoles: string[],
    correlationId: string
  ): Promise<ModifyPolicyOptionsResponseDto> {
    this.assertAdmin(userRoles);
    const policy = await this.loadPolicyForCustomer(customerId, policyId);

    if (
      policy.status !== PolicyStatus.ACTIVE &&
      policy.status !== PolicyStatus.PENDING_ACTIVATION &&
      policy.status !== PolicyStatus.SUSPENDED
    ) {
      throw ValidationException.forField('status', 'Policy is not eligible for modify');
    }

    const dependants = await this.prisma.dependant.findMany({
      where: { customerId, deletedAt: null },
    });
    const familyCategory = deriveFamilyCategoryFromDependants(dependants);
    const additionalSpouse = hasAdditionalSpousePremium(familyCategory, dependants);

    const completedPayments = await this.prisma.policyPayment.findMany({
      where: {
        policyId,
        ...confirmedActivePaymentWhere(),
        actualPaymentDate: { not: null },
      },
      orderBy: { expectedPaymentDate: 'asc' },
      include: { postpaidSchemePaymentItem: { select: { id: true } } },
    });

    const hasPostpaidLinks = completedPayments.some((p) => p.postpaidSchemePaymentItem != null);
    const paymentMigrationAllowed = !hasPostpaidLinks && completedPayments.length > 0;

    const schemeCustomer = await this.prisma.packageSchemeCustomer.findFirst({
      where: {
        customerId,
        packageScheme: { packageId: policy.packageId },
      },
      select: { packageSchemeId: true },
    });

    const packageSchemes = await this.prisma.packageScheme.findMany({
      where: { packageId: policy.packageId },
      include: { scheme: { select: { schemeName: true, isPostpaid: true } } },
    });

    return {
      status: 200,
      correlationId,
      message: 'Modify options retrieved successfully',
      packageId: policy.packageId,
      packageName: policy.package.name,
      familyCategory,
      additionalSpouse,
      currentPackagePlanId: policy.packagePlanId ?? 0,
      currentPlanName: policy.packagePlan?.name,
      currentPremium: Number(policy.premium),
      currentFrequency: policy.frequency,
      currentPaymentCadence: policy.paymentCadence,
      currentPackageSchemeId: schemeCustomer?.packageSchemeId ?? null,
      paymentMigrationAllowed,
      eligiblePayments: completedPayments.map((p) => ({
        id: p.id,
        transactionReference: p.transactionReference,
        amount: Number(p.amount),
        expectedPaymentDate: p.expectedPaymentDate.toISOString(),
        actualPaymentDate: p.actualPaymentDate?.toISOString(),
        paymentStatus: p.paymentStatus,
      })),
      schemes: packageSchemes.map((ps) => ({
        packageSchemeId: ps.id,
        schemeName: ps.scheme.schemeName,
        isPostpaid: ps.scheme.isPostpaid,
      })),
    };
  }

  async modifyPolicy(
    customerId: string,
    policyId: string,
    dto: ModifyPolicyRequestDto,
    userId: string,
    userRoles: string[],
    correlationId: string
  ): Promise<PolicyLifecycleResponseDto> {
    this.assertAdmin(userRoles);
    const source = await this.loadPolicyForCustomer(customerId, policyId);
    this.assertCustomerNotTerminated(source.customer.status);

    if (
      source.status !== PolicyStatus.ACTIVE &&
      source.status !== PolicyStatus.PENDING_ACTIVATION &&
      source.status !== PolicyStatus.SUSPENDED
    ) {
      throw ValidationException.forField('status', 'Policy is not eligible for modify');
    }

    const validationErrors: Record<string, string> = {};
    if (dto.frequency === PaymentFrequency.CUSTOM && (!dto.customDays || dto.customDays <= 0)) {
      validationErrors['customDays'] = 'Custom days required for CUSTOM frequency';
    }
    if (Object.keys(validationErrors).length > 0) {
      throw ValidationException.withMultipleErrors(validationErrors);
    }

    const plan = await this.prisma.packagePlan.findFirst({
      where: { id: dto.packagePlanId, packageId: source.packageId },
    });
    if (!plan) {
      throw ValidationException.forField('packagePlanId', 'Plan not found for this package');
    }

    const paymentCadence = this.calculatePaymentCadence(dto.frequency, dto.customDays);

    const completedPayments = await this.prisma.policyPayment.findMany({
      where: {
        policyId,
        ...confirmedActivePaymentWhere(),
        actualPaymentDate: { not: null },
      },
      orderBy: { expectedPaymentDate: 'asc' },
      include: { postpaidSchemePaymentItem: { select: { id: true } } },
    });

    const hasPostpaidLinks = completedPayments.some((p) => p.postpaidSchemePaymentItem != null);
    const wantsMigration = completedPayments.length > 0;

    if (wantsMigration && hasPostpaidLinks) {
      throw ValidationException.forField(
        'firstPaymentId',
        'Cannot migrate postpaid bulk-linked payments'
      );
    }

    let paymentsToMove: typeof completedPayments = [];
    if (wantsMigration) {
      if (dto.firstPaymentId == null) {
        throw ValidationException.forField(
          'firstPaymentId',
          'First payment to migrate is required'
        );
      }
      const firstIdx = completedPayments.findIndex((p) => p.id === dto.firstPaymentId);
      if (firstIdx < 0) {
        throw ValidationException.forField('firstPaymentId', 'Payment not found on this policy');
      }
      paymentsToMove = completedPayments.slice(firstIdx);
    }

    if (dto.packageSchemeId != null) {
      const scheme = await this.prisma.packageScheme.findFirst({
        where: { id: dto.packageSchemeId, packageId: source.packageId },
        include: { scheme: { select: { isPostpaid: true } } },
      });
      if (!scheme) {
        throw ValidationException.forField('packageSchemeId', 'Scheme must belong to same package');
      }
      const currentPsc = await this.prisma.packageSchemeCustomer.findFirst({
        where: { customerId, packageScheme: { packageId: source.packageId } },
        include: { packageScheme: { include: { scheme: { select: { isPostpaid: true } } } } },
      });
      if (
        currentPsc?.packageScheme?.scheme?.isPostpaid === true &&
        scheme.scheme.isPostpaid === false
      ) {
        throw ValidationException.forField(
          'packageSchemeId',
          'Changing from postpaid to prepaid scheme is not supported'
        );
      }
    }

    const productName = `${source.package.name} ${plan.name}`;
    const paymentAcNumber = source.paymentAcNumber;
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      let releasedPolicyNumber: string | null = null;
      let sourcePolicyNumberAfterDeactivate: string | null | undefined = source.policyNumber;

      if (
        dto.policyNumberChoice === PolicyNumberChoice.KEEP_EXISTING &&
        source.policyNumber
      ) {
        releasedPolicyNumber = getBasePolicyNumber(source.policyNumber);
        const existingNumbers = await tx.policy.findMany({
          where: { policyNumber: { not: null } },
          select: { policyNumber: true },
        });
        sourcePolicyNumberAfterDeactivate = nextDisabledPolicyNumber(
          source.policyNumber,
          existingNumbers.map((row) => row.policyNumber)
        );
      }

      // Deactivate source
      await this.statusChangeService.recordPolicyChange({
        customerId,
        policyId,
        fromStatus: source.status,
        toStatus: PolicyStatus.DEACTIVATED,
        reason: dto.reason,
        trigger: StatusChangeTrigger.MODIFY_PRODUCT,
        changedBy: userId,
        correlationId,
        tx,
      });

      await tx.policy.update({
        where: { id: policyId },
        data: {
          status: PolicyStatus.DEACTIVATED,
          deactivatedAt: now,
          paymentAcNumber: null,
          ...(sourcePolicyNumberAfterDeactivate !== source.policyNumber
            ? { policyNumber: sourcePolicyNumberAfterDeactivate }
            : {}),
        },
      });

      await this.syncCustomerStatusAfterPolicyChange(customerId, userId, correlationId, tx);

      let policyNumber: string | null = source.policyNumber;
      if (dto.policyNumberChoice === PolicyNumberChoice.GENERATE_NEW) {
        policyNumber = await this.policyService.generatePolicyNumberForPackage(
          source.packageId,
          tx,
          correlationId
        );
      } else if (dto.policyNumberChoice === PolicyNumberChoice.KEEP_EXISTING) {
        policyNumber = releasedPolicyNumber;
      }

      const newPolicy = await tx.policy.create({
        data: {
          customerId,
          packageId: source.packageId,
          packagePlanId: dto.packagePlanId,
          productName,
          premium: dto.premium,
          frequency: dto.frequency,
          paymentCadence,
          paymentAcNumber,
          policyNumber,
          status: PolicyStatus.PENDING_ACTIVATION,
          supersedesPolicyId: policyId,
          startDate: null,
          endDate: null,
        },
      });

      await tx.policy.update({
        where: { id: policyId },
        data: { supersededByPolicyId: newPolicy.id },
      });

      if (dto.packageSchemeId != null) {
        await tx.packageSchemeCustomer.updateMany({
          where: { customerId, packageScheme: { packageId: source.packageId } },
          data: { packageSchemeId: dto.packageSchemeId },
        });
      }

      let placeholdersBackfilledCount = 0;

      if (dto.policyNumberChoice === PolicyNumberChoice.KEEP_EXISTING) {
        // Same member numbers move with the policy before activation; clear LCT pending from deactivate.
        await tx.policyMemberPrincipal.updateMany({
          where: { policyId },
          data: { policyId: newPolicy.id },
        });
        await tx.policyMemberDependant.updateMany({
          where: { policyId },
          data: { policyId: newPolicy.id },
        });
        await tx.lctMemberSyncTarget.updateMany({
          where: { policyId },
          data: {
            policyId: newPolicy.id,
            pendingAction: null,
            pendingReasons: [],
            pendingSince: null,
          },
        });
      }

      if (paymentsToMove.length > 0) {
        const paymentIds = paymentsToMove.map((p) => p.id);
        await tx.policyPayment.updateMany({
          where: { id: { in: paymentIds } },
          data: { policyId: newPolicy.id },
        });

        const firstPayment = paymentsToMove[0];
        const anchor = firstPayment.actualPaymentDate ?? firstPayment.expectedPaymentDate;
        const { startDate, endDate } = policyDatesFromPayment(anchor);

        await tx.policy.update({
          where: { id: newPolicy.id },
          data: { startDate, endDate },
        });

        await this.policyService.activatePolicy(newPolicy.id, correlationId, tx);

        const allPayments = await tx.policyPayment.findMany({
          where: { policyId: newPolicy.id, ...notDetachedPaymentWhere() },
        });

        placeholdersBackfilledCount = await this.backfillOutstandingInstallments(
          newPolicy.id,
          Number(dto.premium),
          paymentCadence,
          startDate,
          endDate,
          allPayments,
          tx
        );
      }

      const finalPolicy = await tx.policy.findUniqueOrThrow({ where: { id: newPolicy.id } });

      await this.statusChangeService.recordPolicyChange({
        customerId,
        policyId: newPolicy.id,
        fromStatus: PolicyStatus.PENDING_ACTIVATION,
        toStatus: finalPolicy.status,
        reason: dto.reason,
        trigger: StatusChangeTrigger.MODIFY_PRODUCT,
        changedBy: userId,
        correlationId,
        metadata: {
          operation: 'MODIFY_PRODUCT',
          sourcePolicyId: policyId,
          newPolicyId: newPolicy.id,
          firstPaymentId: dto.firstPaymentId ?? null,
          paymentsMovedCount: paymentsToMove.length,
          placeholdersBackfilledCount,
          planBefore: source.packagePlan?.name ?? null,
          planAfter: plan.name,
          packagePlanIdBefore: source.packagePlanId,
          packagePlanIdAfter: dto.packagePlanId,
          frequencyBefore: source.frequency,
          frequencyAfter: dto.frequency,
          cadenceBefore: source.paymentCadence,
          cadenceAfter: paymentCadence,
          premiumBefore: source.premium.toString(),
          premiumAfter: dto.premium.toString(),
          policyNumberChoice: dto.policyNumberChoice,
        },
        tx,
      });

      await this.syncCustomerStatusAfterPolicyChange(customerId, userId, correlationId, tx);

      if (dto.policyNumberChoice === PolicyNumberChoice.KEEP_EXISTING) {
        // Renewal/keep: same member numbers must not create an LCT message
        await tx.lctMemberSyncTarget.updateMany({
          where: { policyId: newPolicy.id },
          data: {
            pendingAction: null,
            pendingReasons: [],
            pendingSince: null,
          },
        });
      }

      return finalPolicy;
    });

    if (dto.policyNumberChoice === PolicyNumberChoice.GENERATE_NEW) {
      await this.lctSyncService.onPolicyReplaced({
        oldPolicyId: policyId,
        newPolicyId: result.id,
        correlationId,
      });
    }

    return {
      status: 200,
      correlationId,
      message: 'Policy modified successfully',
      policy: {
        id: result.id,
        policyNumber: result.policyNumber,
        status: result.status,
      },
      newPolicyId: result.id,
    };
  }

  private async backfillOutstandingInstallments(
    policyId: string,
    premium: number,
    paymentCadence: number,
    startDate: Date,
    endDate: Date,
    existingPayments: Array<{
      id: number;
      expectedPaymentDate: Date;
      actualPaymentDate: Date | null;
      paymentStatus: PaymentStatus;
    }>,
    tx: Prisma.TransactionClient
  ): Promise<number> {
    const slots = computeInstallmentBackfillSlots({
      policyId,
      startDate,
      endDate,
      paymentCadence,
      premium,
      existingPayments,
    });

    for (const slot of slots) {
      await tx.policyPayment.create({
        data: {
          policyId,
          paymentType: PaymentType.MPESA,
          transactionReference: buildOutstandingTransactionReference(
            policyId,
            slot.periodIndex
          ),
          amount: premium,
          expectedPaymentDate: slot.slotStart,
          actualPaymentDate: null,
          paymentStatus: PaymentStatus.OUTSTANDING,
        },
      });
    }

    return slots.length;
  }
}
