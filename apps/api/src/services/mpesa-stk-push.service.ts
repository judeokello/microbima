import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MpesaDarajaApiService } from './mpesa-daraja-api.service';
import { ConfigurationService } from '../config/configuration.service';
import { PolicyService } from './policy.service';
import {
  InitiateStkPushDto,
  StkPushRequestResponseDto,
  StkPushCallbackDto,
  MpesaCallbackResponseDto,
} from '../dto/mpesa-stk-push/mpesa-stk-push.dto';
import { normalizePhoneNumber } from '../utils/phone-number.util';
import { MpesaStkPushStatus, MpesaPaymentSource } from '@prisma/client';
import { ValidationException } from '../exceptions/validation.exception';
import { ErrorCodes } from '../enums/error-codes.enum';
import * as Sentry from '@sentry/nestjs';

/**
 * M-Pesa STK Push Service
 *
 * Handles STK Push payment request initiation, callback processing, and payment record creation.
 */
@Injectable()
export class MpesaStkPushService {
  private readonly logger = new Logger(MpesaStkPushService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly mpesaDarajaApiService: MpesaDarajaApiService,
    private readonly configService: ConfigurationService,
    @Inject(forwardRef(() => PolicyService))
    private readonly policyService: PolicyService
  ) {}

  /**
   * Initiate STK Push request
   *
   * Creates STK Push request record and sends payment prompt to customer's phone.
   *
   * @param dto - STK Push initiation data
   * @param correlationId - Correlation ID for logging
   * @param userId - Optional user ID who initiated the request
   * @returns STK Push request details
   */
  async initiateStkPush(
    dto: InitiateStkPushDto,
    correlationId: string,
    userId?: string
  ): Promise<StkPushRequestResponseDto> {
    try {
      this.logger.log(
        JSON.stringify({
          event: 'STK_PUSH_INITIATION_START',
          correlationId,
          phoneNumber: dto.phoneNumber,
          amount: dto.amount,
          accountReference: dto.accountReference,
          timestamp: new Date().toISOString(),
        })
      );

      // Validate and normalize phone number
      const normalizedPhone = normalizePhoneNumber(dto.phoneNumber);

      // Validate amount
      if (dto.amount < 1 || dto.amount > 70000) {
        throw ValidationException.forField(
          'amount',
          'Amount must be between 1 and 70,000 KES',
          ErrorCodes.VALIDATION_ERROR
        );
      }

      // Validate account reference exists (check policy payment account number)
      const policy = await this.prismaService.policy.findFirst({
        where: {
          paymentAcNumber: dto.accountReference,
        },
      });

      if (!policy) {
        throw ValidationException.forField(
          'accountReference',
          `Policy with payment account number '${dto.accountReference}' not found`,
          ErrorCodes.NOT_FOUND
        );
      }

      // Create STK Push request record (id is auto-generated UUID by Prisma)
      const stkPushRequest = await this.prismaService.mpesaStkPushRequest.create({
        data: {
          phoneNumber: normalizedPhone,
          amount: dto.amount,
          accountReference: dto.accountReference,
          transactionDesc: dto.transactionDesc ?? null,
          status: MpesaStkPushStatus.PENDING,
          initiatedBy: userId ?? null,
        },
      });

      this.logger.log(
        JSON.stringify({
          event: 'STK_PUSH_REQUEST_CREATED',
          correlationId,
          stkPushRequestId: stkPushRequest.id,
          timestamp: new Date().toISOString(),
        })
      );

      // Call M-Pesa Daraja API with the auto-generated id as MerchantRequestID
      // Note: M-Pesa API expects "MerchantRequestID" in the payload, but we use camelCase in code
      const mpesaResponse = await this.mpesaDarajaApiService.initiateStkPush(
        normalizedPhone,
        dto.amount,
        dto.accountReference,
        stkPushRequest.id, // Use auto-generated UUID as MerchantRequestID
        this.configService.mpesa.stkPushCallbackUrl,
        correlationId
      );

      // Update STK Push request with CheckoutRequestID from M-Pesa response
      const updatedRequest = await this.prismaService.mpesaStkPushRequest.update({
        where: { id: stkPushRequest.id },
        data: {
          checkoutRequestId: mpesaResponse.CheckoutRequestID,
        },
      });

      this.logger.log(
        JSON.stringify({
          event: 'STK_PUSH_INITIATED',
          correlationId,
          stkPushRequestId: updatedRequest.id,
          checkoutRequestId: mpesaResponse.CheckoutRequestID,
          timestamp: new Date().toISOString(),
        })
      );

      return {
        id: updatedRequest.id,
        checkoutRequestID: mpesaResponse.CheckoutRequestID,
        merchantRequestID: updatedRequest.id,
        status: updatedRequest.status,
        phoneNumber: updatedRequest.phoneNumber,
        amount: Number(updatedRequest.amount),
        accountReference: updatedRequest.accountReference,
        initiatedAt: updatedRequest.initiatedAt,
      };
    } catch (error) {
      // If error is ValidationException, rethrow it
      if (error instanceof ValidationException) {
        throw error;
      }

      // For other errors, log and throw
      this.logger.error(
        JSON.stringify({
          event: 'STK_PUSH_INITIATION_ERROR',
          correlationId,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          payload: JSON.stringify(dto),
          timestamp: new Date().toISOString(),
        })
      );

      Sentry.captureException(error, {
        tags: {
          service: 'MpesaStkPushService',
          operation: 'initiateStkPush',
          correlationId,
        },
        extra: {
          dto,
          userId,
        },
      });

      throw error;
    }
  }

