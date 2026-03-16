import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PolicyService } from './policy.service';
import { MpesaIpnPayloadDto, MpesaIpnResponseDto } from '../dto/mpesa-ipn/mpesa-ipn.dto';
import { normalizeMsisdnOrReturnRaw } from '../utils/phone-number.util';
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

      // Idempotency: check for existing IPN record by TransID (no parsing required)
      const existingIpnRecord = await this.prismaService.mpesaPaymentReportItem.findFirst({
        where: {
          transactionReference: payload.TransID,
          source: MpesaPaymentSource.IPN,
        },
      });

      const existingPolicyPayment = await this.prismaService.policyPayment.findFirst({
        where: {
          transactionReference: payload.TransID,
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

        const msisdnResult = normalizeMsisdnOrReturnRaw(payload.MSISDN);
        const amount = parseFloat(payload.TransAmount);
        const transactionTime = this.parseTransactionTime(payload.TransTime);
        const reasonType = this.mapTransactionTypeToReasonType(payload.TransactionType);
        await this.updateExistingRecords(
          existingIpnRecord.id,
          existingPolicyPayment.id,
          payload,
          msisdnResult.value,
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

      // Process IPN: insert blob first if new, then parse and update (Option A)
      await this.processNewOrExistingIpnNotification(
        payload,
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
   * Process new or existing IPN: insert blob first if no existing record, then parse and update (Option A).
   * When existingIpnRecord exists (e.g. previous run failed after insert), use it and avoid duplicate insert.
   */
  private async processNewOrExistingIpnNotification(
    payload: MpesaIpnPayloadDto,
    correlationId: string,
    existingPolicyPayment: PolicyPayment | null,
    existingIpnRecord: MpesaPaymentReportItem | null
  ): Promise<void> {
    let ipnRecord: MpesaPaymentReportItem;

    if (existingIpnRecord) {
      ipnRecord = existingIpnRecord;
    } else {
      // 1. Insert with messageBlob and transactionReference (so idempotency by TransID works)
      ipnRecord = await this.prismaService.mpesaPaymentReportItem.create({
        data: {
          messageBlob: JSON.stringify(payload),
          transactionReference: payload.TransID,
          source: MpesaPaymentSource.IPN,
        },
      });
    }

    try {
      // 2. Parse payload (may throw for invalid data)
      const amount = parseFloat(payload.TransAmount);
      const transactionTime = this.parseTransactionTime(payload.TransTime);
      const reasonType = this.mapTransactionTypeToReasonType(payload.TransactionType);
      const msisdnResult = normalizeMsisdnOrReturnRaw(payload.MSISDN);
      const msisdnForStorage = msisdnResult.value; // normalized phone or raw hash

      // 3. Update row with parsed fields and set isProcessed = true
      await this.prismaService.mpesaPaymentReportItem.update({
        where: { id: ipnRecord.id },
        data: {
          transactionReference: payload.TransID,
          completionTime: transactionTime,
          initiationTime: transactionTime,
          paymentDetails: payload.TransactionType,
          transactionStatus: 'Completed',
          paidIn: amount,
          withdrawn: 0,
          accountBalance: payload.OrgAccountBalance ? parseFloat(payload.OrgAccountBalance) : 0,
          balanceConfirmed: null,
          reasonType,
          otherPartyInfo: null,
          linkedTransactionId: null,
          accountNumber: payload.BillRefNumber ?? null,
          msisdn: msisdnForStorage,
          firstName: payload.FirstName ?? null,
          middleName: payload.MiddleName ?? null,
          lastName: payload.LastName ?? null,
          businessShortCode: payload.BusinessShortCode,
          mpesaStkPushRequestId: null,
          isProcessed: true,
        },
      });

      // Reload so we have latest for linkToStkPushRequest
      const updatedRecord = await this.prismaService.mpesaPaymentReportItem.findUniqueOrThrow({
        where: { id: ipnRecord.id },
      });

      // 4. Attempt to link to STK Push request (msisdnForStorage may be phone or hash; match may fail when hash)
      let stkPushRequest: MpesaStkPushRequest | null = null;
      if (payload.BillRefNumber) {
        stkPushRequest = await this.linkToStkPushRequest(
          updatedRecord,
          payload.BillRefNumber,
          msisdnForStorage,
          amount,
          correlationId
        );
      }

      // 5. Create/update policy_payment when appropriate; use customer.idNumber for accountNumber
      const shouldCreatePolicyPayment = await this.shouldCreatePolicyPaymentRecord(
        stkPushRequest,
        existingPolicyPayment,
        correlationId
      );

      if (shouldCreatePolicyPayment) {
        const mapped = await this.createPolicyPaymentRecord(
          payload,
          amount,
          transactionTime,
          correlationId
        );
        if (mapped) {
          await this.prismaService.mpesaPaymentReportItem.update({
            where: { id: ipnRecord.id },
            data: { isMapped: true },
          });
        }
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
    } catch (parseOrUpdateError) {
      // Parsing or update failed; leave isProcessed false for later handling; blob already stored
      this.logger.warn(
        JSON.stringify({
          event: 'IPN_PARSE_OR_UPDATE_FAILED',
          correlationId,
          ipnRecordId: ipnRecord.id,
          transactionId: payload.TransID,
          error: parseOrUpdateError instanceof Error ? parseOrUpdateError.message : String(parseOrUpdateError),
          timestamp: new Date().toISOString(),
        })
      );
      throw parseOrUpdateError;
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
   * Create or update policy payment record. Uses customer.idNumber for policy_payment.accountNumber.
   * Returns true when a policy_payment was created or updated (so caller can set isMapped on report item).
   */
  private async createPolicyPaymentRecord(
    payload: MpesaIpnPayloadDto,
    amount: number,
    transactionTime: Date,
    correlationId: string
  ): Promise<boolean> {
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
      return false;
    }

    // Find policy and customer (for accountNumber = customer.idNumber)
    const policyWithCustomer = await this.prismaService.policy.findFirst({
      where: {
        paymentAcNumber: payload.BillRefNumber,
      },
      select: {
        id: true,
        status: true,
        customerId: true,
        customer: { select: { idNumber: true } },
      },
    });

    if (!policyWithCustomer) {
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
      return false;
    }

    const policy = { id: policyWithCustomer.id, status: policyWithCustomer.status };
    const customerIdNumber = policyWithCustomer.customer?.idNumber ?? null;

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
      return true; // Already mapped
    }

    // Check for placeholder payment (transactionReference starts with "PENDING-STK-")
    const placeholderPayment = await this.prismaService.policyPayment.findFirst({
      where: {
        policyId: policy.id,
        transactionReference: {
          startsWith: 'PENDING-STK-',
        },
        actualPaymentDate: null,
      },
    });

    if (placeholderPayment) {
      await this.prismaService.policyPayment.update({
        where: { id: placeholderPayment.id },
        data: {
          transactionReference: payload.TransID,
          amount,
          accountNumber: customerIdNumber,
          details: `IPN payment - ${payload.TransactionType}`,
          expectedPaymentDate: transactionTime,
          actualPaymentDate: transactionTime,
          paymentMessageBlob: JSON.stringify({
            firstName: payload.FirstName,
            middleName: payload.MiddleName,
            lastName: payload.LastName,
            businessShortCode: payload.BusinessShortCode,
            originalPlaceholderRef: placeholderPayment.transactionReference,
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
      await this.prismaService.policyPayment.create({
        data: {
          policyId: policy.id,
          paymentType: 'MPESA',
          transactionReference: payload.TransID,
          amount,
          accountNumber: customerIdNumber,
          details: `IPN payment - ${payload.TransactionType}`,
          expectedPaymentDate: transactionTime,
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

    return true;
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
   * Update existing records (idempotent handling). Uses customer.idNumber for policy_payment.accountNumber.
   */
  private async updateExistingRecords(
    ipnRecordId: string,
    policyPaymentId: number,
    payload: MpesaIpnPayloadDto,
    msisdnForStorage: string,
    amount: number,
    transactionTime: Date,
    _reasonType: MpesaStatementReasonType,
    _correlationId: string
  ): Promise<void> {
    await this.prismaService.mpesaPaymentReportItem.update({
      where: { id: ipnRecordId },
      data: {
        completionTime: transactionTime,
        initiationTime: transactionTime,
        paidIn: amount,
        msisdn: msisdnForStorage,
        firstName: payload.FirstName ?? null,
        middleName: payload.MiddleName ?? null,
        lastName: payload.LastName ?? null,
        businessShortCode: payload.BusinessShortCode,
      },
    });

    const policyPayment = await this.prismaService.policyPayment.findUnique({
      where: { id: policyPaymentId },
      include: { policy: { include: { customer: { select: { idNumber: true } } } } },
    });
    const customerIdNumber = policyPayment?.policy?.customer?.idNumber ?? null;

    await this.prismaService.policyPayment.update({
      where: { id: policyPaymentId },
      data: {
        amount,
        actualPaymentDate: transactionTime,
        accountNumber: customerIdNumber,
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

