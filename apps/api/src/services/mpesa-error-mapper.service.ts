import { Injectable } from '@nestjs/common';
import { ErrorCodes } from '../enums/error-codes.enum';
import { ValidationException } from '../exceptions/validation.exception';

/**
 * MPESA API Type
 */
export type MpesaApiType = 'STK_PUSH' | 'RATIBA' | 'QUERY' | 'AUTHORIZATION' | 'IPN';

/**
 * MPESA Error Context
 */
export interface MpesaErrorContext {
  api: MpesaApiType;
  mpesaCode: string | number;
  mpesaMessage?: string;
  retryable: boolean;
}

/**
 * MPESA Error Info
 */
export interface MpesaErrorInfo {
  code: ErrorCodes;
  message: string;
  userMessage: string;
  context: MpesaErrorContext;
}

/**
 * MPESA Error Mapper Service
 *
 * Maps MPESA-specific error codes (ResultCodes, ResponseCodes, HTTP errors) to
 * unified internal error codes. Provides semantic error handling across all MPESA APIs.
 */
@Injectable()
export class MpesaErrorMapperService {
  /**
   * Map MPESA Result Code to internal error
   *
   * Works for STK Push, Ratiba, and Query API callbacks.
   * Result codes are transaction-level errors returned in callback responses.
   *
   * @param resultCode - MPESA ResultCode (numeric or string)
   * @param resultDesc - MPESA ResultDesc message
   * @param api - Source API ('STK_PUSH', 'RATIBA', or 'QUERY')
   * @returns Mapped error information
   */
  mapResultCode(
    resultCode: number | string,
    resultDesc: string,
    api: 'STK_PUSH' | 'RATIBA' | 'QUERY'
  ): MpesaErrorInfo {
    const code = String(resultCode);

    // Success code should not be mapped
    if (code === '0') {
      throw new Error('Success codes should not be mapped to errors');
    }

    // Unified mapping for codes that appear in multiple APIs
    switch (code) {
      case '1':
        return {
          code: ErrorCodes.MPESA_INSUFFICIENT_BALANCE,
          message: 'Customer has insufficient balance for the transaction',
          userMessage:
            'Insufficient M-PESA balance. Please ask the customer to top up their account.',
          context: { api, mpesaCode: code, mpesaMessage: resultDesc, retryable: true },
        };

      case '2':
        return {
          code: ErrorCodes.MPESA_AMOUNT_TOO_LOW,
          message: 'Transaction amount is less than the minimum allowed (Ksh 1)',
          userMessage: 'Amount is too low. Minimum amount is Ksh 1.',
          context: { api, mpesaCode: code, mpesaMessage: resultDesc, retryable: false },
        };

      case '3':
        return {
          code: ErrorCodes.MPESA_AMOUNT_TOO_HIGH,
          message: 'Transaction amount exceeds the maximum allowed',
          userMessage:
            'Amount exceeds the maximum allowed. Please reduce the amount.',
          context: { api, mpesaCode: code, mpesaMessage: resultDesc, retryable: false },
        };

      case '4':
        return {
          code: ErrorCodes.MPESA_DAILY_LIMIT_EXCEEDED,
          message:
            'Transaction would exceed customer daily transfer limit (Ksh 500,000)',
          userMessage:
            'Transaction exceeds daily limit. Customer has reached their daily M-PESA limit.',
          context: { api, mpesaCode: code, mpesaMessage: resultDesc, retryable: false },
        };

      case '8':
        return {
          code: ErrorCodes.MPESA_DAILY_LIMIT_EXCEEDED,
          message: 'Transaction would exceed maximum account balance',
          userMessage: 'Transaction exceeds account balance limit.',
          context: { api, mpesaCode: code, mpesaMessage: resultDesc, retryable: false },
        };

      case '17':
        return {
          code: ErrorCodes.MPESA_TRANSACTION_IN_PROGRESS,
          message:
            'Multiple requests sent too quickly (within 2 minutes for same customer/amount)',
          userMessage:
            'Please wait at least 2 minutes between payment requests for the same customer.',
          context: { api, mpesaCode: code, mpesaMessage: resultDesc, retryable: true },
        };

      case '1001':
        // Ratiba-specific: Unable to lock subscriber
        if (api === 'RATIBA') {
          return {
            code: ErrorCodes.MPESA_TRANSACTION_IN_PROGRESS,
            message:
              'Unable to lock subscriber - transaction already in process for this customer',
            userMessage:
              'A payment request is already in progress for this customer. Please wait 2-3 minutes and try again.',
            context: { api, mpesaCode: code, mpesaMessage: resultDesc, retryable: true },
          };
        }
        break;

      case '1019':
        return {
          code: ErrorCodes.MPESA_TRANSACTION_EXPIRED,
          message: 'Transaction expired (not completed within allowable time)',
          userMessage:
            'Payment request expired. Please initiate a new payment request.',
          context: { api, mpesaCode: code, mpesaMessage: resultDesc, retryable: true },
        };

      case '1025':
        return {
          code: ErrorCodes.MPESA_REQUEST_TOO_LONG,
          message:
            'USSD prompt message too long (account reference exceeds 12 characters)',
          userMessage:
            'Account reference is too long. Please use a shorter reference (max 12 characters).',
          context: { api, mpesaCode: code, mpesaMessage: resultDesc, retryable: false },
        };

      case '1032':
        return {
          code: ErrorCodes.MPESA_REQUEST_CANCELLED,
          message: 'Payment request cancelled by customer',
          userMessage:
            'Payment request was cancelled. Please ask the customer to complete the payment.',
          context: { api, mpesaCode: code, mpesaMessage: resultDesc, retryable: true },
        };

      case '1037':
        return {
          code: ErrorCodes.MPESA_USER_UNREACHABLE,
          message:
            'Customer phone unreachable (offline, busy, or ongoing session)',
          userMessage:
            'Unable to reach customer phone. Please ensure the phone is online and try again.',
          context: { api, mpesaCode: code, mpesaMessage: resultDesc, retryable: true },
        };

      case '1050':
        // Ratiba-specific: Duplicate standing order name
        if (api === 'RATIBA') {
          return {
            code: ErrorCodes.MPESA_RATIBA_DUPLICATE_NAME,
            message: 'User already has standing order with same name',
            userMessage:
              'A standing order with this name already exists. Please use a unique name.',
            context: { api, mpesaCode: code, mpesaMessage: resultDesc, retryable: false },
          };
        }
        break;

      case '1051':
        // Ratiba-specific: Bad request
        if (api === 'RATIBA') {
          return {
            code: ErrorCodes.VALIDATION_ERROR,
            message: 'Invalid request payload',
            userMessage: 'Invalid request. Please check all fields and try again.',
            context: { api, mpesaCode: code, mpesaMessage: resultDesc, retryable: false },
          };
        }
        break;

      case '2001':
        return {
          code: ErrorCodes.MPESA_INVALID_PIN,
          message: 'Customer entered incorrect M-PESA PIN',
          userMessage:
            'Incorrect PIN entered. Please ask the customer to try again with the correct PIN.',
          context: { api, mpesaCode: code, mpesaMessage: resultDesc, retryable: true },
        };

      case '2028':
      case 'SFC_J_C0003':
        return {
          code: ErrorCodes.MPESA_CONFIGURATION_ERROR,
          message: 'Invalid TransactionType or PartyB configuration',
          userMessage:
            'Payment service configuration error. Please contact support.',
          context: { api, mpesaCode: code, mpesaMessage: resultDesc, retryable: false },
        };

      case '8006':
        return {
          code: ErrorCodes.MPESA_ACCOUNT_LOCKED,
          message: 'Customer security credential is locked',
          userMessage:
            'Customer M-PESA account is locked. Please ask them to contact M-PESA customer care (100 or 200).',
          context: { api, mpesaCode: code, mpesaMessage: resultDesc, retryable: false },
        };
    }

    // Default fallback for unmapped codes
    return {
      code: ErrorCodes.MPESA_API_ERROR,
      message: `MPESA ${api} error: ${code} - ${resultDesc}`,
      userMessage: 'Payment request failed. Please try again.',
      context: { api, mpesaCode: code, mpesaMessage: resultDesc, retryable: true },
    };
  }

