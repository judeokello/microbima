import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_CADENCE } from '../constants/payment-cadence.constants';
import { PaymentFrequency, Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import * as Sentry from '@sentry/nestjs';
import { PaymentAccountNumberService } from './payment-account-number.service';

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
 */
@Injectable()
export class PolicyService {
  private readonly logger = new Logger(PolicyService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly paymentAccountNumberService: PaymentAccountNumberService
  ) {}

  /**
   * Escape user-provided strings for safe RegExp construction
   */
  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
      productName: string;
      tags?: Array<{ id?: number; name: string }>;
      paymentData: {
        paymentType: 'MPESA' | 'SASAPAY';
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
    correlationId: string
  ) {
    // Capitalize transaction reference to ensure consistency in database
    const capitalizedTransactionReference = data.paymentData.transactionReference.trim().toUpperCase();
    data.paymentData.transactionReference = capitalizedTransactionReference;
    // Idempotency check: Check if a policy payment already exists with this transaction reference
    // This prevents duplicate policy creation if the same request is submitted multiple times
    const existingPayment = await this.prismaService.policyPayment.findFirst({
      where: {
        transactionReference: data.paymentData.transactionReference,
      },
      include: {
        policy: {
          include: {
            policyPayments: {
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

      // Check if customer is in a postpaid scheme
      const customerScheme = await this.prismaService.packageSchemeCustomer.findFirst({
        where: {
          customerId: data.customerId,
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

        // Determine payment account number based on postpaid status
        let paymentAcNumber: string | null = null;

        if (!isPostpaidScheme) {
          // For prepaid schemes, generate payment account number
          const isFirstPolicy = !(await this.paymentAccountNumberService.customerHasExistingPolicies(
            data.customerId,
            tx,
            correlationId
          ));

          paymentAcNumber = await this.paymentAccountNumberService.generateForPolicy(
            data.customerId,
            isFirstPolicy,
            tx,
            correlationId
          );

          this.logger.log(
            `[${correlationId}] Generated payment account number for prepaid policy: ${paymentAcNumber} (first policy: ${isFirstPolicy})`
          );
        } else {
          this.logger.log(
            `[${correlationId}] Postpaid scheme - no payment account number will be assigned to policy`
          );
        }

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
              frequency,
              paymentCadence,
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
                  frequency,
                  paymentCadence,
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

        // Create policy payment
        const policyPayment = await tx.policyPayment.create({
          data: {
            policyId: policy.id,
            paymentType: data.paymentData.paymentType,
            transactionReference: data.paymentData.transactionReference,
            amount: data.paymentData.amount,
            accountNumber: data.paymentData.accountNumber ?? null,
            details: data.paymentData.details ?? null,
            expectedPaymentDate: data.paymentData.expectedPaymentDate,
            actualPaymentDate: data.paymentData.actualPaymentDate ?? null,
            paymentMessageBlob: data.paymentData.paymentMessageBlob ?? null,
          },
        });

        // For prepaid schemes, activate the policy only if payment has already been completed
        // (indicated by actualPaymentDate being set)
        // If actualPaymentDate is null, policy remains in PENDING_ACTIVATION until payment completes
        // Payment completion will trigger activation via IPN or STK push callback
        if (!isPostpaidScheme && data.paymentData.actualPaymentDate) {
          await this.activatePolicy(policy.id, correlationId, tx);
          this.logger.log(`[${correlationId}] Activated prepaid policy ${policy.id} immediately (payment already completed)`);
        } else if (!isPostpaidScheme) {
          this.logger.log(`[${correlationId}] Policy ${policy.id} created with PENDING_ACTIVATION status (will be activated when payment completes)`);
        }

        return {
          policy,
          policyPayment,
        };
      });

      this.logger.log(
        `[${correlationId}] Policy ${result.policy.id} created successfully with payment ${result.policyPayment.id}`
      );

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

        // Check if customer is in a postpaid scheme
        const customerScheme = await txClient.packageSchemeCustomer.findFirst({
          where: { customerId: policy.customerId },
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

        // GENERAL RULE: Always check policy_member_principals table first
        // If a record exists, it means the policy was activated before and member records were created
        // In this case, we only update the status to ACTIVE and don't touch policy number or member records
        const existingPrincipalMember = await txClient.policyMemberPrincipal.findFirst({
          where: { customerId: policy.customerId },
        });

        if (existingPrincipalMember) {
          this.logger.log(
            `[${correlationId}] Policy ${policyId} already has member records in policy_member_principals table. ` +
            'Policy was previously activated. Only updating status to ACTIVE. ' +
            `Policy number: ${policy.policyNumber ?? 'NULL (postpaid)'}, ` +
            `Member record ID: ${existingPrincipalMember.id}`
          );

          // Only update status to ACTIVE - don't touch policy number, dates, or member records
          const updatedPolicy = await txClient.policy.update({
            where: { id: policyId },
            data: {
              status: 'ACTIVE',
            },
          });

          return updatedPolicy;
        }

        // No member records exist - this is a new activation
        // For prepaid: policy number will be generated, dates will be set
        // For postpaid: policy number will be NULL, but member records will still be created
        this.logger.log(
          `[${correlationId}] Policy ${policyId} needs full activation - no member records found. ` +
          `Policy number: ${policy.policyNumber ?? 'NULL (will remain NULL for postpaid)'}`
        );

        // Generate policy number if it doesn't exist (prepaid schemes only)
        // Postpaid schemes will have NULL policy number - DO NOT generate
        let policyNumber = policy.policyNumber;
        if (!policyNumber) {
          if (!isPostpaidScheme) {
            // Only generate policy number for prepaid schemes
            policyNumber = await this.generatePolicyNumber(policy.packageId, correlationId);
            this.logger.log(
              `[${correlationId}] Generated policy number for prepaid policy: ${policyNumber}`
            );
          } else {
            // Postpaid scheme - keep policy number as NULL
            this.logger.log(
              `[${correlationId}] Postpaid policy - keeping policy number as NULL`
            );
          }
        }

        // Set start and end dates if they don't exist
        let startDate = policy.startDate;
        let endDate = policy.endDate;

        if (!startDate || !endDate) {
          startDate = new Date();
          startDate.setUTCHours(0, 0, 0, 0);

          endDate = new Date(startDate);
          endDate.setFullYear(endDate.getFullYear() + 1);
          endDate.setUTCHours(23, 59, 59, 999);

          this.logger.log(
            `[${correlationId}] Set policy dates - start: ${startDate.toISOString()}, end: ${endDate.toISOString()}`
          );
        }

        // Update policy with policy number, dates, and status
        const updatedPolicy = await txClient.policy.update({
          where: { id: policyId },
          data: {
            policyNumber,
            startDate,
            endDate,
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
            memberNumber: principalMemberNumber,
          },
        });

        this.logger.log(
          `[${correlationId}] Created principal member record with number ${principalMemberNumber} ` +
          `for customer ${policy.customerId}`
        );

        // Create PolicyMemberDependant records for each dependant
        // Dependants get sequential numbers starting from 1 (formatted as 01, 02, etc.)
        if (policy.customer.dependants && policy.customer.dependants.length > 0) {
          this.logger.log(
            `[${correlationId}] Creating member records for ${policy.customer.dependants.length} dependants`
          );

          for (let i = 0; i < policy.customer.dependants.length; i++) {
            const dependant = policy.customer.dependants[i];
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
   */
  async getCustomersWithoutPoliciesWithPayments(
    _correlationId: string
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
      const accountNum = p.accountNumber?.trim().replace(/\s/g, '') ?? '';
      if (!accountNum) continue;
      const existing = customersByAccountNumber.get(accountNum) ?? [];
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
    }> = [];

    const allCustomers = await this.prismaService.customer.findMany({
      select: {
        id: true,
        firstName: true,
        middleName: true,
        lastName: true,
        idNumber: true,
      },
    });

    for (const customer of allCustomers) {
      const idNum = customer.idNumber?.trim().replace(/\s/g, '') ?? '';
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
      });
    }

    return customersWithoutPolicy;
  }

  /**
   * Create policy from recovery flow - for customers whose policy creation failed.
   * Creates policy, policy_payments (from M-Pesa items), then activates.
   */
  async createPolicyFromRecovery(
    data: {
      customerId: string;
      packageId: number;
      packagePlanId: number;
      premium: number;
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
    const paymentAcNumber = customer.idNumber ?? '';

    const normalizedIdNumber = (customer.idNumber ?? '').trim().replace(/\s/g, '');
    if (!normalizedIdNumber) {
      throw new BadRequestException(`Customer ${data.customerId} has no idNumber`);
    }
    const payments = await this.prismaService.$queryRaw<
      Array<{
        id: string;
        transactionReference: string;
        paidIn: number;
        completionTime: Date;
        accountNumber: string | null;
      }>
    >`
      SELECT id, "transactionReference", "paidIn", "completionTime", "accountNumber"
      FROM mpesa_payment_report_items
      WHERE "paidIn" > 0
        AND REPLACE(TRIM(COALESCE("accountNumber", '')), ' ', '') = ${normalizedIdNumber}
      ORDER BY "completionTime" ASC
    `;

    if (payments.length === 0) {
      throw new BadRequestException(
        `No M-Pesa payments found for customer ${data.customerId} with accountNumber matching idNumber`
      );
    }

    const earliestPayment = payments[0];
    const startDate = new Date(earliestPayment.completionTime);
    startDate.setUTCHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 1);
    endDate.setUTCHours(23, 59, 59, 999);

    return this.prismaService.$transaction(async (tx) => {
      const policyNumber = await this.generatePolicyNumberInTransaction(
        data.packageId,
        tx,
        correlationId
      );

      const policy = await tx.policy.create({
        data: {
          policyNumber,
          status: 'PENDING_ACTIVATION',
          customerId: data.customerId,
          packageId: data.packageId,
          packagePlanId: data.packagePlanId,
          productName,
          premium: data.premium,
          frequency: data.frequency,
          paymentCadence,
          paymentAcNumber,
          startDate,
          endDate,
        },
      });

      for (const p of payments) {
        await tx.policyPayment.create({
          data: {
            policyId: policy.id,
            paymentType: 'MPESA',
            transactionReference: p.transactionReference,
            amount: p.paidIn,
            accountNumber: p.accountNumber ?? null,
            expectedPaymentDate: p.completionTime,
            actualPaymentDate: p.completionTime,
          },
        });
      }

      await this.activatePolicy(policy.id, correlationId, tx);

      return policy;
    });
  }
}

