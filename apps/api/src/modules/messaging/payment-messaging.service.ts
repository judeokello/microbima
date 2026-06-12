import { Injectable, Logger } from '@nestjs/common';
import { PaymentStatus, PaymentType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagingService } from './messaging.service';
import { SystemSettingsService } from './settings/system-settings.service';
import {
  addUtcCalendarDays,
  formatPaymentType,
  formatSmsAmount,
  formatSmsDate,
} from '../../utils/sms-format.util';
import { isHashedMsisdn, normalizeMsisdnOrReturnRaw } from '../../utils/phone-number.util';

const SMS_ELIGIBLE_STATUSES: PaymentStatus[] = [
  PaymentStatus.COMPLETED,
  PaymentStatus.COMPLETED_PENDING_RECEIPT,
];

export interface MatchedPaymentSmsParams {
  policyPaymentId: number;
  wasPendingActivation: boolean;
  activationSucceeded: boolean;
  correlationId: string;
  messagingOverride?: { phone?: string; email?: string };
}

export interface UnmatchedPaymentSmsParams {
  firstName: string;
  lastName: string;
  phone: string;
  amount: number;
  paymentType: PaymentType;
  paymentReference: string;
  correlationId: string;
}

@Injectable()
export class PaymentMessagingService {
  private readonly logger = new Logger(PaymentMessagingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messagingService: MessagingService,
    private readonly systemSettings: SystemSettingsService,
  ) {}

