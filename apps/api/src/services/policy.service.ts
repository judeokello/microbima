import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_CADENCE } from '../constants/payment-cadence.constants';
import { PaymentFrequency, Prisma } from '@prisma/client';
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
      const result = await this.prismaService.$transaction(async (tx: Prisma.TransactionClient) => {
        // Double-check idempotency inside transaction to prevent race conditions
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
            `[${correlationId}] Policy payment with transaction reference ${data.paymentData.transactionReference} already exists (race condition detected). Returning existing policy ${existingPaymentInTx.policy.id}`
          );
          return {
            policy: existingPaymentInTx.policy,
            policyPayment: existingPaymentInTx,
          };
        }

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
          frequency = customerScheme.packageScheme.scheme.frequency || data.frequency;
          paymentCadence = customerScheme.packageScheme.scheme.paymentCadence || paymentCadence;
          this.logger.log(
            `[${correlationId}] Using scheme's payment settings - frequency: ${frequency}, cadence: ${paymentCadence}`
          );
        }

        // For postpaid schemes: no policy number, null dates, PENDING_ACTIVATION
        // For prepaid schemes: generate policy number, set proper dates, will activate after creation
        let policyNumber: string;
        let startDate: Date | null;
        let endDate: Date | null;
        let status: 'PENDING_ACTIVATION' | 'ACTIVE';

        if (isPostpaidScheme) {
          // Postpaid: no policy number yet, null dates (will be set on activation)
          policyNumber = ''; // Empty string, will be generated upon activation
          startDate = null; // Will be set on activation
          endDate = null; // Will be set on activation
          status = 'PENDING_ACTIVATION';
        } else {
          // Prepaid: generate policy number, set dates, will activate immediately
          policyNumber = await this.generatePolicyNumber(data.packageId, correlationId);
          startDate = new Date();
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(startDate);
          endDate.setFullYear(endDate.getFullYear() + 1);
          endDate.setHours(23, 59, 59, 999);
          status = 'PENDING_ACTIVATION'; // Will be updated to ACTIVE by activatePolicy
        }

        // Create policy
        const policy = await tx.policy.create({
          data: {
            policyNumber,
            status,
            customerId: data.customerId,
            packageId: data.packageId,
            packagePlanId: data.packagePlanId,
            productName: data.productName,
            startDate: startDate as any, // Type assertion: DB schema supports null, Prisma client needs regeneration
            endDate: endDate as any, // Type assertion: DB schema supports null, Prisma client needs regeneration
            premium: data.premium,
            frequency,
            paymentCadence,
            paymentAcNumber,
          },
        });

        this.logger.log(
          `[${correlationId}] Created policy ${policy.id} (postpaid: ${isPostpaidScheme}, policy number: ${policyNumber || 'not assigned'})`
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

        // For prepaid schemes, activate the policy immediately (creates member records)
        if (!isPostpaidScheme) {
          await this.activatePolicy(policy.id, correlationId, tx);
          this.logger.log(`[${correlationId}] Activated prepaid policy ${policy.id} immediately`);
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
    this.logger.log(
      `[${correlationId}] Checking if transaction reference exists: ${transactionReference}`
    );

    const existingPayment = await this.prismaService.policyPayment.findFirst({
      where: {
        transactionReference: transactionReference.trim(),
      },
      select: {
        id: true,
      },
    });

    const exists = !!existingPayment;
    this.logger.log(
      `[${correlationId}] Transaction reference ${transactionReference} ${exists ? 'exists' : 'does not exist'}`
    );

    return exists;
  }

  /**
   * Generate member number based on package format
   * Similar to policy number generation but for members
   * @param packageId - Package ID
   * @param tx - Prisma transaction client
   * @param correlationId - Correlation ID for tracing
   * @returns Generated member number
   */
  private async generateMemberNumber(
    packageId: number,
    tx: Prisma.TransactionClient,
    correlationId: string
  ): Promise<string> {
    this.logger.log(`[${correlationId}] Generating member number for package ${packageId}`);

    try {
      // Get package with member number format
      const packageData = await tx.package.findUnique({
        where: { id: packageId },
        select: {
          id: true,
          memberNumberFormat: true,
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

      // Find the last member (principal or dependant) for this package
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
        // Both exist, use the most recent
        lastMemberNumber = lastPrincipal.memberNumber > lastDependant.memberNumber
          ? lastPrincipal.memberNumber
          : lastDependant.memberNumber;
      } else if (lastPrincipal) {
        lastMemberNumber = lastPrincipal.memberNumber;
      } else if (lastDependant) {
        lastMemberNumber = lastDependant.memberNumber;
      }

      // Extract the sequence number from the last member number, or start at 1
      let digitWidth = 3;
      let sequenceNumber = 1;
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

      // Format sequence number with leading zeros
      const formattedSequence = sequenceNumber.toString().padStart(digitWidth, '0');

      // Replace placeholder in format
      const memberNumber = packageData.memberNumberFormat.replace(
        '{auto-increasing-member-number}',
        formattedSequence
      );

      this.logger.log(
        `[${correlationId}] Generated member number: ${memberNumber} (sequence: ${sequenceNumber})`
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
  ): Promise<any> {
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

        // Check if policy already has a policy number (already activated)
        if (policy.policyNumber && policy.policyNumber.trim() !== '') {
          this.logger.log(
            `[${correlationId}] Policy ${policyId} already has policy number ${policy.policyNumber}. ` +
            `Updating status to ACTIVE only.`
          );

          // Just update status to ACTIVE
          const updatedPolicy = await txClient.policy.update({
            where: { id: policyId },
            data: {
              status: 'ACTIVE',
            },
          });

          return updatedPolicy;
        }

        // Policy doesn't have a policy number yet - full activation
        this.logger.log(`[${correlationId}] Policy ${policyId} needs full activation`);

        // Generate policy number
        const policyNumber = await this.generatePolicyNumber(policy.packageId, correlationId);

        // Set start and end dates
        const startDate = new Date();
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(startDate);
        endDate.setFullYear(endDate.getFullYear() + 1);
        endDate.setHours(23, 59, 59, 999);

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
          `[${correlationId}] Policy ${policyId} updated with policy number ${policyNumber}`
        );

        // Create PolicyMemberPrincipal record
        const principalMemberNumber = await this.generateMemberNumber(
          policy.packageId,
          txClient,
          correlationId
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
        if (policy.customer.dependants && policy.customer.dependants.length > 0) {
          this.logger.log(
            `[${correlationId}] Creating member records for ${policy.customer.dependants.length} dependants`
          );

          for (const dependant of policy.customer.dependants) {
            const dependantMemberNumber = await this.generateMemberNumber(
              policy.packageId,
              txClient,
              correlationId
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
}

