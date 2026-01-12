import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PolicyService } from './policy.service';
import { MpesaIpnPayloadDto, MpesaIpnResponseDto } from '../dto/mpesa-ipn/mpesa-ipn.dto';
import { normalizePhoneNumber } from '../utils/phone-number.util';
import { MpesaStatementReasonType, MpesaPaymentSource, MpesaStkPushStatus, MpesaStkPushRequest, MpesaPaymentReportItem, PolicyPayment } from '@prisma/client';
import { ValidationException } from '../exceptions/validation.exception';
import * as Sentry from '@sentry/nestjs';

/**
 * M-Pesa IPN Service
 *
 * Handles Instant Payment Notification (IPN) processing from M-Pesa Daraja API.
 * Processes payment notifications in real-time and creates payment records immediately.
 */
@Injectable()
export class MpesaIpnService {
  private readonly logger = new Logger(MpesaIpnService.name);

  constructor(
    private readonly prismaService: PrismaService,
    @Inject(forwardRef(() => PolicyService))
    private readonly policyService: PolicyService
  ) {}

  /**
   * Process IPN notification from M-Pesa
   *
   * Always returns success (ResultCode: 0) to prevent M-Pesa retries.
   * Errors are logged internally for investigation.
   *
   * @param payload - IPN payload from M-Pesa
   * @param correlationId - Correlation ID for request tracing
   * @returns Success response to M-Pesa
   */
  async processIpnNotification(
    payload: MpesaIpnPayloadDto,
    correlationId: string
  ): Promise<MpesaIpnResponseDto> {
    const startTime = Date.now();

    try {
      // Log IPN received with full payload details
      this.logger.log(
        JSON.stringify({
          event: 'IPN_RECEIVED',
          correlationId,
          transactionId: payload.TransID,
          transactionType: payload.TransactionType,
          amount: payload.TransAmount,
          accountReference: payload.BillRefNumber,
          phoneNumber: payload.MSISDN,
          timestamp: new Date().toISOString(),
        })
      );

      // Metric: IPN notifications received
      this.logger.log(
        JSON.stringify({
          event: 'METRIC_IPN_RECEIVED',
          metricType: 'counter',
          metricName: 'ipn_notifications_received',
          value: 1,
          correlationId,
          timestamp: new Date().toISOString(),
        })
      );

      // Parse and normalize data
      const normalizedPhone = normalizePhoneNumber(payload.MSISDN);
      const amount = parseFloat(payload.TransAmount);
      const transactionTime = this.parseTransactionTime(payload.TransTime);
      const reasonType = this.mapTransactionTypeToReasonType(payload.TransactionType);

      // Check for duplicate in policy_payments first (idempotency)
      const existingPolicyPayment = await this.prismaService.policyPayment.findFirst({
        where: {
          transactionReference: payload.TransID,
        },
      });

      // Check for existing IPN record
      const existingIpnRecord = await this.prismaService.mpesaPaymentReportItem.findFirst({
        where: {
          transactionReference: payload.TransID,
          source: MpesaPaymentSource.IPN,
        },
      });

      // If both records exist, update them idempotently
      if (existingPolicyPayment && existingIpnRecord) {
        this.logger.log(
          JSON.stringify({
            event: 'IPN_DUPLICATE',
            correlationId,
            transactionId: payload.TransID,
            message: 'Duplicate IPN notification - updating existing records',
            timestamp: new Date().toISOString(),
          })
        );

        await this.updateExistingRecords(
          existingIpnRecord.id,
          existingPolicyPayment.id,
          payload,
          normalizedPhone,
          amount,
          transactionTime,
          reasonType,
          correlationId
        );

        const processingTime = Date.now() - startTime;

        // Determine processing time bucket for histogram
        let processingTimeBucket: string;
        if (processingTime < 1000) {
          processingTimeBucket = '<1s';
        } else if (processingTime < 2000) {
          processingTimeBucket = '<2s';
        } else if (processingTime < 5000) {
          processingTimeBucket = '<5s';
        } else if (processingTime < 10000) {
          processingTimeBucket = '<10s';
        } else {
          processingTimeBucket = '>10s';
        }

        // Success logging with key details
        this.logger.log(
          JSON.stringify({
            event: 'IPN_PROCESSED',
            correlationId,
            transactionId: payload.TransID,
            status: 'updated',
            keyDetails: {
              amount: payload.TransAmount,
              accountReference: payload.BillRefNumber,
              phoneNumber: payload.MSISDN,
              transactionType: payload.TransactionType,
            },
            processingTime,
            timestamp: new Date().toISOString(),
          })
        );

        // Metric: IPN notifications processed successfully
        this.logger.log(
          JSON.stringify({
            event: 'METRIC_IPN_PROCESSED_SUCCESS',
            metricType: 'counter',
            metricName: 'ipn_notifications_processed_successfully',
            value: 1,
            correlationId,
            timestamp: new Date().toISOString(),
          })
        );

        // Metric: IPN processing time histogram
        this.logger.log(
          JSON.stringify({
            event: 'METRIC_IPN_PROCESSING_TIME',
            metricType: 'histogram',
            metricName: 'ipn_processing_time_ms',
            value: processingTime,
            bucket: processingTimeBucket,
            correlationId,
            timestamp: new Date().toISOString(),
          })
        );

        return { ResultCode: 0, ResultDesc: 'Accepted' };
      }

      // Process new IPN notification
      await this.processNewIpnNotification(
        payload,
        normalizedPhone,
        amount,
        transactionTime,
        reasonType,
        correlationId,
        existingPolicyPayment,
        existingIpnRecord
      );

      const processingTime = Date.now() - startTime;

      // Determine processing time bucket for histogram
      let processingTimeBucket: string;
      if (processingTime < 1000) {
        processingTimeBucket = '<1s';
      } else if (processingTime < 2000) {
        processingTimeBucket = '<2s';
      } else if (processingTime < 5000) {
        processingTimeBucket = '<5s';
      } else if (processingTime < 10000) {
        processingTimeBucket = '<10s';
      } else {
        processingTimeBucket = '>10s';
      }

      // Success logging with key details
      this.logger.log(
        JSON.stringify({
          event: 'IPN_PROCESSED',
          correlationId,
          transactionId: payload.TransID,
          status: 'created',
          keyDetails: {
            amount: payload.TransAmount,
            accountReference: payload.BillRefNumber,
            phoneNumber: payload.MSISDN,
            transactionType: payload.TransactionType,
          },
          processingTime,
          timestamp: new Date().toISOString(),
        })
      );

      // Metric: IPN notifications processed successfully
      this.logger.log(
        JSON.stringify({
          event: 'METRIC_IPN_PROCESSED_SUCCESS',
          metricType: 'counter',
          metricName: 'ipn_notifications_processed_successfully',
          value: 1,
          correlationId,
          timestamp: new Date().toISOString(),
        })
      );

      // Metric: IPN processing time histogram
      this.logger.log(
        JSON.stringify({
          event: 'METRIC_IPN_PROCESSING_TIME',
          metricType: 'histogram',
          metricName: 'ipn_processing_time_ms',
          value: processingTime,
          bucket: processingTimeBucket,
          correlationId,
          timestamp: new Date().toISOString(),
        })
      );

      return { ResultCode: 0, ResultDesc: 'Accepted' };
    } catch (error) {
      // Always return success to M-Pesa, but log error internally
      const processingTime = Date.now() - startTime;

      // Determine error type
      const errorType = error instanceof ValidationException
        ? 'VALIDATION_ERROR'
        : error instanceof Error && error.name === 'PrismaClientKnownRequestError'
        ? 'DATABASE_ERROR'
        : error instanceof Error
        ? error.constructor.name
        : 'UNKNOWN_ERROR';

      // Enhanced error logging with full context
      this.logger.error(
        JSON.stringify({
          event: 'IPN_PROCESSING_ERROR',
          correlationId,
          transactionId: payload.TransID,
          errorType,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          transactionDetails: {
            transactionId: payload.TransID,
            transactionType: payload.TransactionType,
            amount: payload.TransAmount,
            accountReference: payload.BillRefNumber,
            phoneNumber: payload.MSISDN,
          },
          requestPayload: payload,
          responsePayload: { ResultCode: 0, ResultDesc: 'Accepted' }, // Always return success to M-Pesa
          processingTime,
          timestamp: new Date().toISOString(),
        })
      );

      Sentry.captureException(error, {
        tags: {
          service: 'MpesaIpnService',
          operation: 'processIpnNotification',
          correlationId,
        },
        extra: {
          payload,
          processingTime,
        },
      });

      // Return success to prevent M-Pesa retries
      return { ResultCode: 0, ResultDesc: 'Accepted' };
    }
  }

