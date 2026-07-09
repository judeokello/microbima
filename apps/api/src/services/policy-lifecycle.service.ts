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
  buildOutstandingTransactionReference,
  computeInstallmentBackfillSlots,
} from '../utils/installment-backfill.util';
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
} from '../dto/policy-lifecycle/policy-lifecycle.dto';

const CONFIRMED_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.COMPLETED,
  PaymentStatus.COMPLETED_PENDING_RECEIPT,
];

const ADMIN_ROLE = 'registration_admin';

@Injectable()
export class PolicyLifecycleService {
  private readonly logger = new Logger(PolicyLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly statusChangeService: EntityStatusChangeService,
    private readonly policyService: PolicyService
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
        customer: { select: { id: true, status: true } },
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

  private async syncCustomerStatusAfterPolicyChange(
    customerId: string,
    changedBy: string,
    correlationId: string,
    tx: Prisma.TransactionClient
  ): Promise<void> {
    const policies = await tx.policy.findMany({
      where: {
        customerId,
        status: { notIn: [PolicyStatus.DEACTIVATED, PolicyStatus.TERMINATED, PolicyStatus.EXPIRED] },
      },
      select: { status: true },
    });

    const hasActive = policies.some((p) => p.status === PolicyStatus.ACTIVE);
    const hasPending = policies.some((p) => p.status === PolicyStatus.PENDING_ACTIVATION);

    const customer = await tx.customer.findUnique({ where: { id: customerId } });
    if (!customer) return;

    let nextStatus: CustomerStatus | null = null;
    if (hasActive) {
      if (
        customer.status === CustomerStatus.DEACTIVATED ||
        customer.status === CustomerStatus.SUSPENDED
      ) {
        nextStatus = CustomerStatus.ACTIVE;
      }
    } else if (hasPending) {
      if (customer.status !== CustomerStatus.PENDING_ACTIVATION) {
        nextStatus = CustomerStatus.PENDING_ACTIVATION;
      }
    } else {
      nextStatus = CustomerStatus.DEACTIVATED;
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
        deactivatedAt: nextStatus === CustomerStatus.DEACTIVATED ? new Date() : null,
      },
    });
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
      await this.statusChangeService.record({
        entityType: StatusChangeEntityType.POLICY,
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
        data: { status: PolicyStatus.DEACTIVATED, deactivatedAt: now },
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

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.statusChangeService.record({
        entityType: StatusChangeEntityType.POLICY,
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
        data: { status: PolicyStatus.ACTIVE, deactivatedAt: null },
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
      await this.statusChangeService.record({
        entityType: StatusChangeEntityType.POLICY,
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
      policy.status !== PolicyStatus.PENDING_ACTIVATION
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
        paymentStatus: { in: CONFIRMED_PAYMENT_STATUSES },
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
      source.status !== PolicyStatus.PENDING_ACTIVATION
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
        paymentStatus: { in: CONFIRMED_PAYMENT_STATUSES },
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
      // Deactivate source
      await this.statusChangeService.record({
        entityType: StatusChangeEntityType.POLICY,
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
        policyNumber = source.policyNumber;
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
          where: { policyId: newPolicy.id },
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

      await this.statusChangeService.record({
        entityType: StatusChangeEntityType.POLICY,
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

      return finalPolicy;
    });

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