  /**
   * Handle STK Push callback from M-Pesa
   *
   * Updates STK Push request status and creates payment records if completed.
   * Always returns success (ResultCode: 0) to prevent M-Pesa retries.
   *
   * @param payload - STK Push callback payload from M-Pesa
   * @param correlationId - Correlation ID for logging
   * @returns Success response to M-Pesa
   */
  async handleStkPushCallback(
    payload: StkPushCallbackDto,
    correlationId: string
  ): Promise<MpesaCallbackResponseDto> {
    try {
      const stkCallback = payload.Body.stkCallback;
      const checkoutRequestId = stkCallback.CheckoutRequestID;

      this.logger.log(
        JSON.stringify({
          event: 'STK_PUSH_CALLBACK_RECEIVED',
          correlationId,
          checkoutRequestId,
          merchantRequestId: stkCallback.MerchantRequestID,
          resultCode: stkCallback.ResultCode,
          timestamp: new Date().toISOString(),
        })
      );

      // Find STK Push request by checkoutRequestId
      const stkPushRequest = await this.prismaService.mpesaStkPushRequest.findUnique({
        where: {
          checkoutRequestId,
        },
      });

      if (!stkPushRequest) {
        this.logger.warn(
          JSON.stringify({
            event: 'STK_PUSH_CALLBACK_NOT_FOUND',
            correlationId,
            checkoutRequestId,
            message: 'STK Push request not found for callback',
            timestamp: new Date().toISOString(),
          })
        );

        // Return success to M-Pesa even if request not found
        return { ResultCode: 0, ResultDesc: 'Accepted' };
      }

      // Determine status based on ResultCode
      let newStatus: MpesaStkPushStatus;
      if (stkCallback.ResultCode === 0) {
        newStatus = MpesaStkPushStatus.COMPLETED;
      } else if (stkCallback.ResultDesc?.toLowerCase().includes('cancelled')) {
        newStatus = MpesaStkPushStatus.CANCELLED;
      } else {
        newStatus = MpesaStkPushStatus.FAILED;
      }

      // Update STK Push request status
      const updatedRequest = await this.prismaService.mpesaStkPushRequest.update({
        where: { id: stkPushRequest.id },
        data: {
          status: newStatus,
          resultCode: String(stkCallback.ResultCode),
          resultDesc: stkCallback.ResultDesc,
          completedAt: newStatus === MpesaStkPushStatus.COMPLETED ? new Date() : null,
        },
      });

      this.logger.log(
        JSON.stringify({
          event: 'STK_PUSH_STATUS_UPDATED',
          correlationId,
          stkPushRequestId: updatedRequest.id,
          checkoutRequestId,
          status: newStatus,
          resultCode: stkCallback.ResultCode,
          timestamp: new Date().toISOString(),
        })
      );

      // If status is COMPLETED, create payment records
      if (newStatus === MpesaStkPushStatus.COMPLETED) {
        await this.createPaymentRecordsFromStkPushCallback(
          {
            id: updatedRequest.id,
            phoneNumber: updatedRequest.phoneNumber,
            amount: Number(updatedRequest.amount), // Convert Decimal to number
            accountReference: updatedRequest.accountReference,
            transactionDesc: updatedRequest.transactionDesc,
          },
          stkCallback,
          correlationId
        );
      }

      return { ResultCode: 0, ResultDesc: 'Accepted' };
    } catch (error) {
      // Always return success to M-Pesa, but log error internally
      this.logger.error(
        JSON.stringify({
          event: 'STK_PUSH_CALLBACK_ERROR',
          correlationId,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          payload: JSON.stringify(payload),
          timestamp: new Date().toISOString(),
        })
      );

      Sentry.captureException(error, {
        tags: {
          service: 'MpesaStkPushService',
          operation: 'handleStkPushCallback',
          correlationId,
        },
        extra: {
          payload,
        },
      });

      // Return success to prevent M-Pesa retries
      return { ResultCode: 0, ResultDesc: 'Accepted' };
    }
  }