  /**
   * Map MPESA HTTP Error Code to internal error
   *
   * These are platform-level HTTP errors that apply to all MPESA APIs.
   *
   * @param statusCode - HTTP status code
   * @param errorCode - MPESA error code (e.g., '400.002.02')
   * @param errorMessage - MPESA error message
   * @param api - Source API (optional, for context)
   * @returns Mapped error information
   */
  mapHttpError(
    statusCode: number,
    errorCode?: string,
    errorMessage?: string,
    api?: MpesaApiType
  ): MpesaErrorInfo {
    const apiContext = api ?? 'STK_PUSH'; // Default to STK_PUSH if not specified

    switch (statusCode) {
      case 400:
        // Bad Request - Invalid parameters
        if (errorCode?.includes('Invalid BusinessShortCode')) {
          return {
            code: ErrorCodes.MPESA_CONFIGURATION_ERROR,
            message: 'MPESA configuration error: Invalid BusinessShortCode',
            userMessage:
              'Payment service configuration error. Please contact support.',
            context: {
              api: apiContext,
              mpesaCode: errorCode ?? statusCode,
              mpesaMessage: errorMessage,
              retryable: false,
            },
          };
        }
        if (errorCode?.includes('400.002.05') || errorCode?.includes('Invalid Request Payload')) {
          return {
            code: ErrorCodes.VALIDATION_ERROR,
            message: 'Invalid request payload sent to MPESA API',
            userMessage: 'Invalid payment request. Please check the details.',
            context: {
              api: apiContext,
              mpesaCode: errorCode ?? statusCode,
              mpesaMessage: errorMessage,
              retryable: false,
            },
          };
        }
        return {
          code: ErrorCodes.VALIDATION_ERROR,
          message: errorMessage ?? 'Invalid request to MPESA API',
          userMessage: 'Invalid payment request. Please check the details.',
          context: {
            api: apiContext,
            mpesaCode: errorCode ?? statusCode,
            mpesaMessage: errorMessage,
            retryable: false,
          },
        };

      case 401:
      case 404:
        // Authentication/Token errors
        if (
          errorCode?.includes('Invalid Access Token') ||
          errorCode?.includes('404.001.03') ||
          errorCode?.includes('404.001.04') ||
          errorCode?.includes('Invalid Authentication Header')
        ) {
          return {
            code: ErrorCodes.MPESA_INVALID_CREDENTIALS,
            message: 'MPESA authentication failed: Invalid access token or authentication header',
            userMessage:
              'Payment service authentication error. Please try again.',
            context: {
              api: apiContext,
              mpesaCode: errorCode ?? statusCode,
              mpesaMessage: errorMessage,
              retryable: true, // Token can be regenerated
            },
          };
        }
        if (errorCode?.includes('404.001.01') || errorCode?.includes('Resource not found')) {
          return {
            code: ErrorCodes.ENDPOINT_NOT_FOUND,
            message: 'MPESA API endpoint not found',
            userMessage: 'Payment service error. Please contact support.',
            context: {
              api: apiContext,
              mpesaCode: errorCode ?? statusCode,
              mpesaMessage: errorMessage,
              retryable: false,
            },
          };
        }
        return {
          code: ErrorCodes.MPESA_INVALID_CREDENTIALS,
          message: 'MPESA authentication failed',
          userMessage: 'Payment service authentication error. Please try again.',
          context: {
            api: apiContext,
            mpesaCode: errorCode ?? statusCode,
            mpesaMessage: errorMessage,
            retryable: true,
          },
        };

      case 405:
        return {
          code: ErrorCodes.MALFORMED_REQUEST,
          message: 'HTTP method not allowed for MPESA API',
          userMessage: 'Payment service error. Please contact support.',
          context: {
            api: apiContext,
            mpesaCode: errorCode ?? statusCode,
            mpesaMessage: errorMessage,
            retryable: false,
          },
        };

      case 429:
        return {
          code: ErrorCodes.RATE_LIMIT_EXCEEDED,
          message: 'MPESA API rate limit exceeded',
          userMessage: 'Too many requests. Please wait a moment and try again.',
          context: {
            api: apiContext,
            mpesaCode: errorCode ?? statusCode,
            mpesaMessage: errorMessage,
            retryable: true,
          },
        };

      case 500:
        if (errorCode?.includes('Merchant does not exist')) {
          return {
            code: ErrorCodes.MPESA_CONFIGURATION_ERROR,
            message: 'MPESA configuration error: Merchant does not exist',
            userMessage:
              'Payment service configuration error. Please contact support.',
            context: {
              api: apiContext,
              mpesaCode: errorCode || statusCode,
              mpesaMessage: errorMessage,
              retryable: false,
            },
          };
        }
        if (
          errorCode?.includes('Unable to lock subscriber') ||
          errorCode?.includes('500.001.001')
        ) {
          // Check if it's the "transaction in progress" variant
          if (errorMessage?.includes('transaction is already in process')) {
            return {
              code: ErrorCodes.MPESA_TRANSACTION_IN_PROGRESS,
              message:
                'MPESA error: Transaction already in process for this customer',
              userMessage:
                'A payment request is already in progress for this customer. Please wait 1 minute and try again.',
              context: {
                api: apiContext,
                mpesaCode: errorCode ?? statusCode,
                mpesaMessage: errorMessage,
                retryable: true,
              },
            };
          }
          // Otherwise it's a credentials error
          return {
            code: ErrorCodes.MPESA_INVALID_CREDENTIALS,
            message: 'MPESA error: Wrong credentials or unable to lock subscriber',
            userMessage:
              'Payment service authentication error. Please try again.',
            context: {
              api: apiContext,
              mpesaCode: errorCode ?? statusCode,
              mpesaMessage: errorMessage,
              retryable: true,
            },
          };
        }
        if (
          errorCode?.includes('System is busy') ||
          errorCode?.includes('500.003.02') ||
          errorCode?.includes('Spike Arrest Violation')
        ) {
          return {
            code: ErrorCodes.MPESA_SERVICE_UNAVAILABLE,
            message: 'MPESA service temporarily unavailable or rate limited',
            userMessage:
              'Payment service is temporarily busy. Please try again in a few moments.',
            context: {
              api: apiContext,
              mpesaCode: errorCode ?? statusCode,
              mpesaMessage: errorMessage,
              retryable: true,
            },
          };
        }
        if (errorCode?.includes('500.003.03') || errorCode?.includes('Quota Violation')) {
          return {
            code: ErrorCodes.RATE_LIMIT_EXCEEDED,
            message: 'MPESA API quota violation',
            userMessage: 'Too many requests. Please wait and try again later.',
            context: {
              api: apiContext,
              mpesaCode: errorCode ?? statusCode,
              mpesaMessage: errorMessage,
              retryable: true,
            },
          };
        }
        return {
          code: ErrorCodes.MPESA_SERVICE_UNAVAILABLE,
          message: errorMessage ?? 'MPESA service error',
          userMessage: 'Payment service error. Please try again.',
          context: {
            api: apiContext,
            mpesaCode: errorCode ?? statusCode,
            mpesaMessage: errorMessage,
            retryable: true,
          },
        };

      default:
        return {
          code: ErrorCodes.MPESA_API_ERROR,
          message: errorMessage ?? `MPESA API error: ${statusCode}`,
          userMessage: 'Payment request failed. Please try again.',
          context: {
            api: apiContext,
            mpesaCode: errorCode ?? statusCode,
            mpesaMessage: errorMessage,
            retryable: true,
          },
        };
    }
  }

