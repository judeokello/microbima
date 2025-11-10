import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import * as Sentry from '@sentry/nestjs';

/**
 * Payment Account Number Generation Service
 *
 * Generates unique payment account numbers for policies and schemes.
 * Uses a sequence-based approach that skips numbers containing digits 0 and 1
 * to avoid confusion with letters O, I, and L.
 *
 * Features:
 * - Generates numbers without 0 or 1 digits
 * - Auto-expands from 3 to 4 to 5 digits as needed
 * - Provides different formats for schemes (G-prefix) vs policies
 * - First policy uses customer ID, subsequent use generated numbers
 * - Transaction-safe with row-level locking
 */
@Injectable()
export class PaymentAccountNumberService {
  private readonly logger = new Logger(PaymentAccountNumberService.name);

  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Check if a number contains digits 0 or 1
   * @param num - Number to check
   * @returns True if number contains 0 or 1
   */
  private containsZeroOrOne(num: number): boolean {
    return num.toString().includes('0') || num.toString().includes('1');
  }

  /**
   * Determine the width (number of digits) for a given number
   * @param num - Number to format
   * @returns Number of digits to use
   */
  private determineWidth(num: number): number {
    if (num < 1000) return 3;
    if (num < 10000) return 4;
    if (num < 100000) return 5;
    if (num < 1000000) return 6;
    return 7; // Support up to 7 digits
  }

  /**
   * Generate the next payment account number
   * This is the core generation logic that skips numbers containing 0 or 1
   *
   * @param tx - Prisma transaction client
   * @param correlationId - Correlation ID for logging
   * @returns Next valid payment account number as string
   */
  private async generateNextNumber(
    tx: Prisma.TransactionClient,
    correlationId: string
  ): Promise<string> {
    try {
      // Lock and increment the sequence
      const result = await tx.$queryRaw<Array<{ currentValue: number }>>`
        UPDATE payment_account_number_sequences 
        SET "currentValue" = "currentValue" + 1,
            "lastUpdatedAt" = NOW()
        WHERE id = 1 
        RETURNING "currentValue"
      `;

      if (!result || result.length === 0) {
        throw new Error('Payment account number sequence not found');
      }

      let candidate = result[0].currentValue;
      this.logger.log(`[${correlationId}] Initial candidate from sequence: ${candidate}`);

      // Skip numbers containing 0 or 1
      let skippedCount = 0;
      while (this.containsZeroOrOne(candidate)) {
        candidate++;
        skippedCount++;
      }

      // If we skipped any numbers, update the sequence to the actual used value
      if (skippedCount > 0) {
        await tx.$executeRaw`
          UPDATE payment_account_number_sequences 
          SET "currentValue" = ${candidate},
              "lastUpdatedAt" = NOW()
          WHERE id = 1
        `;
        this.logger.log(
          `[${correlationId}] Skipped ${skippedCount} numbers containing 0 or 1. Using: ${candidate}`
        );
      }

      // Format with appropriate width
      const width = this.determineWidth(candidate);
      const formatted = candidate.toString().padStart(width, '2');

      this.logger.log(
        `[${correlationId}] Generated payment account number: ${formatted} (width: ${width})`
      );

      return formatted;
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error generating payment account number`,
        error instanceof Error ? error.stack : String(error)
      );
      Sentry.captureException(error, {
        tags: {
          service: 'PaymentAccountNumberService',
          operation: 'generateNextNumber',
          correlationId,
        },
      });
      throw error;
    }
  }

  /**
   * Generate payment account number for a policy
   * First policy for a customer uses their ID number
   * Subsequent policies use generated numbers
   *
   * @param customerId - Customer UUID
   * @param isFirstPolicy - Whether this is the customer's first policy
   * @param tx - Prisma transaction client
   * @param correlationId - Correlation ID for logging
   * @returns Payment account number
   */
  async generateForPolicy(
    customerId: string,
    isFirstPolicy: boolean,
    tx: Prisma.TransactionClient,
    correlationId: string
  ): Promise<string> {
    try {
      this.logger.log(
        `[${correlationId}] Generating payment account number for policy. ` +
          `Customer: ${customerId}, First policy: ${isFirstPolicy}`
      );

      if (isFirstPolicy) {
        // Use customer's ID number for first policy
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
          select: { idNumber: true },
        });

        if (!customer) {
          throw new Error(`Customer ${customerId} not found`);
        }

        this.logger.log(
          `[${correlationId}] Using customer ID number for first policy: ${customer.idNumber}`
        );

        return customer.idNumber;
      } else {
        // Generate new number for subsequent policies
        return await this.generateNextNumber(tx, correlationId);
      }
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error generating payment account number for policy`,
        error instanceof Error ? error.stack : String(error)
      );
      Sentry.captureException(error, {
        tags: {
          service: 'PaymentAccountNumberService',
          operation: 'generateForPolicy',
          correlationId,
        },
        extra: { customerId, isFirstPolicy },
      });
      throw error;
    }
  }

  /**
   * Generate payment account number for a scheme
   * Schemes always get a generated number prefixed with 'G'
   *
   * @param tx - Prisma transaction client
   * @param correlationId - Correlation ID for logging
   * @returns Payment account number with 'G' prefix
   */
  async generateForScheme(
    tx: Prisma.TransactionClient,
    correlationId: string
  ): Promise<string> {
    try {
      this.logger.log(`[${correlationId}] Generating payment account number for scheme`);

      const number = await this.generateNextNumber(tx, correlationId);
      const schemeNumber = `G${number}`;

      this.logger.log(`[${correlationId}] Generated scheme payment account number: ${schemeNumber}`);

      return schemeNumber;
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error generating payment account number for scheme`,
        error instanceof Error ? error.stack : String(error)
      );
      Sentry.captureException(error, {
        tags: {
          service: 'PaymentAccountNumberService',
          operation: 'generateForScheme',
          correlationId,
        },
      });
      throw error;
    }
  }

  /**
   * Check if a customer has any existing policies
   *
   * @param customerId - Customer UUID
   * @param tx - Prisma transaction client (optional)
   * @param correlationId - Correlation ID for logging
   * @returns True if customer has existing policies
   */
  async customerHasExistingPolicies(
    customerId: string,
    tx: Prisma.TransactionClient | null,
    correlationId: string
  ): Promise<boolean> {
    try {
      const prisma = tx || this.prismaService;

      const policyCount = await prisma.policy.count({
        where: { customerId },
      });

      const hasExisting = policyCount > 0;
      this.logger.log(
        `[${correlationId}] Customer ${customerId} has ${policyCount} existing policies`
      );

      return hasExisting;
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error checking customer policies`,
        error instanceof Error ? error.stack : String(error)
      );
      Sentry.captureException(error, {
        tags: {
          service: 'PaymentAccountNumberService',
          operation: 'customerHasExistingPolicies',
          correlationId,
        },
        extra: { customerId },
      });
      throw error;
    }
  }
}

