import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_CADENCE } from '../constants/payment-cadence.constants';
import { PaymentFrequency } from '@prisma/client';
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
 */
@Injectable()
export class PolicyService {
  private readonly logger = new Logger(PolicyService.name);

  constructor(private readonly prismaService: PrismaService) {}

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
      let sequenceNumber = 1;
      if (lastPolicy && lastPolicy.policyNumber) {
        // Extract numeric part from policy number (e.g., "MP/MFG/001" -> 1, "MP/MFG/1234" -> 1234)
        const format = packageData.policyNumberFormat;
        const match = format.match(/{auto-increasing-policy-number}/);
        if (match) {
          // Try to extract number from last policy number using the format
          // Replace the format pattern with a regex capture group
          const regexPattern = format
            .replace(/{auto-increasing-policy-number}/, '(\\d+)')
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape special regex characters

          const regex = new RegExp(`^${regexPattern}$`);
          const lastMatch = lastPolicy.policyNumber.match(regex);

          if (lastMatch && lastMatch[1]) {
            sequenceNumber = parseInt(lastMatch[1], 10) + 1;
          }
        }
      }

      // Format sequence number with leading zeros (e.g., 001, 002, ..., 1234)
      const formattedSequence = sequenceNumber.toString().padStart(3, '0');

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
  private async createOrGetTags(
    tags: Array<{ id?: number; name: string }>,
    correlationId: string
  ): Promise<number[]> {
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
        select: { id: true },
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

      const plan = packageData.packagePlans[0];

      // Use transaction to ensure atomicity
      const result = await this.prismaService.$transaction(async (tx) => {
        // Double-check idempotency inside transaction to prevent race conditions
        // This ensures that even if two requests pass the initial check, only one will succeed
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

        // Generate policy number
        const policyNumber = await this.generatePolicyNumber(data.packageId, correlationId);

        // Calculate payment cadence
        const paymentCadence = this.calculatePaymentCadence(data.frequency, data.customDays);

        // Set start date (today)
        const startDate = new Date();
        startDate.setHours(0, 0, 0, 0);

        // Set end date (one year from today)
        const endDate = new Date(startDate);
        endDate.setFullYear(endDate.getFullYear() + 1);
        endDate.setHours(23, 59, 59, 999);

        // Create policy (UUID will be auto-generated by Prisma)
        const policy = await tx.policy.create({
          data: {
            policyNumber,
            status: 'PENDING_ACTIVATION',
            customerId: data.customerId,
            packageId: data.packageId,
            packagePlanId: data.packagePlanId,
            productName: data.productName,
            startDate,
            endDate,
            premium: data.premium,
            frequency: data.frequency,
            paymentCadence,
          },
        });

        // Create or get tags and associate with policy
        if (data.tags && data.tags.length > 0) {
          const tagIds = await this.createOrGetTags(data.tags, correlationId);

          // Create policy_tag associations
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
            accountNumber: data.paymentData.accountNumber || null,
            details: data.paymentData.details || null,
            expectedPaymentDate: data.paymentData.expectedPaymentDate,
            actualPaymentDate: data.paymentData.actualPaymentDate || null,
            paymentMessageBlob: data.paymentData.paymentMessageBlob || null,
          },
        });

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
}

