import { Injectable, Logger } from '@nestjs/common';
import { ConfigurationService } from '../config/configuration.service';
import { MpesaErrorMapperService } from './mpesa-error-mapper.service';
import { ValidationException } from '../exceptions/validation.exception';
import * as Sentry from '@sentry/nestjs';
import axios, { AxiosError } from 'axios';

/**
 * M-Pesa Daraja API Client Service
 *
 * Handles communication with M-Pesa Daraja API for STK Push operations.
 * Manages OAuth token generation, token caching, and STK Push request initiation.
 */
@Injectable()
export class MpesaDarajaApiService {
  private readonly logger = new Logger(MpesaDarajaApiService.name);
  private accessToken: string | null = null;
  private tokenExpiryTime: number = 0;

  constructor(
    private readonly configService: ConfigurationService,
    private readonly mpesaErrorMapper: MpesaErrorMapperService
  ) {}

  /**
   * Generate OAuth access token
   *
   * Tokens expire after 3600 seconds (1 hour).
   * Caches token until expiry to avoid unnecessary API calls.
   *
   * @param correlationId - Correlation ID for logging
   * @returns Access token
   */
  async generateAccessToken(correlationId: string): Promise<string> {
    // Check if cached token is still valid (with 5-minute buffer)
    const now = Date.now();
    if (this.accessToken && this.tokenExpiryTime > now + 5 * 60 * 1000) {
      this.logger.debug(
        JSON.stringify({
          event: 'OAUTH_TOKEN_CACHED',
          correlationId,
          message: 'Using cached access token',
          timestamp: new Date().toISOString(),
        })
      );
      return this.accessToken;
    }

    const config = this.configService.mpesa;
    // OAuth endpoint is at root level, not under /mpesa
    // baseUrl is https://sandbox.safaricom.co.ke/mpesa
    // OAuth URL should be https://sandbox.safaricom.co.ke/oauth/v1/generate
    const baseDomain = config.baseUrl.replace('/mpesa', '');
    const authUrl = `${baseDomain}/oauth/v1/generate?grant_type=client_credentials`;

    try {
      // Create Basic Auth header
      const credentials = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');

      this.logger.log(
        JSON.stringify({
          event: 'OAUTH_TOKEN_REQUEST',
          correlationId,
          url: authUrl,
          timestamp: new Date().toISOString(),
        })
      );

      // Use axios instead of fetch() to avoid WAF blocking
      // Axios has a different TLS fingerprint that WAFs typically allow
      const response = await axios.get<{ access_token: string; expires_in: number }>(authUrl, {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Accept': 'application/json',
          'User-Agent': 'axios/1.12.2', // Axios user agent
        },
        timeout: 30000, // 30 second timeout
        validateStatus: (status) => status < 500, // Don't throw on 4xx, we'll handle it
      });

      if (response.status !== 200) {
        const errorDetails = {
          status: response.status,
          statusText: response.statusText,
          url: authUrl,
          baseUrl: config.baseUrl,
          environment: config.environment,
          errorBody: response.data ? JSON.stringify(response.data) : '(empty response)',
        };
        this.logger.error(
          JSON.stringify({
            event: 'OAUTH_TOKEN_ERROR',
            correlationId,
            ...errorDetails,
            timestamp: new Date().toISOString(),
          })
        );
        throw new Error(
          `OAuth token request failed: ${response.status} ${response.statusText} - URL: ${authUrl} - Response: ${errorDetails.errorBody}`
        );
      }

      const data = response.data;

      // Cache token with expiry time
      this.accessToken = data.access_token;
      this.tokenExpiryTime = now + (data.expires_in - 300) * 1000; // Subtract 5 minutes buffer

      this.logger.log(
        JSON.stringify({
          event: 'OAUTH_TOKEN_GENERATED',
          correlationId,
          expiresIn: data.expires_in,
          timestamp: new Date().toISOString(),
        })
      );

      return this.accessToken;
    } catch (error) {
      // Handle axios errors
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const errorDetails = {
          status: axiosError.response?.status ?? 0,
          statusText: axiosError.response?.statusText ?? axiosError.message,
          url: authUrl,
          baseUrl: config.baseUrl,
          environment: config.environment,
          errorBody: axiosError.response?.data ? JSON.stringify(axiosError.response.data) : '(empty response)',
        };
        this.logger.error(
          JSON.stringify({
            event: 'OAUTH_TOKEN_ERROR',
            correlationId,
            ...errorDetails,
            timestamp: new Date().toISOString(),
          })
        );
        throw new Error(
          `OAuth token request failed: ${errorDetails.status} ${errorDetails.statusText} - URL: ${authUrl} - Response: ${errorDetails.errorBody}`
        );
      }

