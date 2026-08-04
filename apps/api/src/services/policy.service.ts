import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_CADENCE } from '../constants/payment-cadence.constants';
import { PaymentFrequency, PaymentType, Prisma, DependantRelationship } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import * as Sentry from '@sentry/nestjs';
import { PaymentAccountNumberService } from './payment-account-number.service';
import { PaymentMessagingService } from '../modules/messaging/payment-messaging.service';
import { PolicyLifecycleMessagingService } from '../modules/messaging/policy-lifecycle-messaging.service';
import { LctSyncService } from '../modules/lct/lct-sync.service';
import { policyDatesFromPayment, policyEndDateFromStart } from '../utils/policy-dates.util';
import { assertPolicyMayBecomeActive } from '../utils/policy-activation-gate.util';
import { hasGlobalCustomerAccess } from '../utils/roles.util';
import { notDetachedPaymentWhere } from '../utils/policy-payment-filters';
import { computeNominalPaymentPeriodEndDate } from '../utils/package-payment-frequency.util';
import { ValidationException } from '../exceptions/validation.exception';
import { ErrorCodes } from '../enums/error-codes.enum';

/**
 * Policy Service
 *
 * Handles policy-related business logic
 *
 * Features:
 * - Policy creation with policy number generation
 * - Policy payment creation
 * - Tag association with policies
 * - Transaction management for data consistency
 * - Messaging notifications integration (T018)
 */
@Injectable()
export class PolicyService {
  private readonly logger = new Logger(PolicyService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly paymentAccountNumberService: PaymentAccountNumberService,
    private readonly paymentMessagingService: PaymentMessagingService,
    private readonly lifecycleMessaging: PolicyLifecycleMessagingService,
    @Inject(forwardRef(() => LctSyncService))
    private readonly lctSyncService: LctSyncService,
  ) {}

  /**
   * Escape user-provided strings for safe RegExp construction
   */
  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Normalize account number for matching (trim, remove spaces).
   * Aligns with recovery SQL and MpesaPaymentsService.normalizeAccountNumber.
   */
  private normalizeAccountNumber(value: string | null | undefined): string {
    if (!value || typeof value !== 'string') return '';
    return value.trim().replace(/\s/g, '');
  }

  /**
   * Map unmapped mpesa_payment_report_items whose accountNumber matches paymentAcNumber
   * onto the given policy as COMPLETED policy_payments. Idempotent by transactionReference.
   * Used at registration (A) and recovery; also the shared helper for future reconcile (B).
   */
  async mapUnmappedMpesaItemsToPolicy(
    policyId: string,
    paymentAcNumber: string,
    correlationId: string,
    tx: Prisma.TransactionClient,
    options?: { activateIfPending?: boolean }
  ): Promise<{ mappedCount: number; activated: boolean; policyPaymentIds: number[] }> {
    const activateIfPending = options?.activateIfPending !== false;
    const normalized = this.normalizeAccountNumber(paymentAcNumber);
    if (!normalized) {
      this.logger.warn(
        `[${correlationId}] mapUnmappedMpesaItemsToPolicy: empty paymentAcNumber for policy ${policyId}`
      );
      return { mappedCount: 0, activated: false, policyPaymentIds: [] };
    }

    const items = await tx.$queryRaw<
      Array<{
        id: string;
        transactionReference: string;
        paidIn: number;
        completionTime: Date;
        accountNumber: string | null;
        isMapped: boolean;
        isProcessed: boolean;
      }>
    >`
      SELECT id, "transactionReference", "paidIn", "completionTime", "accountNumber",
             "isMapped", "isProcessed"
      FROM mpesa_payment_report_items
      WHERE "paidIn" > 0
        AND "transactionReference" IS NOT NULL
        AND "completionTime" IS NOT NULL
        AND REPLACE(TRIM(COALESCE("accountNumber", '')), ' ', '') = ${normalized}
      ORDER BY "completionTime" ASC
    `;

    if (items.length === 0) {
      return { mappedCount: 0, activated: false, policyPaymentIds: [] };
    }

    const seenRefs = new Set<string>();
    const uniqueItems = items.filter((item) => {
      if (seenRefs.has(item.transactionReference)) return false;
      seenRefs.add(item.transactionReference);
      return true;
    });

    const refs = uniqueItems.map((i) => i.transactionReference);
    const existingPayments = await tx.policyPayment.findMany({
      where: { transactionReference: { in: refs }, ...notDetachedPaymentWhere() },
      select: { transactionReference: true },
    });
    const existingRefs = new Set(existingPayments.map((p) => p.transactionReference));

    const policy = await tx.policy.findUnique({
      where: { id: policyId },
      select: { id: true, status: true },
    });
    if (!policy) {
      throw new NotFoundException(`Policy ${policyId} not found`);
    }

    let mappedCount = 0;
    const policyPaymentIds: number[] = [];
    const wasPendingActivation = policy.status === 'PENDING_ACTIVATION';

    for (const item of uniqueItems) {
      if (existingRefs.has(item.transactionReference)) {
        if (!item.isMapped || !item.isProcessed) {
          await tx.mpesaPaymentReportItem.update({
            where: { id: item.id },
            data: { isProcessed: true, isMapped: true },
          });
        }
        continue;
      }

      const created = await tx.policyPayment.create({
        data: {
          policyId,
          paymentType: 'MPESA',
          transactionReference: item.transactionReference,
          amount: Number(item.paidIn),
          accountNumber: item.accountNumber ?? null,
          expectedPaymentDate: item.completionTime,
          actualPaymentDate: item.completionTime,
          details: 'Mapped from historical M-Pesa payment',
          paymentStatus: 'COMPLETED',
        },
      });
      policyPaymentIds.push(created.id);
      existingRefs.add(item.transactionReference);
      mappedCount++;

      await tx.mpesaPaymentReportItem.update({
        where: { id: item.id },
        data: { isProcessed: true, isMapped: true },
      });
    }

    let activated = false;
    if (activateIfPending && wasPendingActivation && mappedCount > 0) {
      await this.activatePolicy(policyId, correlationId, tx);
      activated = true;
      this.logger.log(
        `[${correlationId}] Activated policy ${policyId} after mapping ${mappedCount} historical M-Pesa payment(s)`
      );
    } else if (mappedCount > 0) {
      this.logger.log(
        `[${correlationId}] Mapped ${mappedCount} historical M-Pesa payment(s) to policy ${policyId}`
      );
    }

    return { mappedCount, activated, policyPaymentIds };
  }