  /**
   * Process new IPN notification (not a duplicate)
   */
  private async processNewIpnNotification(
    payload: MpesaIpnPayloadDto,
    normalizedPhone: string,
    amount: number,
    transactionTime: Date,
    reasonType: MpesaStatementReasonType,
    correlationId: string,
    existingPolicyPayment: PolicyPayment | null,
    _existingIpnRecord: MpesaPaymentReportItem | null
  ): Promise<void> {
    // Always create MpesaPaymentReportItem record
    const ipnRecord = await this.prismaService.mpesaPaymentReportItem.create({
      data: {
        mpesaPaymentReportUploadId: null, // IPN records don't have upload ID
        transactionReference: payload.TransID,
        completionTime: transactionTime,
        initiationTime: transactionTime, // IPN doesn't provide separate initiation time
        paymentDetails: payload.TransactionType,
        transactionStatus: 'Completed', // IPN notifications are for completed transactions
        paidIn: amount, // All IPN transactions are incoming payments
        withdrawn: 0,
        accountBalance: payload.OrgAccountBalance ? parseFloat(payload.OrgAccountBalance) : 0,
        balanceConfirmed: null,
        reasonType,
        otherPartyInfo: null,
        linkedTransactionId: null,
        accountNumber: payload.BillRefNumber ?? null,
        source: MpesaPaymentSource.IPN,
        msisdn: normalizedPhone,
        firstName: payload.FirstName ?? null,
        middleName: payload.MiddleName ?? null,
        lastName: payload.LastName ?? null,
        businessShortCode: payload.BusinessShortCode,
        mpesaStkPushRequestId: null, // Will be set if linked to STK Push
      },
    });

    // Attempt to link to STK Push request
    let stkPushRequest = null;
    if (payload.BillRefNumber) {
      stkPushRequest = await this.linkToStkPushRequest(
        ipnRecord,
        payload.BillRefNumber,
        normalizedPhone,
        amount,
        correlationId
      );
    }

    // Determine payment record creation logic based on STK Push match
    const shouldCreatePolicyPayment = await this.shouldCreatePolicyPaymentRecord(
      stkPushRequest,
      existingPolicyPayment,
      correlationId
    );

    if (shouldCreatePolicyPayment) {
      await this.createPolicyPaymentRecord(
        payload,
        normalizedPhone,
        amount,
        transactionTime,
        correlationId
      );
    } else {
      this.logger.log(
        JSON.stringify({
          event: 'IPN_SKIP_POLICY_PAYMENT',
          correlationId,
          transactionId: payload.TransID,
          reason: stkPushRequest
            ? 'STK Push already created policy payment (COMPLETED)'
            : 'No account reference',
          timestamp: new Date().toISOString(),
        })
      );
    }
  }