  /**
   * Create payment records from STK Push callback
   *
   * Creates records in both MpesaPaymentReportItem and policy_payments when STK Push is completed.
   * Handles idempotency (checks if records already exist - IPN may have arrived first).
   */
  private async createPaymentRecordsFromStkPushCallback(
    stkPushRequest: {
      id: string;
      phoneNumber: string;
      amount: number;
      accountReference: string;
      transactionDesc: string | null;
    },
    stkCallback: {
      ResultCode: number;
      CallbackMetadata?: {
        Item: Array<{
          Name: string;
          Value: string;
        }>;
      };
    },
    correlationId: string
  ): Promise<void> {
    // Extract transaction details from callback metadata
    const metadata = stkCallback.CallbackMetadata?.Item ?? [];
    const mpesaReceiptNumber = metadata.find((item) => item.Name === 'MpesaReceiptNumber')?.Value;
    const transactionDate = metadata.find((item) => item.Name === 'TransactionDate')?.Value;
    const phoneNumber = metadata.find((item) => item.Name === 'PhoneNumber')?.Value;

    if (!mpesaReceiptNumber) {
      this.logger.warn(
        JSON.stringify({
          event: 'STK_PUSH_CALLBACK_MISSING_RECEIPT',
          correlationId,
          stkPushRequestId: stkPushRequest.id,
          message: 'MpesaReceiptNumber not found in callback metadata',
          timestamp: new Date().toISOString(),
        })
      );
      return;
    }

    // Check if payment records already exist (IPN may have arrived first)
    const existingPolicyPayment = await this.prismaService.policyPayment.findFirst({
      where: {
        transactionReference: mpesaReceiptNumber,
      },
    });

    const existingIpnRecord = await this.prismaService.mpesaPaymentReportItem.findFirst({
      where: {
        transactionReference: mpesaReceiptNumber,
        source: MpesaPaymentSource.IPN,
      },
    });

    // If both records exist, skip creation (idempotent)
    if (existingPolicyPayment && existingIpnRecord) {
      this.logger.log(
        JSON.stringify({
          event: 'STK_PUSH_PAYMENT_RECORDS_EXIST',
          correlationId,
          stkPushRequestId: stkPushRequest.id,
          transactionReference: mpesaReceiptNumber,
          message: 'Payment records already exist (IPN arrived first)',
          timestamp: new Date().toISOString(),
        })
      );

      // Link STK Push request to existing IPN record if not already linked
      if (!existingIpnRecord.mpesaStkPushRequestId) {
        await this.prismaService.mpesaPaymentReportItem.update({
          where: { id: existingIpnRecord.id },
          data: {
            mpesaStkPushRequestId: stkPushRequest.id,
          },
        });
      }

      return;
    }

    // Parse transaction date (format: YYYYMMDDHHmmss)
    let transactionTime = new Date();
    if (transactionDate && transactionDate.length === 14) {
      const year = parseInt(transactionDate.substring(0, 4), 10);
      const month = parseInt(transactionDate.substring(4, 6), 10) - 1;
      const day = parseInt(transactionDate.substring(6, 8), 10);
      const hours = parseInt(transactionDate.substring(8, 10), 10);
      const minutes = parseInt(transactionDate.substring(10, 12), 10);
      const seconds = parseInt(transactionDate.substring(12, 14), 10);
      transactionTime = new Date(Date.UTC(year, month, day, hours, minutes, seconds));
    }

    // Create MpesaPaymentReportItem record
    await this.prismaService.mpesaPaymentReportItem.create({
      data: {
        mpesaPaymentReportUploadId: null, // STK Push records don't have upload ID
        transactionReference: mpesaReceiptNumber,
        completionTime: transactionTime,
        initiationTime: transactionTime,
        paymentDetails: 'STK Push Payment',
        transactionStatus: 'Completed',
        paidIn: stkPushRequest.amount,
        withdrawn: 0,
        accountBalance: 0, // Not available in STK Push callback
        balanceConfirmed: null,
        reasonType: 'PayBill_STK', // STK Push is always PayBill_STK
        otherPartyInfo: null,
        linkedTransactionId: null,
        accountNumber: stkPushRequest.accountReference,
        source: MpesaPaymentSource.IPN, // STK Push creates IPN-sourced records
        msisdn: phoneNumber ?? stkPushRequest.phoneNumber,
        mpesaStkPushRequestId: stkPushRequest.id,
      },
    });

    // Find policy by account reference (including status for activation check)
    const policy = await this.prismaService.policy.findFirst({
      where: {
        paymentAcNumber: stkPushRequest.accountReference,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (policy) {
      // Check if policy payment already exists
      if (!existingPolicyPayment) {
        await this.prismaService.policyPayment.create({
          data: {
            policyId: policy.id,
            paymentType: 'MPESA',
            transactionReference: mpesaReceiptNumber,
            amount: stkPushRequest.amount,
            accountNumber: phoneNumber ?? stkPushRequest.phoneNumber,
            details: stkPushRequest.transactionDesc ?? 'STK Push payment',
            expectedPaymentDate: transactionTime,
            actualPaymentDate: transactionTime,
            paymentMessageBlob: JSON.stringify({
              source: 'STK_PUSH',
              checkoutRequestId: stkPushRequest.id,
            }),
          },
        });

        this.logger.log(
          JSON.stringify({
            event: 'STK_PUSH_POLICY_PAYMENT_CREATED',
            correlationId,
            stkPushRequestId: stkPushRequest.id,
            policyId: policy.id,
            transactionReference: mpesaReceiptNumber,
            timestamp: new Date().toISOString(),
          })
        );

        // Activate policy if it's in PENDING_ACTIVATION status
        if (policy.status === 'PENDING_ACTIVATION') {
          try {
            await this.policyService.activatePolicy(policy.id, correlationId);
            this.logger.log(
              JSON.stringify({
                event: 'STK_PUSH_POLICY_ACTIVATED',
                correlationId,
                stkPushRequestId: stkPushRequest.id,
                policyId: policy.id,
                transactionReference: mpesaReceiptNumber,
                timestamp: new Date().toISOString(),
              })
            );
          } catch (activationError) {
            // Log error but don't fail - payment record was created successfully
            this.logger.error(
              JSON.stringify({
                event: 'STK_PUSH_POLICY_ACTIVATION_FAILED',
                correlationId,
                stkPushRequestId: stkPushRequest.id,
                policyId: policy.id,
                error: activationError instanceof Error ? activationError.message : String(activationError),
                timestamp: new Date().toISOString(),
              })
            );
          }
        }
      }
    } else {
      this.logger.warn(
        JSON.stringify({
          event: 'STK_PUSH_POLICY_NOT_FOUND',
          correlationId,
          stkPushRequestId: stkPushRequest.id,
          accountReference: stkPushRequest.accountReference,
          message: 'Policy not found for account reference - policy payment not created',
          timestamp: new Date().toISOString(),
        })
      );
    }

    this.logger.log(
      JSON.stringify({
        event: 'STK_PUSH_PAYMENT_RECORDS_CREATED',
        correlationId,
        stkPushRequestId: stkPushRequest.id,
        transactionReference: mpesaReceiptNumber,
        timestamp: new Date().toISOString(),
      })
    );
  }
}