      // Handle other errors
      this.logger.error(
        JSON.stringify({
          event: 'OAUTH_TOKEN_ERROR',
          correlationId,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        })
      );

      Sentry.captureException(error, {
        tags: {
          service: 'MpesaDarajaApiService',
          operation: 'generateAccessToken',
          correlationId,
        },
      });

      throw error;
    }
  }

  /**
   * Initiate STK Push request
   *
   * Sends STK Push request to M-Pesa Daraja API.
   * Retries up to 3 times with exponential backoff on failure.
   *
   * @param phoneNumber - Customer phone number (normalized: 254XXXXXXXXX)
   * @param amount - Transaction amount
   * @param accountReference - Policy payment account number (BillRefNumber)
   * @param merchantRequestId - Merchant request ID (STK Push request UUID)
   * @param callbackUrl - Callback URL for STK Push notifications
   * @param correlationId - Correlation ID for logging
   * @returns STK Push response with CheckoutRequestID
   */
  async initiateStkPush(
    phoneNumber: string,
    amount: number,
    accountReference: string,
    merchantRequestId: string,
    callbackUrl: string,
    correlationId: string
  ): Promise<{ CheckoutRequestID: string; ResponseCode: string; ResponseDescription: string; MerchantRequestID: string; CustomerMessage: string }> {
    const maxRetries = 3;
    const retryDelays = [1000, 2000, 4000]; // 1s, 2s, 4s
    const errors: Array<{ attempt: number; error: string; timestamp: string }> = [];

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const accessToken = await this.generateAccessToken(correlationId);
        const config = this.configService.mpesa;

        // Generate password: Base64(BusinessShortCode + Passkey + Timestamp)
        const timestamp = this.generateTimestamp();
        const password = this.generatePassword(config.businessShortCode, config.passkey, timestamp);

        // Debug logging (mask sensitive values)
        this.logger.debug(
          JSON.stringify({
            event: 'STK_PUSH_PASSWORD_GENERATED',
            correlationId,
            attempt,
            businessShortCode: config.businessShortCode,
            passkeyLength: config.passkey?.length || 0,
            passwordTimestamp: timestamp,
            passwordLength: password.length,
            timestamp: new Date().toISOString(),
          })
        );

        const stkPushUrl = `${config.baseUrl}/stkpush/v1/processrequest`;

        const payload = {
          BusinessShortCode: config.businessShortCode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: 'CustomerPayBillOnline',
          Amount: amount,
          PartyA: phoneNumber,
          PartyB: config.businessShortCode,
          PhoneNumber: phoneNumber,
          CallBackURL: callbackUrl,
          AccountReference: accountReference,
          TransactionDesc: 'Premium payment',
          MerchantRequestID: merchantRequestId, // Use camelCase in code, but M-Pesa expects MerchantRequestID
        };

        // Debug: Log the actual payload being sent (mask sensitive values)
        this.logger.debug(
          JSON.stringify({
            event: 'STK_PUSH_PAYLOAD_DEBUG',
            correlationId,
            attempt,
            businessShortCode: config.businessShortCode,
            passwordTimestamp: timestamp,
            passwordLength: password.length,
            passwordFirst20: password.substring(0, 20) + '...',
            payloadKeys: Object.keys(payload),
            timestamp: new Date().toISOString(),
          })
        );

        this.logger.log(
          JSON.stringify({
            event: 'STK_PUSH_REQUEST',
            correlationId,
            attempt,
            merchantRequestId,
            phoneNumber,
            amount,
            accountReference,
            timestamp: new Date().toISOString(),
          })
        );

        const response = await axios.post<{
          CheckoutRequestID: string;
          ResponseCode: string;
          ResponseDescription: string;
          MerchantRequestID: string;
          CustomerMessage: string;
        }>(stkPushUrl, payload, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 second timeout
          validateStatus: (status) => status < 500, // Don't throw on 4xx, we'll handle it
        });

        if (response.status !== 200) {
          // Extract error code and message from response
          const errorData = response.data as { errorCode?: string; requestId?: string; errorMessage?: string; error?: string } | undefined;
          const errorCode = errorData?.errorCode ?? errorData?.requestId ?? String(response.status);
          const errorMessage = errorData?.errorMessage ?? errorData?.error ?? response.statusText;

          // Map HTTP error to MPESA error info
          const errorInfo = this.mpesaErrorMapper.mapHttpError(
            response.status,
            errorCode,
            errorMessage,
            'STK_PUSH'
          );

          this.logger.warn(
            JSON.stringify({
              event: 'STK_PUSH_HTTP_ERROR',
              correlationId,
              attempt,
              statusCode: response.status,
              errorCode: errorInfo.context.mpesaCode,
              errorInfo: errorInfo.code,
              retryable: errorInfo.context.retryable,
              timestamp: new Date().toISOString(),
            })
          );

          // For non-retryable errors, throw immediately
          if (!errorInfo.context.retryable || attempt === maxRetries) {
            const errorMessage = `STK Push request failed: ${response.status} ${response.statusText}`;
            errors.push({
              attempt,
              error: errorMessage,
              timestamp: new Date().toISOString(),
            });

            if (attempt === maxRetries) {
              // Convert to ValidationException on final attempt
              throw this.mpesaErrorMapper.toValidationException(errorInfo);
            }
          }

          // Wait before retry (with longer delay for rate limits)
          const delay = response.status === 429
            ? retryDelays[attempt - 1] * 2
            : retryDelays[attempt - 1];
          await this.sleep(delay);

          errors.push({
            attempt,
            error: errorInfo.message,
            timestamp: new Date().toISOString(),
          });
          continue;
        }

        const data = response.data;

        // Check if M-Pesa returned an error in the response (ResponseCode !== "0")
        if (data.ResponseCode !== '0') {
          // Map ResponseCode error to MPESA error info
          const errorInfo = this.mpesaErrorMapper.mapStkPushResponseCode(
            data.ResponseCode,
            data.ResponseDescription
          );

          this.logger.warn(
            JSON.stringify({
              event: 'STK_PUSH_RESPONSE_CODE_ERROR',
              correlationId,
              attempt,
              responseCode: data.ResponseCode,
              errorInfo: errorInfo.code,
              retryable: errorInfo.context.retryable,
              timestamp: new Date().toISOString(),
            })
          );

          // For non-retryable errors or final attempt, throw immediately
          if (!errorInfo.context.retryable || attempt === maxRetries) {
            errors.push({
              attempt,
              error: errorInfo.message,
              timestamp: new Date().toISOString(),
            });

            if (attempt === maxRetries) {
              // Convert to ValidationException on final attempt
              throw this.mpesaErrorMapper.toValidationException(errorInfo);
            }
          }

          // Wait before retry
          await this.sleep(retryDelays[attempt - 1]);

          errors.push({
            attempt,
            error: errorInfo.message,
            timestamp: new Date().toISOString(),
          });
          continue;
        }

        this.logger.log(
          JSON.stringify({
            event: 'STK_PUSH_SUCCESS',
            correlationId,
            merchantRequestId,
            checkoutRequestId: data.CheckoutRequestID,
            responseCode: data.ResponseCode,
            timestamp: new Date().toISOString(),
          })
        );

        return data;
      } catch (error) {
        // If it's already a ValidationException (from error mapper), rethrow it on final attempt
        // Otherwise, allow retries for retryable errors
        if (error instanceof ValidationException) {
          if (attempt === maxRetries) {
            throw error; // Re-throw mapped ValidationException
          }
          // For retryable mapped errors, continue to retry logic below
          errors.push({
            attempt,
            error: error.message,
            timestamp: new Date().toISOString(),
          });
          await this.sleep(retryDelays[attempt - 1]);
          continue;
        }

        // Handle axios errors and network errors
        let errorMessage: string;
        let statusCode: number | undefined;
        let errorData: { errorCode?: string; errorMessage?: string; error?: string } | undefined;

        if (axios.isAxiosError(error)) {
          const axiosError = error as AxiosError;
          statusCode = axiosError.response?.status;
          errorData = axiosError.response?.data as { errorCode?: string; errorMessage?: string; error?: string } | undefined;
          errorMessage = `STK Push request failed: ${statusCode ?? 0} ${axiosError.response?.statusText ?? axiosError.message}`;
        } else {
          errorMessage = error instanceof Error ? error.message : 'Unknown error';
        }

        // If we have HTTP status code, try to map it
        if (statusCode && statusCode !== 200) {
          const errorCode = errorData?.errorCode;
          const errorMsg = errorData?.errorMessage ?? errorData?.error;
          const errorInfo = this.mpesaErrorMapper.mapHttpError(
            statusCode,
            errorCode,
            errorMsg,
            'STK_PUSH'
          );

          if (attempt === maxRetries || !errorInfo.context.retryable) {
            errors.push({
              attempt,
              error: errorInfo.message,
              timestamp: new Date().toISOString(),
            });

            if (attempt === maxRetries) {
              // Enhanced error logging
              this.logger.error(
                JSON.stringify({
                  event: 'STK_PUSH_RETRY_EXHAUSTED',
                  correlationId,
                  merchantRequestId,
                  errorType: 'RETRY_EXHAUSTION',
                  errors,
                  transactionDetails: {
                    phoneNumber,
                    amount,
                    accountReference,
                  },
                  timestamp: new Date().toISOString(),
                })
              );

              // Metric: Retry exhaustion events
              this.logger.log(
                JSON.stringify({
                  event: 'METRIC_RETRY_EXHAUSTED',
                  metricType: 'counter',
                  metricName: 'retry_exhaustion_events',
                  value: 1,
                  api: 'STK_PUSH',
                  correlationId,
                  timestamp: new Date().toISOString(),
                })
              );

              Sentry.captureException(error, {
                tags: {
                  service: 'MpesaDarajaApiService',
                  operation: 'initiateStkPush',
                  correlationId,
                },
                extra: {
                  phoneNumber,
                  amount,
                  accountReference,
                  merchantRequestId,
                  errors,
                },
              });

              throw this.mpesaErrorMapper.toValidationException(errorInfo);
            }
          }
        } else {
          // Network errors or other non-HTTP errors
          if (attempt === maxRetries) {
            errors.push({
              attempt,
              error: errorMessage,
              timestamp: new Date().toISOString(),
            });

            // Enhanced error logging
            this.logger.error(
              JSON.stringify({
                event: 'STK_PUSH_RETRY_EXHAUSTED',
                correlationId,
                merchantRequestId,
                errorType: 'RETRY_EXHAUSTION',
                errors,
                transactionDetails: {
                  phoneNumber,
                  amount,
                  accountReference,
                },
                timestamp: new Date().toISOString(),
              })
            );

            // Metric: Retry exhaustion events
            this.logger.log(
              JSON.stringify({
                event: 'METRIC_RETRY_EXHAUSTED',
                metricType: 'counter',
                metricName: 'retry_exhaustion_events',
                value: 1,
                api: 'STK_PUSH',
                correlationId,
                timestamp: new Date().toISOString(),
              })
            );

            Sentry.captureException(error, {
              tags: {
                service: 'MpesaDarajaApiService',
                operation: 'initiateStkPush',
                correlationId,
              },
              extra: {
                phoneNumber,
                amount,
                accountReference,
                merchantRequestId,
                errors,
              },
            });

            // For network errors, throw generic error
            throw new Error(`STK Push failed after ${maxRetries} attempts. Errors: ${JSON.stringify(errors)}`);
          }
        }

        errors.push({
          attempt,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        });

        // Wait before retry with exponential backoff
        await this.sleep(retryDelays[attempt - 1]);
      }
    }

    // This should never be reached, but TypeScript needs it
    throw new Error(`STK Push failed after ${maxRetries} attempts. Errors: ${JSON.stringify(errors)}`);
  }

  /**
   * Generate timestamp in format YYYYMMDDHHmmss
   */
  private generateTimestamp(): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const hours = String(now.getUTCHours()).padStart(2, '0');
    const minutes = String(now.getUTCMinutes()).padStart(2, '0');
    const seconds = String(now.getUTCSeconds()).padStart(2, '0');

    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  /**
   * Generate password for STK Push
   *
   * Formula: Base64(BusinessShortCode + Passkey + Timestamp)
   */
  private generatePassword(businessShortCode: string, passkey: string, timestamp: string): string {
    const passwordString = `${businessShortCode}${passkey}${timestamp}`;
    return Buffer.from(passwordString).toString('base64');
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