  /**
   * Determine if policy payment record should be created
   */
  private async shouldCreatePolicyPaymentRecord(
    stkPushRequest: MpesaStkPushRequest | null,
    existingPolicyPayment: PolicyPayment | null,
    _correlationId: string
  ): Promise<boolean> {
    // If policy payment already exists, don't create
    if (existingPolicyPayment) {
      return false;
    }

    // If STK Push is COMPLETED, skip (STK Push callback already created payment record)
    if (stkPushRequest && stkPushRequest.status === MpesaStkPushStatus.COMPLETED) {
      return false;
    }

    // If STK Push is PENDING, create (IPN arrived first)
    if (stkPushRequest && stkPushRequest.status === MpesaStkPushStatus.PENDING) {
      return true;
    }

    // If no STK Push match, create (will validate account reference)
    return true;
  }

  /**
   * Create policy payment record
   *
   * If a placeholder payment exists (transactionReference starts with "PENDING-STK-"),
   * it will be updated with the real transaction reference and payment data.
   * Otherwise, a new payment record is created.
   */
  private async createPolicyPaymentRecord(
    payload: MpesaIpnPayloadDto,
    normalizedPhone: string,
    amount: number,
    transactionTime: Date,
    correlationId: string
  ): Promise<void> {
    if (!payload.BillRefNumber) {
      this.logger.warn(
        JSON.stringify({
          event: 'IPN_NO_ACCOUNT_REFERENCE',
          correlationId,
          transactionId: payload.TransID,
          message: 'No account reference (BillRefNumber) - cannot create policy payment',
          timestamp: new Date().toISOString(),
        })
      );
      return;
    }

    // Find policy by payment account number (including status for activation check)
    const policy = await this.prismaService.policy.findFirst({
      where: {
        paymentAcNumber: payload.BillRefNumber,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!policy) {
      this.logger.warn(
        JSON.stringify({
          event: 'IPN_POLICY_NOT_FOUND',
          correlationId,
          transactionId: payload.TransID,
          accountReference: payload.BillRefNumber,
          message: 'Policy not found for account reference - payment record not created',
          timestamp: new Date().toISOString(),
        })
      );
      return;
    }

    // Check for duplicate transaction reference in policy_payments (real transaction ID)
    const existingPayment = await this.prismaService.policyPayment.findFirst({
      where: {
        transactionReference: payload.TransID,
      },
    });

    if (existingPayment) {
      this.logger.log(
        JSON.stringify({
          event: 'IPN_POLICY_PAYMENT_EXISTS',
          correlationId,
          transactionId: payload.TransID,
          message: 'Policy payment already exists - skipping creation',
          timestamp: new Date().toISOString(),
        })
      );
      return;
    }

    // Check for placeholder payment (transactionReference starts with "PENDING-STK-")
    const placeholderPayment = await this.prismaService.policyPayment.findFirst({
      where: {
        policyId: policy.id,
        transactionReference: {
          startsWith: 'PENDING-STK-',
        },
        // Only update if actualPaymentDate is null (payment hasn't completed yet)
        actualPaymentDate: null,
      },
    });

    if (placeholderPayment) {
      // Update placeholder payment with real transaction reference and payment data
      await this.prismaService.policyPayment.update({
        where: { id: placeholderPayment.id },
        data: {
          transactionReference: payload.TransID, // Update with real transaction reference
          amount,
          accountNumber: normalizedPhone,
          details: `IPN payment - ${payload.TransactionType}`,
          expectedPaymentDate: transactionTime, // transactionTime is already in UTC from IPN parsing
          actualPaymentDate: transactionTime, // Mark as paid
          paymentMessageBlob: JSON.stringify({
            firstName: payload.FirstName,
            middleName: payload.MiddleName,
            lastName: payload.LastName,
            businessShortCode: payload.BusinessShortCode,
            originalPlaceholderRef: placeholderPayment.transactionReference, // Keep record of original placeholder
          }),
        },
      });

      this.logger.log(
        JSON.stringify({
          event: 'IPN_PLACEHOLDER_PAYMENT_UPDATED',
          correlationId,
          transactionId: payload.TransID,
          policyId: policy.id,
          placeholderPaymentId: placeholderPayment.id,
          originalPlaceholderRef: placeholderPayment.transactionReference,
          accountReference: payload.BillRefNumber,
          message: 'Placeholder payment updated with real transaction reference',
          timestamp: new Date().toISOString(),
        })
      );
    } else {
      // No placeholder payment found - create new payment record
      await this.prismaService.policyPayment.create({
        data: {
          policyId: policy.id,
          paymentType: 'MPESA',
          transactionReference: payload.TransID,
          amount,
          accountNumber: normalizedPhone,
          details: `IPN payment - ${payload.TransactionType}`,
          expectedPaymentDate: transactionTime, // transactionTime is already in UTC from IPN parsing
          actualPaymentDate: transactionTime,
          paymentMessageBlob: JSON.stringify({
            firstName: payload.FirstName,
            middleName: payload.MiddleName,
            lastName: payload.LastName,
            businessShortCode: payload.BusinessShortCode,
          }),
        },
      });

      this.logger.log(
        JSON.stringify({
          event: 'IPN_POLICY_PAYMENT_CREATED',
          correlationId,
          transactionId: payload.TransID,
          policyId: policy.id,
          accountReference: payload.BillRefNumber,
          message: 'New policy payment record created',
          timestamp: new Date().toISOString(),
        })
      );
    }

    // Activate policy if it's in PENDING_ACTIVATION status
    if (policy.status === 'PENDING_ACTIVATION') {
      try {
        await this.policyService.activatePolicy(policy.id, correlationId);
        this.logger.log(
          JSON.stringify({
            event: 'IPN_POLICY_ACTIVATED',
            correlationId,
            transactionId: payload.TransID,
            policyId: policy.id,
            accountReference: payload.BillRefNumber,
            timestamp: new Date().toISOString(),
          })
        );
      } catch (activationError) {
        // Log error but don't fail - payment record was created successfully
        this.logger.error(
          JSON.stringify({
            event: 'IPN_POLICY_ACTIVATION_FAILED',
            correlationId,
            transactionId: payload.TransID,
            policyId: policy.id,
            error: activationError instanceof Error ? activationError.message : String(activationError),
            timestamp: new Date().toISOString(),
          })
        );
      }
    }
  }

  /**
   * Link IPN transaction to STK Push request
   */
  private async linkToStkPushRequest(
    ipnRecord: MpesaPaymentReportItem,
    accountReference: string,
    phoneNumber: string,
    amount: number,
    correlationId: string
  ): Promise<MpesaStkPushRequest | null> {
    // Calculate time window: 24 hours + 5 minutes buffer (UTC)
    const now = new Date();
    const windowStart = new Date(now.getTime() - (24 * 60 * 60 * 1000 + 5 * 60 * 1000)); // 24h 5m ago

    // Query for matching STK Push request
    const matchingRequests = await this.prismaService.mpesaStkPushRequest.findMany({
      where: {
        accountReference,
        phoneNumber,
        amount: {
          equals: amount, // Exact match, 0.00 tolerance
        },
        status: {
          in: [MpesaStkPushStatus.PENDING, MpesaStkPushStatus.COMPLETED],
        },
        initiatedAt: {
          gte: windowStart, // Within 24 hours + 5 minutes
        },
      },
      orderBy: {
        initiatedAt: 'desc', // Most recent first
      },
      take: 1, // Get only the most recent match
    });

    if (matchingRequests.length === 0) {
      // Check if there are any STK Push requests for this account reference (to distinguish match attempted vs not attempted)
      const anyStkPushForAccount = await this.prismaService.mpesaStkPushRequest.findFirst({
        where: {
          accountReference,
        },
        orderBy: {
          initiatedAt: 'desc',
        },
      });

      if (anyStkPushForAccount) {
        // Match attempted but failed (likely time window expired or amount/phone mismatch)
        const timeSinceStkPush = Date.now() - anyStkPushForAccount.initiatedAt.getTime();
        const hoursSinceStkPush = timeSinceStkPush / (1000 * 60 * 60);

        if (hoursSinceStkPush > 24) {
          // Time window expired
          this.logger.error(
            JSON.stringify({
              event: 'IPN_TIME_WINDOW_EXPIRED',
              correlationId,
              transactionId: ipnRecord.transactionReference,
              accountReference,
              phoneNumber,
              amount,
              stkPushRequestId: anyStkPushForAccount.id,
              stkPushInitiatedAt: anyStkPushForAccount.initiatedAt.toISOString(),
              hoursSinceStkPush: Math.round(hoursSinceStkPush * 100) / 100,
              message: 'STK Push request exists but time window expired (24 hours)',
              timestamp: new Date().toISOString(),
            })
          );
        }

        // Metric: Unmatched IPN (match attempted but failed)
        this.logger.log(
          JSON.stringify({
            event: 'METRIC_IPN_UNMATCHED',
            metricType: 'counter',
            metricName: 'ipn_unmatched_attempted',
            value: 1,
            reason: hoursSinceStkPush > 24 ? 'time_window_expired' : 'criteria_mismatch',
            correlationId,
            timestamp: new Date().toISOString(),
          })
        );
      } else {
        // No STK Push exists for this account reference (normal case - no match attempted)
        // Metric: Unmatched IPN (no match attempted)
        this.logger.log(
          JSON.stringify({
            event: 'METRIC_IPN_UNMATCHED',
            metricType: 'counter',
            metricName: 'ipn_unmatched_no_attempt',
            value: 1,
            reason: 'no_stk_push_exists',
            correlationId,
            timestamp: new Date().toISOString(),
          })
        );
      }

      // Do NOT log at INFO/ERROR level when no match found (normal case)
      // Only log at DEBUG level for debugging purposes
      this.logger.debug(
        JSON.stringify({
          event: 'IPN_NO_STK_PUSH_MATCH',
          correlationId,
          transactionId: ipnRecord.transactionReference,
          accountReference,
          phoneNumber,
          amount,
          message: 'No STK Push request found for matching',
          timestamp: new Date().toISOString(),
        })
      );
      return null;
    }

    const stkPushRequest = matchingRequests[0];

    // Handle multiple matches (shouldn't happen with take: 1, but log if it does)
    if (matchingRequests.length > 1) {
      this.logger.warn(
        JSON.stringify({
          event: 'IPN_MULTIPLE_STK_PUSH_MATCHES',
          correlationId,
          transactionId: ipnRecord.transactionReference,
          accountReference,
          phoneNumber,
          amount,
          matchCount: matchingRequests.length,
          message: 'Multiple STK Push requests matched - using most recent',
          timestamp: new Date().toISOString(),
        })
      );
    }

    // Update IPN record with STK Push link
    await this.prismaService.mpesaPaymentReportItem.update({
      where: { id: ipnRecord.id },
      data: {
        mpesaStkPushRequestId: stkPushRequest.id,
      },
    });

    // Update STK Push request with linked transaction
    await this.prismaService.mpesaStkPushRequest.update({
      where: { id: stkPushRequest.id },
      data: {
        linkedTransactionId: ipnRecord.transactionReference,
        // If STK Push was PENDING, update status (IPN confirms payment)
        ...(stkPushRequest.status === MpesaStkPushStatus.PENDING && {
          status: MpesaStkPushStatus.COMPLETED,
          completedAt: new Date(),
        }),
      },
    });

    // Log matching operation as separate event
    this.logger.log(
      JSON.stringify({
        event: 'STK_PUSH_LINKED',
        correlationId,
        transactionId: ipnRecord.transactionReference,
        stkPushRequestId: stkPushRequest.id,
        accountReference,
        phoneNumber,
        amount,
        stkPushStatus: stkPushRequest.status,
        timestamp: new Date().toISOString(),
      })
    );

    // Metric: STK Push to IPN matches found
    this.logger.log(
      JSON.stringify({
        event: 'METRIC_STK_PUSH_IPN_MATCH_FOUND',
        metricType: 'counter',
        metricName: 'stk_push_ipn_matches_found',
        value: 1,
        correlationId,
        timestamp: new Date().toISOString(),
      })
    );

    return stkPushRequest;
  }

  /**
   * Update existing records (idempotent handling)
   */
  private async updateExistingRecords(
    ipnRecordId: string,
    policyPaymentId: number,
    payload: MpesaIpnPayloadDto,
    normalizedPhone: string,
    amount: number,
    transactionTime: Date,
    _reasonType: MpesaStatementReasonType,
    _correlationId: string
  ): Promise<void> {
    // Update IPN record
    await this.prismaService.mpesaPaymentReportItem.update({
      where: { id: ipnRecordId },
      data: {
        completionTime: transactionTime,
        initiationTime: transactionTime,
        paidIn: amount,
        msisdn: normalizedPhone,
        firstName: payload.FirstName ?? null,
        middleName: payload.MiddleName ?? null,
        lastName: payload.LastName ?? null,
        businessShortCode: payload.BusinessShortCode,
      },
    });

    // Update policy payment record
    await this.prismaService.policyPayment.update({
      where: { id: policyPaymentId },
      data: {
        amount,
        actualPaymentDate: transactionTime,
      },
    });
  }

  /**
   * Map M-Pesa transaction type to internal reason type
   */
  private mapTransactionTypeToReasonType(transactionType: string): MpesaStatementReasonType {
    const normalized = transactionType.trim();

    // Map M-Pesa Daraja API transaction types
    if (normalized === 'Pay Bill') {
      return MpesaStatementReasonType.PayBill_STK;
    }
    if (normalized === 'Buy Goods') {
      return MpesaStatementReasonType.PayBill_STK; // Or appropriate based on business logic
    }
    if (normalized === 'CustomerPayBillOnline') {
      return MpesaStatementReasonType.Paybill_MobileApp;
    }

    // Default to Unmapped for unknown transaction types
    return MpesaStatementReasonType.Unmapped;
  }

  /**
   * Parse transaction time from M-Pesa format (YYYYMMDDHHmmss)
   */
  private parseTransactionTime(transTime: string): Date {
    // Format: YYYYMMDDHHmmss (e.g., "20250127143045")
    if (transTime.length !== 14) {
      // Invalid format, use current time
      return new Date();
    }

    const year = parseInt(transTime.substring(0, 4), 10);
    const month = parseInt(transTime.substring(4, 6), 10) - 1; // Month is 0-indexed
    const day = parseInt(transTime.substring(6, 8), 10);
    const hours = parseInt(transTime.substring(8, 10), 10);
    const minutes = parseInt(transTime.substring(10, 12), 10);
    const seconds = parseInt(transTime.substring(12, 14), 10);

    // Use UTC to avoid timezone issues
    return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
  }
}