  /**
   * Map MPESA STK Push Response Code to internal error
   *
   * Response codes are returned in the initial API response (not callbacks).
   * ResponseCode "0" means success, any other code indicates an error.
   *
   * @param responseCode - MPESA ResponseCode (usually "0" for success)
   * @param responseDescription - MPESA ResponseDescription
   * @returns Mapped error information
   */
  mapStkPushResponseCode(
    responseCode: string,
    responseDescription: string
  ): MpesaErrorInfo {
    // ResponseCode "0" means success, shouldn't be mapped
    if (responseCode === '0') {
      throw new Error('Success response codes should not be mapped to errors');
    }

    // Non-zero ResponseCodes are usually API-level issues
    return {
      code: ErrorCodes.MPESA_API_ERROR,
      message: `MPESA API error: ${responseCode} - ${responseDescription}`,
      userMessage: 'Payment request failed. Please try again.',
      context: {
        api: 'STK_PUSH',
        mpesaCode: responseCode,
        mpesaMessage: responseDescription,
        retryable: true,
      },
    };
  }

  /**
   * Create ValidationException from MPESA error info
   *
   * @param errorInfo - MPESA error information
   * @returns ValidationException with MPESA context in details
   */
  toValidationException(errorInfo: MpesaErrorInfo): ValidationException {
    const details: Record<string, string> = {
      api: errorInfo.context.api,
      mpesaCode: String(errorInfo.context.mpesaCode),
      retryable: String(errorInfo.context.retryable),
    };

    // Only include mpesaMessage if it exists
    if (errorInfo.context.mpesaMessage) {
      details.mpesaMessage = errorInfo.context.mpesaMessage;
    }

    return new ValidationException(
      errorInfo.code,
      errorInfo.userMessage, // Use user-friendly message as the main message
      details
    );
  }
}