  /**
   * Ensure the caller may recover this customer: registration_admin and customer_care see all;
   * otherwise only the agent who registered the customer (customers.createdBy).
   */
  async assertRecoveryAccessToCustomer(
    customerId: string,
    userId: string,
    userRoles: string[],
    correlationId: string
  ): Promise<void> {
    if (hasGlobalCustomerAccess(userRoles)) {
      return;
    }
    const customer = await this.prismaService.customer.findUnique({
      where: { id: customerId },
      select: { id: true, createdBy: true },
    });
    if (!customer) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }
    if (customer.createdBy !== userId) {
      this.logger.warn(
        `[${correlationId}] Recovery access denied for user ${userId} on customer ${customerId}`
      );
      throw new ForbiddenException('You can only recover customers you registered');
    }
  }

  private async resolveRegisteredByDisplayNames(
    createdByIds: string[]
  ): Promise<Map<string, string>> {
    const uniqueIds = [...new Set(createdByIds.filter(Boolean))];
    const map = new Map<string, string>();
    if (uniqueIds.length === 0) return map;
    const ambassadors = await this.prismaService.brandAmbassador.findMany({
      where: { userId: { in: uniqueIds } },
      select: { userId: true, displayName: true },
    });
    for (const ba of ambassadors) {
      map.set(ba.userId, ba.displayName);
    }
    return map;
  }

  /**
   * Order dependants for member number assignment: spouses first (01, 02, ...), then others (e.g. children).
   * Used in policy activation and member number reconciliation.
   */
  orderDependantsForMemberNumbers<
    T extends { id: string; relationship: DependantRelationship }
  >(dependants: T[]): T[] {
    return [...dependants].sort((a, b) => {
      const aIsSpouse = a.relationship === 'SPOUSE' ? 1 : 0;
      const bIsSpouse = b.relationship === 'SPOUSE' ? 1 : 0;
      if (bIsSpouse !== aIsSpouse) return aIsSpouse - bIsSpouse; // Spouse first (1 before 0)
      return 0; // Stable order within same relationship
    });
  }

  /**
   * Generate policy number based on package format
   * @param packageId - Package ID
   * @param correlationId - Correlation ID for tracing
   * @returns Generated policy number
   * @deprecated Use generatePolicyNumberInTransaction for transaction-safe generation
   */
  private async generatePolicyNumber(
    packageId: number,
    correlationId: string
  ): Promise<string> {
    this.logger.log(`[${correlationId}] Generating policy number for package ${packageId}`);

    try {
      // Get package with policy number format
      const packageData = await this.prismaService.package.findUnique({
        where: { id: packageId },
        select: {
          id: true,
          policyNumberFormat: true,
        },
      });

      if (!packageData) {
        throw new NotFoundException(`Package with ID ${packageId} not found`);
      }

      if (!packageData.policyNumberFormat) {
        throw new BadRequestException(
          `Package ${packageId} does not have a policy number format configured`
        );
      }

      // Find the last policy for this package to get the current sequence number
      const lastPolicy = await this.prismaService.policy.findFirst({
        where: {
          packageId: packageId,
        },
        select: {
          policyNumber: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Extract the sequence number from the last policy number, or start at 1
      let digitWidth = 3;
      let sequenceNumber = 1;
      if (lastPolicy && lastPolicy.policyNumber) {
        // Extract numeric part from policy number (e.g., "MP/MFG/001" -> 1, "MP/MFG/1234" -> 1234)
        const format = packageData.policyNumberFormat;
        const placeholder = '{auto-increasing-policy-number}';

        if (format.includes(placeholder)) {
          // Try to extract number from last policy number using the format
          const [prefix, suffix = ''] = format.split(placeholder);
          const regex = new RegExp(
            `^${this.escapeRegExp(prefix)}(\\d+)${this.escapeRegExp(suffix)}$`
          );
          const lastMatch = lastPolicy.policyNumber.match(regex);

          if (lastMatch && lastMatch[1]) {
            sequenceNumber = parseInt(lastMatch[1], 10) + 1;
            digitWidth = lastMatch[1].length;
          }
        }
      }

      // Format sequence number with leading zeros (e.g., 001, 002, ..., 1234)
      const formattedSequence = sequenceNumber.toString().padStart(digitWidth, '0');

      // Replace placeholder in format
      const policyNumber = packageData.policyNumberFormat.replace(
        '{auto-increasing-policy-number}',
        formattedSequence
      );

      this.logger.log(
        `[${correlationId}] Generated policy number: ${policyNumber} (sequence: ${sequenceNumber})`
      );
      return policyNumber;
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error generating policy number: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Generate a unique policy number within a transaction using database-level sequence.
   * Uses policy_number_sequences table for atomic, race-condition-free generation.
   *
   * @param packageId - Package ID
   * @param tx - Prisma transaction client
   * @param correlationId - Correlation ID for tracing
   * @returns Generated unique policy number
   */
  private async generatePolicyNumberInTransaction(
    packageId: number,
    tx: Prisma.TransactionClient,
    correlationId: string
  ): Promise<string> {
    this.logger.log(`[${correlationId}] Generating policy number for package ${packageId} (sequence table)`);

    const packageData = await tx.package.findUnique({
      where: { id: packageId },
      select: {
        id: true,
        policyNumberFormat: true,
      },
    });

    if (!packageData) {
      throw new NotFoundException(`Package with ID ${packageId} not found`);
    }

    if (!packageData.policyNumberFormat) {
      throw new BadRequestException(
        `Package ${packageId} does not have a policy number format configured`
      );
    }

    const placeholder = '{auto-increasing-policy-number}';
    if (!packageData.policyNumberFormat.includes(placeholder)) {
      throw new BadRequestException(
        `Package ${packageId} policy number format does not contain the required placeholder: ${placeholder}`
      );
    }

    // Atomic increment using policy_number_sequences - inserts if not exists, increments if exists
    const result = await tx.$queryRaw<Array<{ lastSequence: number }>>`
      INSERT INTO policy_number_sequences ("packageId", "lastSequence")
      VALUES (${packageId}, 1)
      ON CONFLICT ("packageId") DO UPDATE
      SET "lastSequence" = policy_number_sequences."lastSequence" + 1
      RETURNING "lastSequence"
    `;

    const sequenceNumber = result[0]?.lastSequence ?? 1;
    const digitWidth = Math.max(3, sequenceNumber.toString().length);
    const formattedSequence = sequenceNumber.toString().padStart(digitWidth, '0');
    const policyNumber = packageData.policyNumberFormat.replace(
      placeholder,
      formattedSequence
    );

    this.logger.log(
      `[${correlationId}] ✓ Generated policy number "${policyNumber}" (sequence: ${sequenceNumber})`
    );
    return policyNumber;
  }

  /**
   * Public wrapper for transaction-safe policy number generation (e.g. modify-product).
   */
  async generatePolicyNumberForPackage(
    packageId: number,
    tx: Prisma.TransactionClient,
    correlationId: string
  ): Promise<string> {
    return this.generatePolicyNumberInTransaction(packageId, tx, correlationId);
  }

  /**
   * Resolve and validate expectedInstallmentCount for a package frequency.
   */
  async resolveExpectedInstallmentCount(
    packageId: number,
    frequency: PaymentFrequency,
    tx?: Prisma.TransactionClient
  ): Promise<number> {
    const client = tx ?? this.prismaService;
    const row = await client.packagePaymentFrequency.findUnique({
      where: {
        packageId_frequency: { packageId, frequency },
      },
      select: { installmentCount: true },
    });
    if (!row) {
      throw ValidationException.forField(
        'frequency',
        'Payment frequency is not supported for this package',
        ErrorCodes.VALIDATION_ERROR
      );
    }
    return row.installmentCount;
  }

  /**
   * Calculate payment cadence from frequency
   * @param frequency - Payment frequency
   * @param customDays - Custom days for CUSTOM frequency
   * @returns Payment cadence in days
   */
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

  /**
   * Create or get tags by IDs or names
   * @param tags - Array of tag objects with id (if exists) or name
   * @param correlationId - Correlation ID for tracing
   * @returns Array of tag IDs
   */
  private async createOrGetTags(tags: Array<{ id?: number; name: string }>): Promise<number[]> {
    if (!tags || tags.length === 0) {
      return [];
    }

    const tagIds: number[] = [];

    for (const tag of tags) {
      if (tag.id) {
        // Tag already exists, use its ID
        tagIds.push(tag.id);
      } else {
        // Create new tag or find existing one (case-insensitive)
        const existingTag = await this.prismaService.tag.findFirst({
          where: {
            name: {
              equals: tag.name.trim(),
              mode: 'insensitive',
            },
          },
        });

        if (existingTag) {
          tagIds.push(existingTag.id);
        } else {
          const newTag = await this.prismaService.tag.create({
            data: {
              name: tag.name.trim(),
            },
          });
          tagIds.push(newTag.id);
        }
      }
    }

    return tagIds;
  }

  /**
   * Create policy with payment and tags in a transaction
   * @param data - Policy creation data
   * @param correlationId - Correlation ID for tracing
   * @returns Created policy with payment
   */
  async createPolicyWithPayment(
    data: {
      customerId: string;
      packageId: number;
      packagePlanId: number;
      frequency: PaymentFrequency;
      premium: number;
      annualPremium?: number;
      productName: string;
      tags?: Array<{ id?: number; name: string }>;
      paymentData: {
        paymentType: PaymentType;
        transactionReference: string;
        amount: number;
        accountNumber?: string;
        details?: string;
        expectedPaymentDate: Date;
        actualPaymentDate?: Date;
        paymentMessageBlob?: string;
      };
      customDays?: number;
    },
    correlationId: string,
  ) {
    // Capitalize transaction reference to ensure consistency in database
    const capitalizedTransactionReference = data.paymentData.transactionReference.trim().toUpperCase();
    data.paymentData.transactionReference = capitalizedTransactionReference;
    // Idempotency check: Check if a policy payment already exists with this transaction reference
    // This prevents duplicate policy creation if the same request is submitted multiple times
    const existingPayment = await this.prismaService.policyPayment.findFirst({
      where: {
        transactionReference: data.paymentData.transactionReference,
        ...notDetachedPaymentWhere(),
      },
      include: {
        policy: {
          include: {
            policyPayments: {
              where: notDetachedPaymentWhere(),
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (existingPayment) {
      this.logger.log(
        `[${correlationId}] Policy payment with transaction reference ${data.paymentData.transactionReference} already exists. Returning existing policy ${existingPayment.policy.id}`
      );

      // Return the existing policy and payment
      return {
        policy: existingPayment.policy,
        policyPayment: existingPayment,
      };
    }
    this.logger.log(`[${correlationId}] Creating policy with payment for customer ${data.customerId}`);

    try {
      // Validate customer exists
      const customer = await this.prismaService.customer.findUnique({
        where: { id: data.customerId },
        select: { id: true, idNumber: true },
      });

      if (!customer) {
        throw new NotFoundException(`Customer with ID ${data.customerId} not found`);
      }

      // Validate package exists
      const packageData = await this.prismaService.package.findUnique({
        where: { id: data.packageId },
        include: {
          packagePlans: {
            where: { id: data.packagePlanId },
          },
        },
      });

      if (!packageData) {
        throw new NotFoundException(`Package with ID ${data.packageId} not found`);
      }

      if (packageData.packagePlans.length === 0) {
        throw new NotFoundException(
          `Package plan with ID ${data.packagePlanId} not found for package ${data.packageId}`
        );
      }

      // At most one non-terminal policy per customer per package
      const existingPolicyForPackage = await this.prismaService.policy.findFirst({
        where: {
          customerId: data.customerId,
          packageId: data.packageId,
          status: { in: ['ACTIVE', 'PENDING_ACTIVATION', 'SUSPENDED'] },
        },
      });
      if (existingPolicyForPackage) {
        throw new ConflictException(
          `Customer already has an active policy for this package (policy ID: ${existingPolicyForPackage.id})`
        );
      }

      // Resolve scheme by package: customer's scheme for this package (not just any scheme)
      const customerScheme = await this.prismaService.packageSchemeCustomer.findFirst({
        where: {
          customerId: data.customerId,
          packageScheme: { packageId: data.packageId },
        },
        include: {
          packageScheme: {
            include: {
              scheme: {
                select: {
                  isPostpaid: true,
                  frequency: true,
                  paymentCadence: true,
                },
              },
            },
          },
        },
      });

      const isPostpaidScheme = customerScheme?.packageScheme?.scheme?.isPostpaid ?? false;

      this.logger.log(
        `[${correlationId}] Customer ${data.customerId} is ${isPostpaidScheme ? 'in a POSTPAID' : 'NOT in a postpaid'} scheme`
      );

      // Use transaction to ensure atomicity
      this.logger.log(
        `[${correlationId}] Starting transaction to create policy: ` +
        `customerId=${data.customerId}, packageId=${data.packageId}, ` +
        `transactionReference=${data.paymentData.transactionReference}`
      );

      const result = await this.prismaService.$transaction(async (tx: Prisma.TransactionClient) => {
        // Double-check idempotency inside transaction to prevent race conditions
        this.logger.log(
          `[${correlationId}] Checking idempotency inside transaction for transactionReference: ${data.paymentData.transactionReference}`
        );

        const existingPaymentInTx = await tx.policyPayment.findFirst({
          where: {
            transactionReference: data.paymentData.transactionReference,
            ...notDetachedPaymentWhere(),
          },
          include: {
            policy: true,
          },
        });

        if (existingPaymentInTx) {
          this.logger.log(
            `[${correlationId}] ✓ Idempotency check: Policy payment with transaction reference ${data.paymentData.transactionReference} already exists ` +
            `(race condition detected). Returning existing policy ${existingPaymentInTx.policy.id} ` +
            `with policyNumber="${existingPaymentInTx.policy.policyNumber}"`
          );
          return {
            policy: existingPaymentInTx.policy,
            policyPayment: existingPaymentInTx,
          };
        }

        this.logger.log(
          `[${correlationId}] ✓ Idempotency check passed: No existing payment found for transactionReference ${data.paymentData.transactionReference}. Proceeding with policy creation.`
        );

        // Determine payment account number: first policy (any type) gets idNumber; subsequent get idNumber+letter
        const isFirstPolicy = !(await this.paymentAccountNumberService.customerHasExistingPolicies(
          data.customerId,
          tx,
          correlationId
        ));

        const paymentAcNumber = await this.paymentAccountNumberService.generateForPolicy(
          data.customerId,
          isFirstPolicy,
          tx,
          correlationId
        );

        this.logger.log(
          `[${correlationId}] Payment account number for ${isPostpaidScheme ? 'postpaid' : 'prepaid'} policy: ${paymentAcNumber} (first policy: ${isFirstPolicy})`
        );

        // Calculate payment cadence
        // For postpaid schemes, use scheme's frequency and cadence; for prepaid, use provided values
        let frequency = data.frequency;
        let paymentCadence = this.calculatePaymentCadence(data.frequency, data.customDays);

        if (isPostpaidScheme && customerScheme?.packageScheme?.scheme) {
          frequency = customerScheme.packageScheme.scheme.frequency ?? data.frequency;
          paymentCadence = customerScheme.packageScheme.scheme.paymentCadence ?? paymentCadence;
          this.logger.log(
            `[${correlationId}] Using scheme's payment settings - frequency: ${frequency}, cadence: ${paymentCadence}`
          );
        }

        const expectedInstallmentCount = await this.resolveExpectedInstallmentCount(
          data.packageId,
          frequency,
          tx
        );

        // For postpaid schemes: no policy number, null dates, PENDING_ACTIVATION
        // For prepaid schemes: generate policy number, set proper dates, will activate after creation
        let policyNumber: string | null;
        let startDate: Date | null;
        let endDate: Date | null;
        let status: 'PENDING_ACTIVATION' | 'ACTIVE';

        if (isPostpaidScheme) {
          // Postpaid: no policy number yet, null dates (will be set on activation)
          policyNumber = null; // Null, will be generated upon activation
          startDate = null; // Will be set on activation
          endDate = null; // Will be set on activation
          status = 'PENDING_ACTIVATION';
        } else {
          // Prepaid: generate policy number inside transaction to prevent race conditions
          // This ensures thread-safe policy number generation even under high concurrency
          // Dates are set to NULL and will only be set when policy is activated on first payment
          policyNumber = await this.generatePolicyNumberInTransaction(
            data.packageId,
            tx,
            correlationId
          );
          startDate = null; // Will be set on activation (first payment)
          endDate = null; // Will be set on activation (one year from startDate)
          status = 'PENDING_ACTIVATION'; // Will be updated to ACTIVE by activatePolicy when first payment completes
        }

        // Create policy
        // Note: For postpaid schemes, policyNumber is null until activation when policy numbers are assigned.
        this.logger.log(
          `[${correlationId}] Attempting to create policy with: ` +
          `policyNumber="${policyNumber ?? 'null'}", customerId=${data.customerId}, ` +
          `packageId=${data.packageId}, isPostpaid=${isPostpaidScheme}, ` +
          `status=${status}, startDate=${startDate}, endDate=${endDate}`
        );

        // Check for existing policies with same policy number before creation (additional safety check)
        if (policyNumber !== null) {
          const preCheckExisting = await tx.policy.findUnique({
            where: { policyNumber: policyNumber },
            select: { id: true, policyNumber: true, customerId: true, createdAt: true },
          });

          if (preCheckExisting) {
            this.logger.error(
              `[${correlationId}] CRITICAL: Policy number "${policyNumber}" exists before creation attempt! ` +
              `Existing policy: id=${preCheckExisting.id}, customerId=${preCheckExisting.customerId}, ` +
              `createdAt=${preCheckExisting.createdAt}`
            );
          }
        }

        let policy: Awaited<ReturnType<typeof tx.policy.create>>;
        try {
          policy = await tx.policy.create({
            data: {
              policyNumber: policyNumber ?? null,
              status,
              customerId: data.customerId,
              packageId: data.packageId,
              packagePlanId: data.packagePlanId,
              productName: data.productName,
              startDate: startDate ?? null,
              endDate: endDate ?? null,
              premium: data.premium,
              annualPremium: data.annualPremium ?? null,
              frequency,
              paymentCadence,
              expectedInstallmentCount,
              paymentAcNumber,
            },
          });

          this.logger.log(
            `[${correlationId}] ✓ Successfully created policy: id=${policy.id}, policyNumber="${policy.policyNumber}"`
          );
        } catch (createError: unknown) {
          // Handle unique constraint violation on policyNumber (race condition safety net)
          const isPrismaError = createError instanceof PrismaClientKnownRequestError;
          if (
            isPrismaError &&
            createError.code === 'P2002' &&
            createError.meta?.target &&
            Array.isArray(createError.meta.target) &&
            createError.meta.target.includes('policyNumber')
          ) {
            // Query for existing policy with this number to get full details
            let existingPolicyDetails = null;
            try {
              if (policyNumber === null) {
                throw new Error('Cannot query for policy with null policy number');
              }
              existingPolicyDetails = await tx.policy.findUnique({
                where: { policyNumber: policyNumber },
                select: {
                  id: true,
                  policyNumber: true,
                  customerId: true,
                  packageId: true,
                  status: true,
                  createdAt: true,
                  updatedAt: true,
                },
              });
            } catch (queryError) {
              this.logger.warn(
                `[${correlationId}] Could not query existing policy details: ${queryError instanceof Error ? queryError.message : 'Unknown error'}`
              );
            }

            // Also check for all policies with null/invalid policy numbers
            let emptyPolicyCount = 0;
            try {
              const emptyPolicies = await tx.policy.findMany({
                where: {
                  packageId: data.packageId,
                  OR: [
                    { policyNumber: null },
                    { policyNumber: '' },
                    { policyNumber: 'EMPTY' },
                  ],
                },
                select: { id: true, policyNumber: true, customerId: true, createdAt: true },
              });
              emptyPolicyCount = emptyPolicies.length;

              if (emptyPolicyCount > 0) {
                this.logger.warn(
                  `[${correlationId}] Found ${emptyPolicyCount} policies with null/invalid policy numbers for package ${data.packageId}: ` +
                  emptyPolicies.map(p => `id=${p.id}, policyNumber="${p.policyNumber ?? 'null'}", customerId=${p.customerId}`).join('; ')
                );
              }
            } catch {
              // Ignore query errors for this diagnostic query
            }

            this.logger.error(
              `[${correlationId}] ✗✗✗ UNIQUE CONSTRAINT VIOLATION on policyNumber "${policyNumber}" ✗✗✗\n` +
              `  Attempted to create policy for: customerId=${data.customerId}, packageId=${data.packageId}, isPostpaid=${isPostpaidScheme}\n` +
              `  Error code: ${isPrismaError ? createError.code : 'unknown'}, Target: ${JSON.stringify(isPrismaError && createError.meta?.target ? createError.meta.target : 'unknown')}\n` +
              (existingPolicyDetails
                ? `  Existing policy with this number: id=${existingPolicyDetails.id}, customerId=${existingPolicyDetails.customerId}, ` +
                  `packageId=${existingPolicyDetails.packageId}, status=${existingPolicyDetails.status}, ` +
                  `createdAt=${existingPolicyDetails.createdAt}, updatedAt=${existingPolicyDetails.updatedAt}\n`
                : '  Could not retrieve existing policy details\n') +
              `  Empty/invalid policy count for package: ${emptyPolicyCount}\n` +
              '  This indicates a race condition or data inconsistency. Retrying with new policy number...',
              createError instanceof Error ? createError.stack : undefined
            );

            // Report to Sentry with comprehensive context
            Sentry.captureException(createError, {
              tags: {
                service: 'PolicyService',
                operation: 'createPolicyWithPayment',
                correlationId,
                errorType: 'unique_constraint_violation',
                field: 'policyNumber',
                isPostpaidScheme: String(isPostpaidScheme),
              },
              extra: {
                attemptedPolicyNumber: policyNumber,
                packageId: data.packageId,
                customerId: data.customerId,
                isPostpaidScheme,
                environment: process.env.NODE_ENV,
                existingPolicyDetails,
                emptyPolicyCount,
                errorCode: isPrismaError ? createError.code : undefined,
                errorTarget: isPrismaError && createError.meta?.target ? (Array.isArray(createError.meta.target) ? createError.meta.target : [String(createError.meta.target)]) : undefined,
              },
            });

            // For prepaid schemes, retry with a new policy number
            if (!isPostpaidScheme) {
              policyNumber = await this.generatePolicyNumberInTransaction(
                data.packageId,
                tx,
                correlationId
              );

              // Retry policy creation with new policy number
              policy = await tx.policy.create({
                data: {
                  policyNumber: policyNumber ?? null,
                  status,
                  customerId: data.customerId,
                  packageId: data.packageId,
                  packagePlanId: data.packagePlanId,
                  productName: data.productName,
                  startDate: startDate ?? null,
                  endDate: endDate ?? null,
                  premium: data.premium,
                  annualPremium: data.annualPremium ?? null,
                  frequency,
                  paymentCadence,
                  expectedInstallmentCount,
                  paymentAcNumber,
                },
              });

              this.logger.log(
                `[${correlationId}] Successfully created policy with retried policy number: ${policyNumber}`
              );
            } else {
              // For postpaid schemes, this shouldn't happen as they use empty string
              // but if it does, rethrow the error
              throw createError;
            }
          } else {
            // Rethrow other errors
            throw createError;
          }
        }

        this.logger.log(
          `[${correlationId}] Created policy ${policy.id} (postpaid: ${isPostpaidScheme}, policy number: ${policyNumber ?? 'not assigned'})`
        );

        // Create or get tags and associate with policy
        if (data.tags && data.tags.length > 0) {
          const tagIds = await this.createOrGetTags(data.tags);
          await Promise.all(
            tagIds.map((tagId) =>
              tx.policyTag.create({
                data: {
                  policyId: policy.id,
                  tagId,
                },
              })
            )
          );
        }

        // Create policy payment. For PENDING-STK placeholders use customer.idNumber for accountNumber.
        const isPlaceholderStk =
          data.paymentData.transactionReference.trim().toUpperCase().startsWith('PENDING-STK-');
        const accountNumberForPayment = isPlaceholderStk
          ? customer.idNumber ?? null
          : data.paymentData.accountNumber ?? null;

        const policyPayment = await tx.policyPayment.create({
          data: {
            policyId: policy.id,
            paymentType: data.paymentData.paymentType,
            transactionReference: data.paymentData.transactionReference,
            amount: data.paymentData.amount,
            accountNumber: accountNumberForPayment,
            details: data.paymentData.details ?? null,
            expectedPaymentDate: data.paymentData.expectedPaymentDate,
            actualPaymentDate: data.paymentData.actualPaymentDate ?? null,
            paymentStatus: isPlaceholderStk ? 'PENDING_STK_CALLBACK' : 'COMPLETED',
            paymentMessageBlob: data.paymentData.paymentMessageBlob ?? null,
          },
        });

        // Dates stay NULL at insert; activatePolicy() sets them from the first completed payment
        // via policy-dates.util.ts (also creates member records and assigns policy number when needed).
        if (data.paymentData.actualPaymentDate) {
          const activatedPolicy = await this.activatePolicy(policy.id, correlationId, tx);
          policy = activatedPolicy;
          this.logger.log(
            `[${correlationId}] Activated policy ${policy.id} immediately (payment already completed)`
          );
        } else {
          this.logger.log(
            `[${correlationId}] Policy ${policy.id} created with PENDING_ACTIVATION status (will be activated when payment completes)`
          );
        }

        // A: backfill historical paybill payments (accountNumber == paymentAcNumber) onto this policy
        if (paymentAcNumber) {
          const mapped = await this.mapUnmappedMpesaItemsToPolicy(
            policy.id,
            paymentAcNumber,
            correlationId,
            tx,
            { activateIfPending: true }
          );
          if (mapped.activated) {
            policy = await tx.policy.findUniqueOrThrow({ where: { id: policy.id } });
          }
        }

        return {
          policy,
          policyPayment,
        };
      });

      this.logger.log(
        `[${correlationId}] Policy ${result.policy.id} created successfully with payment ${result.policyPayment.id}`
      );

      // Payment received SMS (activation when payment completed at registration)
      const paymentStatus = result.policyPayment.paymentStatus;
      if (
        paymentStatus === 'COMPLETED' ||
        paymentStatus === 'COMPLETED_PENDING_RECEIPT'
      ) {
        const wasPendingActivation = true;
        const activationSucceeded = result.policy.status === 'ACTIVE';
        this.paymentMessagingService.notifyMatchedPaymentSmsAsync({
          policyPaymentId: result.policyPayment.id,
          wasPendingActivation,
          activationSucceeded,
          correlationId,
        });
      }

      return result;
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error creating policy with payment: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      // Emit metric for policy creation failures
      try {
        Sentry.metrics.count('policy_creation_failed', 1, {
          attributes: {
            operation: 'createPolicyWithPayment',
            correlationId,
          },
        });
      } catch {
        // Ignore metric errors
      }
      throw error;
    }
  }

  /**
   * Check if a transaction reference already exists
   * @param transactionReference - Transaction reference to check
   * @param correlationId - Correlation ID for tracing
   * @returns True if transaction reference exists, false otherwise
   */
  async checkTransactionReferenceExists(
    transactionReference: string,
    correlationId: string
  ): Promise<boolean> {
    // Capitalize transaction reference for consistent lookup
    const capitalizedTransactionReference = transactionReference.trim().toUpperCase();
    this.logger.log(
      `[${correlationId}] Checking if transaction reference exists: ${capitalizedTransactionReference}`
    );

    const existingPayment = await this.prismaService.policyPayment.findFirst({
      where: {
        transactionReference: capitalizedTransactionReference,
        ...notDetachedPaymentWhere(),
      },
      select: {
        id: true,
      },
    });

    const exists = !!existingPayment;
    this.logger.log(
      `[${correlationId}] Transaction reference ${capitalizedTransactionReference} ${exists ? 'exists' : 'does not exist'}`
    );

    return exists;
  }

  /**
   * Generate member number based on package format
   * Similar to policy number generation but for members
   * @param packageId - Package ID
   * @param policyNumber - Policy number to include in member number format (can be null for postpaid)
   * @param memberSequence - Optional member sequence number (00 for principal, 01+ for dependants). If not provided, will auto-increment from last member.
   * @param tx - Prisma transaction client
   * @param correlationId - Correlation ID for tracing
   * @returns Generated member number
   */
  /**
   * Public wrapper for member-number generation (used by LctSyncService for late dependants).
   */
  async generateMemberNumberForPolicy(
    packageId: number,
    policyNumber: string | null,
    tx: Prisma.TransactionClient,
    correlationId: string,
    memberSequence?: number
  ): Promise<string> {
    return this.generateMemberNumber(
      packageId,
      policyNumber,
      tx,
      correlationId,
      memberSequence
    );
  }

  private async generateMemberNumber(
    packageId: number,
    policyNumber: string | null,
    tx: Prisma.TransactionClient,
    correlationId: string,
    memberSequence?: number
  ): Promise<string> {
    this.logger.log(`[${correlationId}] Generating member number for package ${packageId}`);

    try {
      // Get package with both member number format and policy number format
      const packageData = await tx.package.findUnique({
        where: { id: packageId },
        select: {
          id: true,
          memberNumberFormat: true,
          policyNumberFormat: true,
        },
      });

      if (!packageData) {
        throw new NotFoundException(`Package with ID ${packageId} not found`);
      }

      if (!packageData.memberNumberFormat) {
        throw new BadRequestException(
          `Package ${packageId} does not have a member number format configured`
        );
      }

      // Determine member sequence number
      let sequenceNumber: number;
      let digitWidth = 2; // Default to 2 digits (00, 01, 02, etc.)

      if (memberSequence !== undefined) {
        // Use provided sequence (for principal: 0 -> 00, dependants: 1 -> 01, 2 -> 02, etc.)
        sequenceNumber = memberSequence;
      } else {
        // Auto-increment from last member (fallback for backward compatibility)
        const lastPrincipal = await tx.policyMemberPrincipal.findFirst({
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            memberNumber: true,
          },
        });

        const lastDependant = await tx.policyMemberDependant.findFirst({
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            memberNumber: true,
          },
        });

        // Determine which member number is most recent
        let lastMemberNumber: string | null = null;
        if (lastPrincipal && lastDependant) {
          lastMemberNumber = lastPrincipal.memberNumber > lastDependant.memberNumber
            ? lastPrincipal.memberNumber
            : lastDependant.memberNumber;
        } else if (lastPrincipal) {
          lastMemberNumber = lastPrincipal.memberNumber;
        } else if (lastDependant) {
          lastMemberNumber = lastDependant.memberNumber;
        }

        // Extract the sequence number from the last member number, or start at 0 (for principal)
        sequenceNumber = 0; // Start at 0 for principal
        if (lastMemberNumber) {
          const format = packageData.memberNumberFormat;
          const placeholder = '{auto-increasing-member-number}';

          if (format.includes(placeholder)) {
            const [prefix, suffix = ''] = format.split(placeholder);
            const regex = new RegExp(
              `^${this.escapeRegExp(prefix)}(\\d+)${this.escapeRegExp(suffix)}$`
            );
            const lastMatch = lastMemberNumber.match(regex);

            if (lastMatch && lastMatch[1]) {
              sequenceNumber = parseInt(lastMatch[1], 10) + 1;
              digitWidth = lastMatch[1].length;
            }
          }
        }
      }

      // Format sequence number with leading zeros (always 2 digits: 00, 01, 02, etc.)
      const formattedSequence = sequenceNumber.toString().padStart(digitWidth, '0');

      // Replace placeholders in format
      // First replace policy number placeholder (if present) with extracted numeric part
      let memberNumber = packageData.memberNumberFormat;
      if (memberNumber.includes('{auto-increasing-policy-number}')) {
        if (policyNumber && packageData.policyNumberFormat) {
          // Extract numeric part from policy number using policyNumberFormat
          const placeholder = '{auto-increasing-policy-number}';
          const [prefix, suffix = ''] = packageData.policyNumberFormat.split(placeholder);
          const regex = new RegExp(
            `^${this.escapeRegExp(prefix)}(\\d+)${this.escapeRegExp(suffix)}$`
          );
          const match = policyNumber.match(regex);

          if (match && match[1]) {
            // Extract numeric part (e.g., "007" from "MP/MFG/007")
            const extractedPolicyNumber = match[1];
            memberNumber = memberNumber.replace(
              '{auto-increasing-policy-number}',
              extractedPolicyNumber
            );
            this.logger.log(
              `[${correlationId}] Extracted policy number part "${extractedPolicyNumber}" from policy number "${policyNumber}" using format "${packageData.policyNumberFormat}"`
            );
          } else {
            // Fallback: use full policy number if extraction fails
            this.logger.warn(
              `[${correlationId}] Could not extract numeric part from policy number "${policyNumber}" using format "${packageData.policyNumberFormat}". Using full policy number.`
            );
            memberNumber = memberNumber.replace(
              '{auto-increasing-policy-number}',
              policyNumber
            );
          }
        } else if (policyNumber) {
          // No policyNumberFormat available, use full policy number (fallback)
          this.logger.warn(
            `[${correlationId}] Policy number format not available for package ${packageId}. Using full policy number "${policyNumber}".`
          );
          memberNumber = memberNumber.replace(
            '{auto-increasing-policy-number}',
            policyNumber
          );
        } else {
          // For postpaid policies with NULL policy number, use empty string
          this.logger.warn(
            `[${correlationId}] Member number format includes policy number placeholder but policy number is NULL. Using empty string.`
          );
          memberNumber = memberNumber.replace(
            '{auto-increasing-policy-number}',
            ''
          );
        }
      }

      // Then replace member number placeholder
      memberNumber = memberNumber.replace(
        '{auto-increasing-member-number}',
        formattedSequence
      );

      // Validate length (memberNumber column is VarChar(50))
      if (memberNumber.length > 50) {
        this.logger.error(
          `[${correlationId}] Generated member number exceeds 50 characters: ${memberNumber} (length: ${memberNumber.length})`
        );
        throw new BadRequestException(
          `Generated member number "${memberNumber}" exceeds maximum length of 50 characters. ` +
          `Please adjust the memberNumberFormat for package ${packageId}.`
        );
      }

      this.logger.log(
        `[${correlationId}] Generated member number: ${memberNumber} (sequence: ${sequenceNumber}, length: ${memberNumber.length})`
      );
      return memberNumber;
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error generating member number: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      Sentry.captureException(error, {
        tags: {
          service: 'PolicyService',
          operation: 'generateMemberNumber',
          correlationId,
        },
        extra: { packageId },
      });
      throw error;
    }
  }

  /**
   * Resolve policy start/end dates.
   * Prepaid: earliest completed payment on the policy.
   * Postpaid: earliest completed bulk-upload payment (postpaid_scheme_payment_item)
   *           — the first CSV upload this member contributed to, not scheme-wide payments
   *           they were absent from.
   */
  private async resolvePolicyDates(
    policy: { id: string; createdAt: Date },
    isPostpaidScheme: boolean,
    tx: Prisma.TransactionClient,
    correlationId: string
  ): Promise<{ startDate: Date; endDate: Date }> {
    const firstPayment = await tx.policyPayment.findFirst({
      where: {
        policyId: policy.id,
        ...notDetachedPaymentWhere(),
        actualPaymentDate: { not: null },
        ...(isPostpaidScheme
          ? { postpaidSchemePaymentItem: { isNot: null } }
          : {}),
      },
      orderBy: { actualPaymentDate: 'asc' },
      select: { actualPaymentDate: true, transactionReference: true },
    });

    if (!firstPayment?.actualPaymentDate) {
      this.logger.warn(
        `[${correlationId}] No ${isPostpaidScheme ? 'bulk-upload ' : ''}completed payment found for policy ${policy.id}; using policy createdAt for activation dates`
      );
      return policyDatesFromPayment(policy.createdAt);
    }

    if (isPostpaidScheme) {
      this.logger.log(
        `[${correlationId}] Postpaid policy ${policy.id}: start date from first bulk-upload payment ${firstPayment.transactionReference} at ${firstPayment.actualPaymentDate.toISOString()}`
      );
    }

    return policyDatesFromPayment(firstPayment.actualPaymentDate);
  }

  /**
   * Activate a policy
   * - Generates policy number if not already set
   * - Sets start and end dates
   * - Updates status to ACTIVE
   * - Creates PolicyMemberPrincipal record
   * - Creates PolicyMemberDependant records for all dependants
   *
   * @param policyId - Policy UUID
   * @param correlationId - Correlation ID for tracing
   * @param tx - Optional Prisma transaction client
   * @returns Activated policy
   */
  async activatePolicy(
    policyId: string,
    correlationId: string,
    tx?: Prisma.TransactionClient
  ): Promise<Prisma.PolicyGetPayload<Record<string, never>>> {
    this.logger.log(`[${correlationId}] Activating policy ${policyId}`);

    try {
      // Use provided transaction or create a new one
      const executeActivation = async (txClient: Prisma.TransactionClient) => {
        // Get policy with customer and dependants
        const policy = await txClient.policy.findUnique({
          where: { id: policyId },
          include: {
            customer: {
              include: {
                dependants: true,
              },
            },
          },
        });

        if (!policy) {
          throw new NotFoundException(`Policy with ID ${policyId} not found`);
        }

        assertPolicyMayBecomeActive({
          status: policy.status,
          endDate: policy.endDate,
        });

        // Resolve scheme by package (for this policy's package)
        const customerScheme = await txClient.packageSchemeCustomer.findFirst({
          where: {
            customerId: policy.customerId,
            packageScheme: { packageId: policy.packageId },
          },
          include: {
            packageScheme: {
              include: {
                scheme: {
                  select: { isPostpaid: true },
                },
              },
            },
          },
        });

        const isPostpaidScheme = customerScheme?.packageScheme?.scheme?.isPostpaid ?? false;

        this.logger.log(
          `[${correlationId}] Customer ${policy.customerId} is ${isPostpaidScheme ? 'in a POSTPAID' : 'NOT in a postpaid'} scheme`
        );

        // GENERAL RULE: Always check policy_member_principals for this policy first.
        // If a record exists for this policyId, the policy was activated before — only update status.
        const existingPrincipalMember = await txClient.policyMemberPrincipal.findFirst({
          where: { policyId },
        });

        if (existingPrincipalMember) {
          this.logger.log(
            `[${correlationId}] Policy ${policyId} already has member records in policy_member_principals table. ` +
            'Policy was previously activated. Updating status to ACTIVE and backfilling missing dates. ' +
            `Policy number: ${policy.policyNumber ?? 'NULL (postpaid)'}, ` +
            `Member record ID: ${existingPrincipalMember.id}`
          );

          const updateData: Prisma.PolicyUpdateInput = { status: 'ACTIVE' };

          if (!policy.startDate || !policy.endDate) {
            const resolvedDates = await this.resolvePolicyDates(
              policy,
              isPostpaidScheme,
              txClient,
              correlationId
            );
            if (!policy.startDate) {
              updateData.startDate = resolvedDates.startDate;
            }
            if (!policy.endDate) {
              updateData.endDate = policy.startDate
                ? policyEndDateFromStart(policy.startDate)
                : resolvedDates.endDate;
            }
          }

          const effectiveStart =
            (updateData.startDate as Date | undefined) ?? policy.startDate ?? null;
          const effectiveEnd =
            (updateData.endDate as Date | undefined) ?? policy.endDate ?? null;
          if (
            !policy.nominalPaymentPeriodEndDate &&
            effectiveStart &&
            policy.expectedInstallmentCount != null &&
            policy.expectedInstallmentCount > 0 &&
            policy.paymentCadence > 0
          ) {
            updateData.nominalPaymentPeriodEndDate = computeNominalPaymentPeriodEndDate({
              startDate: effectiveStart,
              expectedInstallmentCount: policy.expectedInstallmentCount,
              paymentCadence: policy.paymentCadence,
              policyEndDate: effectiveEnd,
            });
          }

          const updatedPolicy = await txClient.policy.update({
            where: { id: policyId },
            data: updateData,
          });

          await this.lifecycleMessaging.suppressPendingActivationReminders(
            policyId,
            correlationId,
            txClient
          );

          await this.lctSyncService.onPolicyActivated(policyId, correlationId, txClient);

          return updatedPolicy;
        }

        // No member records exist - this is a new activation
        // For prepaid: policy number will be generated, dates will be set
        // For postpaid: policy number will be NULL, but member records will still be created
        this.logger.log(
          `[${correlationId}] Policy ${policyId} needs full activation - no member records found. ` +
          `Policy number: ${policy.policyNumber ?? 'NULL (will remain NULL for postpaid)'}`
        );

        // Generate policy number if it doesn't exist (for both prepaid and postpaid on first activation)
        // Use transaction-safe generator so batch activations (e.g. postpaid payment upload) get unique numbers
        let policyNumber = policy.policyNumber;
        if (!policyNumber) {
          policyNumber = await this.generatePolicyNumberInTransaction(
            policy.packageId,
            txClient,
            correlationId
          );
          this.logger.log(
            `[${correlationId}] Generated policy number for policy ${policyId}: ${policyNumber}`
          );
        }

        // Set start and end dates from first completed payment when missing
        let startDate = policy.startDate;
        let endDate = policy.endDate;

        if (!startDate || !endDate) {
          const resolvedDates = await this.resolvePolicyDates(
            policy,
            isPostpaidScheme,
            txClient,
            correlationId
          );

          startDate ??= resolvedDates.startDate;
          endDate ??= startDate
            ? policyEndDateFromStart(startDate)
            : resolvedDates.endDate;

          this.logger.log(
            `[${correlationId}] Set policy dates - start: ${startDate.toISOString()}, end: ${endDate.toISOString()}`
          );
        }

        let nominalPaymentPeriodEndDate = policy.nominalPaymentPeriodEndDate;
        if (
          !nominalPaymentPeriodEndDate &&
          startDate &&
          policy.expectedInstallmentCount != null &&
          policy.expectedInstallmentCount > 0 &&
          policy.paymentCadence > 0
        ) {
          nominalPaymentPeriodEndDate = computeNominalPaymentPeriodEndDate({
            startDate,
            expectedInstallmentCount: policy.expectedInstallmentCount,
            paymentCadence: policy.paymentCadence,
            policyEndDate: endDate,
          });
        }

        // Update policy with policy number, dates, and status
        const updatedPolicy = await txClient.policy.update({
          where: { id: policyId },
          data: {
            policyNumber,
            startDate,
            endDate,
            nominalPaymentPeriodEndDate,
            status: 'ACTIVE',
          },
        });

        this.logger.log(
          `[${correlationId}] Policy ${policyId} updated with policy number ${policyNumber ?? 'NULL'} and status ACTIVE`
        );

        // Create PolicyMemberPrincipal record (for both prepaid and postpaid)
        // Principal always gets sequence 0 (formatted as 00)
        const principalMemberNumber = await this.generateMemberNumber(
          policy.packageId,
          policyNumber,
          txClient,
          correlationId,
          0 // Principal member sequence: 0 -> 00
        );

        await txClient.policyMemberPrincipal.create({
          data: {
            customerId: policy.customerId,
            policyId: policyId,
            memberNumber: principalMemberNumber,
          },
        });

        this.logger.log(
          `[${correlationId}] Created principal member record with number ${principalMemberNumber} ` +
          `for customer ${policy.customerId}`
        );

        // Create PolicyMemberDependant records for each dependant
        // Order: spouses first (01, 02, ...), then others (e.g. children). Principal is always 00.
        if (policy.customer.dependants && policy.customer.dependants.length > 0) {
          const orderedDependants = this.orderDependantsForMemberNumbers(
            policy.customer.dependants
          );
          this.logger.log(
            `[${correlationId}] Creating member records for ${orderedDependants.length} dependants (spouses first)`
          );

          for (let i = 0; i < orderedDependants.length; i++) {
            const dependant = orderedDependants[i];
            // Dependants start at sequence 1 (formatted as 01), then 2 (02), etc.
            const dependantMemberNumber = await this.generateMemberNumber(
              policy.packageId,
              policyNumber,
              txClient,
              correlationId,
              i + 1 // Dependant sequence: 1 -> 01, 2 -> 02, etc.
            );

            await txClient.policyMemberDependant.create({
              data: {
                dependantId: dependant.id,
                policyId: policyId,
                memberNumber: dependantMemberNumber,
              },
            });

            this.logger.log(
              `[${correlationId}] Created dependant member record with number ${dependantMemberNumber} ` +
              `for dependant ${dependant.id}`
            );
          }
        }

        // Update customer status to ACTIVE if this is the first policy
        const customerPoliciesCount = await txClient.policy.count({
          where: { customerId: policy.customerId },
        });

        if (customerPoliciesCount === 1) {
          // This is the first policy - update customer status to ACTIVE
          await txClient.customer.update({
            where: { id: policy.customerId },
            data: { status: 'ACTIVE' },
          });

          this.logger.log(
            `[${correlationId}] Updated customer ${policy.customerId} status to ACTIVE (first policy)`
          );
        }

        this.logger.log(`[${correlationId}] Policy ${policyId} fully activated successfully`);

        await this.lifecycleMessaging.suppressPendingActivationReminders(
          policyId,
          correlationId,
          txClient
        );

        await this.lctSyncService.onPolicyActivated(policyId, correlationId, txClient);

        return updatedPolicy;
      };

      // Execute in provided transaction or create new one
      if (tx) {
        return await executeActivation(tx);
      } else {
        return await this.prismaService.$transaction(executeActivation);
      }
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error activating policy ${policyId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      Sentry.captureException(error, {
        tags: {
          service: 'PolicyService',
          operation: 'activatePolicy',
          correlationId,
        },
        extra: { policyId },
      });
      throw error;
    }
  }

  /**
   * Get customers without policies who have M-Pesa payments where accountNumber matches idNumber.
   * Used for recovery flow when policy creation failed.
   * @param createdByUserId - When set, only customers registered by this user; omit for registration_admin (all).
   */
  async getCustomersWithoutPoliciesWithPayments(
    _correlationId: string,
    createdByUserId?: string
  ): Promise<
    Array<{
      id: string;
      fullName: string;
      idNumber: string;
      packageId: number;
      packageName: string;
      payments: Array<{
        id: string;
        transactionReference: string;
        paidIn: number;
        completionTime: Date;
        accountNumber: string | null;
      }>;
      earliestPaymentDate: Date;
      registeredAt: Date;
      registeredByDisplayName: string | null;
    }>
  > {
    const payments = await this.prismaService.mpesaPaymentReportItem.findMany({
      where: {
        accountNumber: { not: null },
        paidIn: { gt: 0 },
      },
      select: {
        id: true,
        transactionReference: true,
        paidIn: true,
        completionTime: true,
        accountNumber: true,
      },
      orderBy: { completionTime: 'asc' },
    });

    const customersByAccountNumber = new Map<
      string,
      Array<{
        id: string;
        transactionReference: string;
        paidIn: number;
        completionTime: Date;
        accountNumber: string | null;
      }>
    >();

    for (const p of payments) {
      if (p.transactionReference == null || p.completionTime == null) continue;
      const accountNum = this.normalizeAccountNumber(p.accountNumber);
      if (!accountNum) continue;
      const existing = customersByAccountNumber.get(accountNum) ?? [];
      // Deduplicate by transactionReference: keep first record only (payments already ordered by completionTime asc)
      if (existing.some((x) => x.transactionReference === p.transactionReference)) {
        continue;
      }
      existing.push({
        id: p.id,
        transactionReference: p.transactionReference,
        paidIn: Number(p.paidIn),
        completionTime: p.completionTime,
        accountNumber: p.accountNumber,
      });
      customersByAccountNumber.set(accountNum, existing);
    }

    const customersWithoutPolicy: Array<{
      id: string;
      fullName: string;
      idNumber: string;
      packageId: number;
      packageName: string;
      payments: Array<{
        id: string;
        transactionReference: string;
        paidIn: number;
        completionTime: Date;
        accountNumber: string | null;
      }>;
      earliestPaymentDate: Date;
      registeredAt: Date;
      createdBy: string | null;
      registeredByDisplayName: string | null;
    }> = [];

    const allCustomers = await this.prismaService.customer.findMany({
      where: createdByUserId ? { createdBy: createdByUserId } : undefined,
      select: {
        id: true,
        firstName: true,
        middleName: true,
        lastName: true,
        idNumber: true,
        createdAt: true,
        createdBy: true,
      },
    });

    for (const customer of allCustomers) {
      const idNum = this.normalizeAccountNumber(customer.idNumber);
      if (!idNum) continue;

      const customerPayments = customersByAccountNumber.get(idNum);
      if (!customerPayments || customerPayments.length === 0) continue;

      const hasPolicy = await this.prismaService.policy.findFirst({
        where: { customerId: customer.id },
        select: { id: true },
      });
      if (hasPolicy) continue;

      const psc = await this.prismaService.packageSchemeCustomer.findFirst({
        where: { customerId: customer.id },
        include: {
          packageScheme: {
            include: {
              package: { select: { id: true, name: true } },
            },
          },
        },
      });

      if (!psc?.packageScheme?.package) continue;

      const fullName = [customer.firstName, customer.middleName, customer.lastName]
        .filter(Boolean)
        .join(' ');
      const earliestPaymentDate = customerPayments[0].completionTime;

      customersWithoutPolicy.push({
        id: customer.id,
        fullName,
        idNumber: customer.idNumber ?? '',
        packageId: psc.packageScheme.package.id,
        packageName: psc.packageScheme.package.name,
        payments: customerPayments,
        earliestPaymentDate,
        registeredAt: customer.createdAt,
        createdBy: customer.createdBy,
        registeredByDisplayName: null,
      });
    }

    const displayNames = await this.resolveRegisteredByDisplayNames(
      customersWithoutPolicy.map((c) => c.createdBy).filter((id): id is string => !!id)
    );
    return customersWithoutPolicy.map(({ createdBy, ...rest }) => ({
      ...rest,
      registeredByDisplayName: createdBy ? displayNames.get(createdBy) ?? null : null,
    }));
  }

  /**
   * Get customers with no policy and no M-Pesa payments (accountNumber matching idNumber).
   * Used for recovery: create policy record only (PENDING_ACTIVATION); activation on first payment.
   * @param createdByUserId - When set, only customers registered by this user; omit for registration_admin (all).
   */
  async getCustomersWithoutPolicyAndWithoutPayments(
    _correlationId: string,
    createdByUserId?: string
  ): Promise<
    Array<{
      id: string;
      fullName: string;
      idNumber: string;
      packageId: number;
      packageName: string;
      payments: Array<{
        id: string;
        transactionReference: string;
        paidIn: number;
        completionTime: Date;
        accountNumber: string | null;
      }>;
      earliestPaymentDate: Date | null;
      registeredAt: Date;
      registeredByDisplayName: string | null;
    }>
  > {
    const payments = await this.prismaService.mpesaPaymentReportItem.findMany({
      where: {
        accountNumber: { not: null },
        paidIn: { gt: 0 },
      },
      select: {
        accountNumber: true,
      },
    });
    const accountNumbersWithPayments = new Set<string>();
    for (const p of payments) {
      const accountNum = this.normalizeAccountNumber(p.accountNumber);
      if (accountNum) accountNumbersWithPayments.add(accountNum);
    }

    const allCustomers = await this.prismaService.customer.findMany({
      where: createdByUserId ? { createdBy: createdByUserId } : undefined,
      select: {
        id: true,
        firstName: true,
        middleName: true,
        lastName: true,
        idNumber: true,
        createdAt: true,
        createdBy: true,
      },
    });

    const result: Array<{
      id: string;
      fullName: string;
      idNumber: string;
      packageId: number;
      packageName: string;
      payments: Array<never>;
      earliestPaymentDate: Date | null;
      registeredAt: Date;
      createdBy: string | null;
      registeredByDisplayName: string | null;
    }> = [];

    for (const customer of allCustomers) {
      const idNum = this.normalizeAccountNumber(customer.idNumber);
      if (!idNum) continue;
      if (accountNumbersWithPayments.has(idNum)) continue;

      const hasPolicy = await this.prismaService.policy.findFirst({
        where: { customerId: customer.id },
        select: { id: true },
      });
      if (hasPolicy) continue;

      const psc = await this.prismaService.packageSchemeCustomer.findFirst({
        where: { customerId: customer.id },
        include: {
          packageScheme: {
            include: {
              package: { select: { id: true, name: true } },
            },
          },
        },
      });
      if (!psc?.packageScheme?.package) continue;

      const fullName = [customer.firstName, customer.middleName, customer.lastName]
        .filter(Boolean)
        .join(' ');
      result.push({
        id: customer.id,
        fullName,
        idNumber: customer.idNumber ?? '',
        packageId: psc.packageScheme.package.id,
        packageName: psc.packageScheme.package.name,
        payments: [],
        earliestPaymentDate: null,
        registeredAt: customer.createdAt,
        createdBy: customer.createdBy,
        registeredByDisplayName: null,
      });
    }

    const displayNames = await this.resolveRegisteredByDisplayNames(
      result.map((c) => c.createdBy).filter((id): id is string => !!id)
    );
    return result.map(({ createdBy, ...rest }) => ({
      ...rest,
      registeredByDisplayName: createdBy ? displayNames.get(createdBy) ?? null : null,
    }));
  }

  /**
   * Create policy from recovery flow - for customers whose policy creation failed.
   * Creates policy, maps historical M-Pesa items to policy_payments, then activates.
   */
  async createPolicyFromRecovery(
    data: {
      customerId: string;
      packageId: number;
      packagePlanId: number;
      premium: number;
      annualPremium?: number;
      frequency: PaymentFrequency;
      customDays?: number;
    },
    correlationId: string
  ) {
    const customer = await this.prismaService.customer.findUnique({
      where: { id: data.customerId },
      include: { dependants: true },
    });
    if (!customer) {
      throw new NotFoundException(`Customer ${data.customerId} not found`);
    }

    const packageData = await this.prismaService.package.findUnique({
      where: { id: data.packageId },
      include: {
        packagePlans: { where: { id: data.packagePlanId } },
      },
    });
    if (!packageData || !packageData.packagePlans[0]) {
      throw new NotFoundException(`Package plan ${data.packagePlanId} not found for package ${data.packageId}`);
    }

    const plan = packageData.packagePlans[0];
    const productName = `${packageData.name} ${plan.name}`;
    if (data.frequency === PaymentFrequency.CUSTOM && (!data.customDays || data.customDays <= 0)) {
      throw new BadRequestException('Custom days must be provided when frequency is CUSTOM');
    }
    const paymentCadence = this.calculatePaymentCadence(data.frequency, data.customDays);
    const expectedInstallmentCount = await this.resolveExpectedInstallmentCount(
      data.packageId,
      data.frequency
    );
    const paymentAcNumber = customer.idNumber ?? '';

    const normalizedIdNumber = this.normalizeAccountNumber(customer.idNumber);
    if (!normalizedIdNumber) {
      throw new BadRequestException(`Customer ${data.customerId} has no idNumber`);
    }

    const matchingPaymentCount = await this.prismaService.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT "transactionReference")::bigint AS count
      FROM mpesa_payment_report_items
      WHERE "paidIn" > 0
        AND "transactionReference" IS NOT NULL
        AND "completionTime" IS NOT NULL
        AND REPLACE(TRIM(COALESCE("accountNumber", '')), ' ', '') = ${normalizedIdNumber}
    `;
    if (Number(matchingPaymentCount[0]?.count ?? 0) === 0) {
      throw new BadRequestException(
        `No M-Pesa payments found for customer ${data.customerId} with accountNumber matching idNumber`
      );
    }

    const customerScheme = await this.prismaService.packageSchemeCustomer.findFirst({
      where: {
        customerId: data.customerId,
        packageScheme: { packageId: data.packageId },
      },
      include: {
        packageScheme: {
          include: { scheme: { select: { isPostpaid: true } } },
        },
      },
    });
    const isPostpaidScheme = customerScheme?.packageScheme?.scheme?.isPostpaid ?? false;

    return this.prismaService.$transaction(async (tx) => {
      const policyNumber = isPostpaidScheme
        ? null
        : await this.generatePolicyNumberInTransaction(data.packageId, tx, correlationId);

      const policy = await tx.policy.create({
        data: {
          policyNumber,
          status: 'PENDING_ACTIVATION',
          customerId: data.customerId,
          packageId: data.packageId,
          packagePlanId: data.packagePlanId,
          productName,
          premium: data.premium,
          annualPremium: data.annualPremium ?? null,
          frequency: data.frequency,
          paymentCadence,
          expectedInstallmentCount,
          paymentAcNumber,
          startDate: null,
          endDate: null,
        },
      });

      const mapped = await this.mapUnmappedMpesaItemsToPolicy(
        policy.id,
        paymentAcNumber,
        correlationId,
        tx,
        { activateIfPending: true }
      );

      if (mapped.mappedCount === 0) {
        throw new BadRequestException(
          `Could not map any M-Pesa payments to the new policy for customer ${data.customerId}`
        );
      }

      return tx.policy.findUniqueOrThrow({ where: { id: policy.id } });
    });
  }

  /**
   * Create policy record only (no payments, no activation). For customers with no policy and no M-Pesa payments.
   * Policy stays PENDING_ACTIVATION; policyNumber, startDate, endDate null until activatePolicy() runs (e.g. on first payment).
   */
  async createPolicyWithoutPayments(
    data: {
      customerId: string;
      packageId: number;
      packagePlanId: number;
      premium: number;
      annualPremium?: number;
      frequency: PaymentFrequency;
      customDays?: number;
    },
    _correlationId: string
  ) {
    const customer = await this.prismaService.customer.findUnique({
      where: { id: data.customerId },
      select: { id: true, idNumber: true },
    });
    if (!customer) {
      throw new NotFoundException(`Customer ${data.customerId} not found`);
    }

    const packageData = await this.prismaService.package.findUnique({
      where: { id: data.packageId },
      include: {
        packagePlans: { where: { id: data.packagePlanId } },
      },
    });
    if (!packageData || !packageData.packagePlans[0]) {
      throw new NotFoundException(
        `Package plan ${data.packagePlanId} not found for package ${data.packageId}`
      );
    }

    const plan = packageData.packagePlans[0];
    const productName = `${packageData.name} ${plan.name}`;
    if (data.frequency === PaymentFrequency.CUSTOM && (!data.customDays || data.customDays <= 0)) {
      throw new BadRequestException('Custom days must be provided when frequency is CUSTOM');
    }
    const paymentCadence = this.calculatePaymentCadence(data.frequency, data.customDays);
    const expectedInstallmentCount = await this.resolveExpectedInstallmentCount(
      data.packageId,
      data.frequency
    );
    const paymentAcNumber = customer.idNumber ?? null;

    return this.prismaService.$transaction(async (tx) => {
      const policy = await tx.policy.create({
        data: {
          policyNumber: null,
          status: 'PENDING_ACTIVATION',
          customerId: data.customerId,
          packageId: data.packageId,
          packagePlanId: data.packagePlanId,
          paymentAcNumber,
          productName,
          startDate: null,
          endDate: null,
          premium: data.premium,
          annualPremium: data.annualPremium ?? null,
          frequency: data.frequency,
          paymentCadence,
          expectedInstallmentCount,
        },
      });

      // Defensive: if any historical M-Pesa items match, map them (list path usually has none)
      if (paymentAcNumber) {
        await this.mapUnmappedMpesaItemsToPolicy(
          policy.id,
          paymentAcNumber,
          _correlationId,
          tx,
          { activateIfPending: true }
        );
      }

      return tx.policy.findUniqueOrThrow({ where: { id: policy.id } });
    });
  }

  /**
   * Get first 140 customers (by createdAt) with their policies for member number reconciliation.
   * Each row is one policy (or one row per customer with no policy, policyNumber N/A).
   */
  async getMemberNumberReconciliationList(correlationId: string): Promise<
    Array<{
      customerId: string;
      fullName: string;
      phoneNumber: string;
      idNumber: string;
      dependantCount: number;
      policyId: string | null;
      policyNumber: string | null;
      principalMemberNumber: string | null;
      dependants: Array<{ fullName: string; memberNumber: string }>;
    }>
  > {
    this.logger.log(`[${correlationId}] Fetching member number reconciliation list (first 140 customers)`);

    const customers = await this.prismaService.customer.findMany({
      orderBy: { createdAt: 'asc' },
      take: 140,
      include: {
        policies: { orderBy: { createdAt: 'asc' } },
        dependants: { where: { deletedAt: null } },
      },
    });

    const customerIds = customers.map((c) => c.id);
    const principalsByCustomer =
      customerIds.length > 0
        ? await this.prismaService.policyMemberPrincipal.findMany({
            where: { customerId: { in: customerIds } },
            orderBy: { createdAt: 'desc' },
          })
        : [];
    const latestPrincipalByCustomerId = new Map<string, { memberNumber: string }>();
    for (const p of principalsByCustomer) {
      if (!latestPrincipalByCustomerId.has(p.customerId)) {
        latestPrincipalByCustomerId.set(p.customerId, { memberNumber: p.memberNumber });
      }
    }

    const rows: Array<{
      customerId: string;
      fullName: string;
      phoneNumber: string;
      idNumber: string;
      dependantCount: number;
      policyId: string | null;
      policyNumber: string | null;
      principalMemberNumber: string | null;
      dependants: Array<{ fullName: string; memberNumber: string }>;
    }> = [];

    for (const customer of customers) {
      const fullName = [customer.firstName, customer.middleName ?? '', customer.lastName]
        .filter(Boolean)
        .join(' ')
        .trim();
      const dependantCount = customer.dependants.length;
      const principalMember = latestPrincipalByCustomerId.get(customer.id) ?? null;

      if (customer.policies.length === 0) {
        rows.push({
          customerId: customer.id,
          fullName,
          phoneNumber: customer.phoneNumber,
          idNumber: customer.idNumber,
          dependantCount,
          policyId: null,
          policyNumber: null,
          principalMemberNumber: null,
          dependants: [],
        });
        continue;
      }

      for (const policy of customer.policies) {
        const dependantIds = customer.dependants.map((d) => d.id);
        const policyMemberDependants =
          dependantIds.length > 0
            ? await this.prismaService.policyMemberDependant.findMany({
                where: { dependantId: { in: dependantIds } },
                include: { dependant: true },
              })
            : [];

        const dependants = policyMemberDependants.map((pmd) => {
          const d = pmd.dependant;
          const name = [d.firstName, d.middleName ?? '', d.lastName].filter(Boolean).join(' ').trim();
          return { fullName: name, memberNumber: pmd.memberNumber };
        });

        rows.push({
          customerId: customer.id,
          fullName,
          phoneNumber: customer.phoneNumber,
          idNumber: customer.idNumber,
          dependantCount,
          policyId: policy.id,
          policyNumber: policy.policyNumber ?? null,
          principalMemberNumber: principalMember?.memberNumber ?? null,
          dependants,
        });
      }
    }

    return rows;
  }

  /**
   * Reconcile policy member numbers: set new policy number and ensure principal + dependant
   * member records exist. Creates missing policy_member_principal and policy_member_dependant
   * records (spouses first 01, 02, then others); updates existing records with new member numbers.
   */
  async reconcilePolicyMemberNumbers(
    policyId: string,
    newPolicyNumber: string,
    correlationId: string
  ): Promise<void> {
    this.logger.log(`[${correlationId}] Reconciling member numbers for policy ${policyId}`);

    if (newPolicyNumber.length > 15) {
      throw new BadRequestException('Policy number must not exceed 15 characters');
    }

    const policy = await this.prismaService.policy.findUnique({
      where: { id: policyId },
      include: {
        customer: {
          include: {
            dependants: { where: { deletedAt: null } },
          },
        },
        package: {
          select: {
            id: true,
            memberNumberFormat: true,
            policyNumberFormat: true,
          },
        },
      },
    });

    if (!policy) {
      throw new NotFoundException(`Policy with ID ${policyId} not found`);
    }

    const existing = await this.prismaService.policy.findFirst({
      where: {
        policyNumber: newPolicyNumber,
        id: { not: policyId },
      },
    });
    if (existing) {
      throw new ConflictException(
        `Policy number "${newPolicyNumber}" is already in use by another policy`
      );
    }

    await this.prismaService.$transaction(async (tx) => {
      await tx.policy.update({
        where: { id: policyId },
        data: { policyNumber: newPolicyNumber },
      });

      const principal = await tx.policyMemberPrincipal.findFirst({
        where: {
          OR: [{ policyId }, { customerId: policy.customerId, policyId: null }],
        },
        orderBy: { policyId: 'desc' },
      });
      const principalMemberNumber = await this.generateMemberNumber(
        policy.packageId,
        newPolicyNumber,
        tx,
        correlationId,
        0
      );
      if (principal) {
        await tx.policyMemberPrincipal.update({
          where: { id: principal.id },
          data: {
            memberNumber: principalMemberNumber,
            policyId,
            updatedAt: new Date(),
          },
        });
      } else {
        await tx.policyMemberPrincipal.create({
          data: {
            customerId: policy.customerId,
            policyId,
            memberNumber: principalMemberNumber,
          },
        });
        this.logger.log(
          `[${correlationId}] Created missing principal member record with number ${principalMemberNumber} for customer ${policy.customerId}`
        );
      }

      const orderedDependants = this.orderDependantsForMemberNumbers(policy.customer.dependants);
      for (let i = 0; i < orderedDependants.length; i++) {
        const dependant = orderedDependants[i];
        const pmd = await tx.policyMemberDependant.findFirst({
          where: {
            dependantId: dependant.id,
            OR: [{ policyId }, { policyId: null }],
          },
          orderBy: { policyId: 'desc' },
        });
        const dependantMemberNumber = await this.generateMemberNumber(
          policy.packageId,
          newPolicyNumber,
          tx,
          correlationId,
          i + 1
        );
        if (pmd) {
          await tx.policyMemberDependant.update({
            where: { id: pmd.id },
            data: {
              memberNumber: dependantMemberNumber,
              policyId,
              updatedAt: new Date(),
            },
          });
        } else {
          await tx.policyMemberDependant.create({
            data: {
              dependantId: dependant.id,
              policyId,
              memberNumber: dependantMemberNumber,
            },
          });
          this.logger.log(
            `[${correlationId}] Created missing dependant member record with number ${dependantMemberNumber} for dependant ${dependant.id}`
          );
        }
      }
    });

    await this.lctSyncService.onPolicyActivated(policyId, correlationId);

    this.logger.log(`[${correlationId}] Successfully reconciled member numbers for policy ${policyId}`);
  }
}