  /**
   * Fire-and-forget wrapper; logs errors without throwing to callers.
   */
  notifyMatchedPaymentSmsAsync(params: MatchedPaymentSmsParams): void {
    this.tryEnqueueMatchedPaymentSms(params).catch((error) => {
      this.logger.warn(
        `[${params.correlationId}] Failed to enqueue matched payment SMS for policyPaymentId=${params.policyPaymentId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
  }

  notifyUnmatchedPaymentSmsAsync(params: UnmatchedPaymentSmsParams): void {
    this.tryEnqueueUnmatchedPaymentSms(params).catch((error) => {
      this.logger.warn(
        `[${params.correlationId}] Failed to enqueue unmatched payment SMS: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
  }

  async tryEnqueueMatchedPaymentSms(params: MatchedPaymentSmsParams): Promise<void> {
    const payment = await this.prisma.policyPayment.findUnique({
      where: { id: params.policyPaymentId },
      include: {
        policy: {
          include: {
            customer: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });

    if (!payment) {
      this.logger.warn(
        `[${params.correlationId}] Payment SMS skipped: policy payment ${params.policyPaymentId} not found`,
      );
      return;
    }

    if (payment.paymentSmsEnqueuedAt) {
      return;
    }

    if (!SMS_ELIGIBLE_STATUSES.includes(payment.paymentStatus)) {
      return;
    }

    if (params.wasPendingActivation && !params.activationSucceeded) {
      return;
    }

    const settings = await this.systemSettings.getSnapshot();
    const templateKey = this.resolveMatchedTemplateKey(
      params.wasPendingActivation,
      params.activationSucceeded,
      payment.paymentStatus,
    );

    if (!templateKey) {
      return;
    }

    const policy = payment.policy;
    const isActivationTemplate = templateKey.includes('activation');

    const amount = formatSmsAmount(Number(payment.amount), settings.defaultSystemCurrency);
    const paymentType = formatPaymentType(payment.paymentType);
    const placeholderValues: Record<string, string> = {
      amount,
      payment_type: paymentType,
      product_name: policy.productName ?? '',
    };

    if (isActivationTemplate) {
      const waitingPeriodDays = await this.resolveSchemeWaitingPeriod(
        policy.customerId,
        policy.packageId,
      );
      if (waitingPeriodDays == null) {
        this.logger.warn(
          `[${params.correlationId}] Payment SMS skipped: no generalSchemeWaitingPeriod for customer ${policy.customerId} package ${policy.packageId}`,
        );
        return;
      }

      if (!policy.policyNumber || !policy.startDate) {
        this.logger.warn(
          `[${params.correlationId}] Activation payment SMS skipped: missing policyNumber or startDate on policy ${policy.id}`,
        );
        return;
      }
      placeholderValues.policy_number = policy.policyNumber;
      placeholderValues.scheme_waiting_period = String(waitingPeriodDays);
      placeholderValues.waiting_period_end_date = formatSmsDate(
        addUtcCalendarDays(policy.startDate, waitingPeriodDays),
      );
    }

    if (this.templateUsesPaymentReference(templateKey)) {
      placeholderValues.payment_reference = payment.transactionReference;
    }

    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.policyPayment.findUnique({
        where: { id: payment.id },
        select: { paymentSmsEnqueuedAt: true },
      });
      if (locked?.paymentSmsEnqueuedAt) {
        return;
      }

      await this.messagingService.enqueue({
        templateKey,
        customerId: policy.customerId,
        policyId: policy.id,
        placeholderValues,
        correlationId: params.correlationId,
        overrideRecipientPhone: params.messagingOverride?.phone ?? undefined,
        overrideRecipientEmail: params.messagingOverride?.email ?? undefined,
      });

      await tx.policyPayment.update({
        where: { id: payment.id },
        data: { paymentSmsEnqueuedAt: new Date() },
      });
    });

    this.logger.log(
      `[${params.correlationId}] Enqueued ${templateKey} for policyPaymentId=${payment.id}`,
    );
  }

  async tryEnqueueUnmatchedPaymentSms(params: UnmatchedPaymentSmsParams): Promise<void> {
    if (isHashedMsisdn(params.phone)) {
      this.logger.warn(
        `[${params.correlationId}] Unmatched payment SMS skipped: hashed MSISDN cannot be used as recipient`,
      );
      return;
    }

    let normalizedPhone: string;
    try {
      const msisdn = normalizeMsisdnOrReturnRaw(params.phone);
      if (!msisdn.normalized) {
        this.logger.warn(
          `[${params.correlationId}] Unmatched payment SMS skipped: non-normalizable phone`,
        );
        return;
      }
      normalizedPhone = msisdn.value;
    } catch {
      this.logger.warn(`[${params.correlationId}] Unmatched payment SMS skipped: invalid phone`);
      return;
    }

    const dedupeCorrelationId = `unmatched-ipn:${params.paymentReference}`;
    const existing = await this.prisma.messagingDelivery.findFirst({
      where: { correlationId: dedupeCorrelationId, templateKey: 'payment_received_unmatched' },
      select: { id: true },
    });
    if (existing) {
      return;
    }

    const settings = await this.systemSettings.getSnapshot();
    const amount = formatSmsAmount(params.amount, settings.defaultSystemCurrency);

    await this.messagingService.enqueue({
      templateKey: 'payment_received_unmatched',
      placeholderValues: {
        first_name: params.firstName.trim(),
        last_name: params.lastName.trim(),
        amount,
        payment_type: formatPaymentType(params.paymentType),
        payment_reference: params.paymentReference,
        general_support_number: settings.general_support_number,
      },
      correlationId: dedupeCorrelationId,
      overrideRecipientPhone: normalizedPhone,
    });

    this.logger.log(
      `[${params.correlationId}] Enqueued payment_received_unmatched for ref=${params.paymentReference}`,
    );
  }

  private resolveMatchedTemplateKey(
    wasPendingActivation: boolean,
    activationSucceeded: boolean,
    status: PaymentStatus,
  ): string | null {
    const pendingReceipt = status === PaymentStatus.COMPLETED_PENDING_RECEIPT;

    if (wasPendingActivation && activationSucceeded) {
      return pendingReceipt
        ? 'payment_received_activation_pending_receipt'
        : 'payment_received_activation';
    }

    if (!wasPendingActivation) {
      return pendingReceipt ? 'payment_received_pending_receipt' : 'payment_received';
    }

    return null;
  }

  private templateUsesPaymentReference(templateKey: string): boolean {
    return (
      templateKey === 'payment_received_activation' || templateKey === 'payment_received'
    );
  }

  private async resolveSchemeWaitingPeriod(
    customerId: string,
    packageId: number,
  ): Promise<number | null> {
    const link = await this.prisma.packageSchemeCustomer.findFirst({
      where: {
        customerId,
        packageScheme: { packageId },
      },
      include: {
        packageScheme: {
          select: { generalSchemeWaitingPeriod: true },
        },
      },
    });

    const days = link?.packageScheme?.generalSchemeWaitingPeriod;
    return days == null ? null : days;
  }
}
