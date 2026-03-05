import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import * as Sentry from '@sentry/nestjs';

/**
 * Letters for policy payment account suffix (2nd policy = B, 3rd = C, ...).
 * Excludes A, I, J, O to avoid confusion with numbers and readability.
 */
const POLICY_SUFFIX_LETTERS = 'BCDEFGHKLMNPQRSTUVWXYZ';

/**
 * Payment Account Number Generation Service
 *
 * Generates unique payment account numbers for policies and schemes.
 * Policies: first policy uses customer idNumber; 2nd+ use idNumber + letter (B, C, ...).
 * Schemes: G + first 2 digits + N + rest (e.g. G12N345), skipping numbers that conflict with idNumber or policy paymentAcNumber.
 * Sequence-based scheme numbers skip digits 0 and 1.
 */
@Injectable()
export class PaymentAccountNumberService {
  private readonly logger = new Logger(PaymentAccountNumberService.name);

  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Get letter suffix for (n+1)th policy: index 0 = B (2nd), 1 = C (3rd), ... 21 = Z, 22+ = two letters (e.g. BB, BC).
   */
  private getPolicySuffixLetter(index: number): string {
    const n = POLICY_SUFFIX_LETTERS.length;
    if (index < n) return POLICY_SUFFIX_LETTERS[index];
    const i = index - n;
    const first = Math.floor(i / n);
    const second = i % n;
    return POLICY_SUFFIX_LETTERS[first] + POLICY_SUFFIX_LETTERS[second];
  }

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
   * First policy: customer idNumber. Subsequent: idNumber + letter (B, C, D, ... excluding A, I, J, O).
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

      const customer = await tx.customer.findUnique({
        where: { id: customerId },
        select: { idNumber: true },
      });

      if (!customer) {
        throw new Error(`Customer ${customerId} not found`);
      }

      const idNumber = customer.idNumber?.trim() ?? '';
      if (!idNumber) {
        throw new Error(`Customer ${customerId} has no idNumber`);
      }

      if (isFirstPolicy) {
        this.logger.log(
          `[${correlationId}] Using customer ID number for first policy: ${idNumber}`
        );
        return idNumber;
      }

      const existingCount = await tx.policy.count({
        where: { customerId },
      });
      const suffix = this.getPolicySuffixLetter(existingCount);
      const paymentAcNumber = idNumber + suffix;
      this.logger.log(
        `[${correlationId}] Using idNumber + suffix for policy ${existingCount + 1}: ${paymentAcNumber}`
      );
      return paymentAcNumber;
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
   * Format scheme number as G + first 2 digits + N + remaining digits (e.g. 12345 -> G12N345).
   */
  private formatSchemeNumber(numStr: string): string {
    if (numStr.length < 2) return `GN${numStr}`;
    return `G${numStr.slice(0, 2)}N${numStr.slice(2)}`;
  }

  /**
   * Check if the numeric string is already used as customers.idNumber or policies.paymentAcNumber.
   */
  private async numericConflictsWithIdOrPolicy(
    numStr: string,
    tx: Prisma.TransactionClient
  ): Promise<boolean> {
    const normalized = numStr.trim().replace(/\s/g, '');
    if (!normalized) return false;

    const [customerMatch, policyMatch] = await Promise.all([
      tx.customer.findFirst({
        where: { idNumber: normalized },
        select: { id: true },
      }),
      tx.policy.findFirst({
        where: { paymentAcNumber: normalized },
        select: { id: true },
      }),
    ]);

    return !!(customerMatch || policyMatch);
  }

  /**
   * Generate payment account number for a scheme.
   * Format: G + first 2 digits + N + rest (e.g. G12N345).
   * Skips numbers that exist as customers.idNumber or policies.paymentAcNumber.
   */
  async generateForScheme(
    tx: Prisma.TransactionClient,
    correlationId: string
  ): Promise<string> {
    try {
      this.logger.log(`[${correlationId}] Generating payment account number for scheme`);

      const maxAttempts = 100;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const number = await this.generateNextNumber(tx, correlationId);
        const conflicts = await this.numericConflictsWithIdOrPolicy(number, tx);
        if (!conflicts) {
          const schemeNumber = this.formatSchemeNumber(number);
          this.logger.log(
            `[${correlationId}] Generated scheme payment account number: ${schemeNumber}`
          );
          return schemeNumber;
        }
        this.logger.log(
          `[${correlationId}] Skipping ${number} (conflicts with idNumber or policy paymentAcNumber), attempt ${attempt + 1}`
        );
      }

      throw new Error(
        `Failed to generate scheme payment account number after ${maxAttempts} attempts (all conflicted with idNumber or policy)`
      );
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
   * Check if a value is already used as customers.idNumber or policies.paymentAcNumber by another customer or policy.
   * Use when validating a new idNumber or new paymentAcNumber (e.g. on customer idNumber update).
   *
   * @param value - Payment account number or idNumber to check (trimmed)
   * @param excludeCustomerId - When provided, exclude this customer's idNumber and their policies' paymentAcNumber from the check
   * @returns True if the value is in use elsewhere (another customer or another customer's policy)
   */
  async isPaymentAcNumberOrIdNumberInUse(
    value: string,
    excludeCustomerId?: string
  ): Promise<boolean> {
    const normalized = value?.trim().replace(/\s/g, '') ?? '';
    if (!normalized) return false;

    const [customerMatch, policyMatch] = await Promise.all([
      this.prismaService.customer.findFirst({
        where: {
          idNumber: normalized,
          ...(excludeCustomerId ? { id: { not: excludeCustomerId } } : {}),
        },
        select: { id: true },
      }),
      this.prismaService.policy.findFirst({
        where: {
          paymentAcNumber: normalized,
          ...(excludeCustomerId ? { customerId: { not: excludeCustomerId } } : {}),
        },
        select: { id: true },
      }),
    ]);

    return !!(customerMatch || policyMatch);
  }

  /**
   * Compute the new policy paymentAcNumber when a customer's idNumber changes.
   * Replaces the numeric part (oldIdNumber) with newIdNumber and keeps the existing suffix unchanged.
   *
   * @param oldIdNumber - Current customer idNumber (before update)
   * @param newIdNumber - New customer idNumber (after update)
   * @param currentPaymentAcNumber - Policy's current paymentAcNumber
   * @returns New paymentAcNumber (newIdNumber or newIdNumber + existing suffix)
   */
  computePaymentAcNumberAfterIdNumberChange(
    oldIdNumber: string,
    newIdNumber: string,
    currentPaymentAcNumber: string | null
  ): string {
    const old = (oldIdNumber ?? '').trim();
    const next = (newIdNumber ?? '').trim();
    const current = (currentPaymentAcNumber ?? '').trim();
    if (!current) return next;
    if (!old) return next; // First time setting idNumber: use new idNumber only
    if (current === old) return next;
    if (current.startsWith(old)) return next + current.slice(old.length);
    return next;
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
      const prisma = tx ?? this.prismaService;

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

