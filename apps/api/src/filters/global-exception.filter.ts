import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { SentryExceptionCaptured } from '@sentry/nestjs';
import { ExternalIntegrationsService } from '../services/external-integrations.service';
import { ErrorCodes } from '../enums/error-codes.enum';
import { ValidationException } from '../exceptions/validation.exception';

/**
 * Global Exception Filter
 *
 * Catches all unhandled exceptions and formats them consistently
 * Prepares for Sentry integration for error monitoring
 *
 * Features:
 * - Consistent error response format
 * - Correlation ID inclusion
 * - Request context logging
 * - Sentry integration (to be added)
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly externalIntegrationsService: ExternalIntegrationsService) {}

  @SentryExceptionCaptured()
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    // Extract correlation ID from request
    const correlationId = request.correlationId || 'unknown';

    // Determine HTTP status code
    const status = this.getHttpStatus(exception);

    // Create consistent error response using new format
    const errorResponse = {
      error: {
        code: this.getErrorCode(exception),
        status: status,
        message: this.getErrorMessage(exception),
        details: this.getErrorDetails(exception),
        correlationId: correlationId,
        timestamp: new Date().toISOString(),
        path: request.url,
        // Stack trace only in development
        ...(process.env.NODE_ENV === 'development' && {
          stack: exception instanceof Error ? exception.stack : undefined,
        }),
      },
    };

    // Log the error with correlation ID
    this.logError(exception, request, correlationId);

    // For validation errors, also log the request body to help debug
    if (status === HttpStatus.BAD_REQUEST && exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as { message?: string | string[] };
        if (Array.isArray(responseObj.message) || (typeof responseObj.message === 'string' && responseObj.message.includes('validation'))) {
          this.logger.debug(
            JSON.stringify({
              event: 'VALIDATION_ERROR_DETAILS',
              correlationId,
              path: request.url,
              method: request.method,
              requestBody: request.body,
              validationErrors: responseObj.message,
              timestamp: new Date().toISOString(),
            })
          );
        }
      }
    }

    // Report error to Sentry asynchronously (non-blocking)
    if (exception instanceof Error) {
      const sentryContext: Record<string, unknown> = {
        correlationId,
        requestUrl: request.url,
        requestMethod: request.method,
        userId: request['userId'], // Will be set by auth middleware
      };
      // Include request body for policy creation errors to aid debugging
      if (request.method === 'POST' && request.url?.includes('/internal/policies')) {
        sentryContext.requestBody = request.body;
      }
      this.externalIntegrationsService.reportErrorToSentry(exception, sentryContext);
    }

    // Send the error response
    response.status(status).json(errorResponse);
  }

  /**
   * Get HTTP status code from exception
   */
  private getHttpStatus(exception: unknown): number {
    if (exception instanceof ValidationException) {
      return exception.getStatus();
    }

    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    if (exception instanceof Error) {
      // Handle Prisma database errors with appropriate status codes
      if (exception.message.includes('Unique constraint failed')) {
        return HttpStatus.UNPROCESSABLE_ENTITY; // 422 for validation errors
      }

      if (exception.message.includes('Foreign key constraint failed')) {
        return HttpStatus.BAD_REQUEST; // 400 for invalid references
      }

      // Handle Prisma validation errors (like Invalid Date)
      if (exception.message.includes('Invalid value for argument') ||
          exception.message.includes('Provided Date object is invalid')) {
        return HttpStatus.UNPROCESSABLE_ENTITY; // 422 for validation errors
      }
    }

    // Default to 500 for unknown exceptions
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  /**
   * Get error code from exception
   */
  private getErrorCode(exception: unknown): string {
    if (exception instanceof ValidationException) {
      return exception.errorCode;
    }

    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'object' && response !== null && 'error' in response) {
        const errorObj = (response as { error?: { code?: string } }).error;
        if (errorObj && errorObj.code) {
          return errorObj.code;
        }
      }
    }

    if (exception instanceof Error) {
      // Handle Prisma database errors
      if (exception.message.includes('Unique constraint failed')) {
        if (exception.message.includes('email')) {
          return ErrorCodes.DUPLICATE_EMAIL;
        }
        if (exception.message.includes('idType') || exception.message.includes('idNumber')) {
          return ErrorCodes.DUPLICATE_ID_NUMBER;
        }
        return ErrorCodes.RESOURCE_CONFLICT;
      }

      if (exception.message.includes('Foreign key constraint failed')) {
        return ErrorCodes.MALFORMED_REQUEST;
      }

      if (exception.message.includes('Invalid `this.prismaService')) {
        return ErrorCodes.DATABASE_ERROR;
      }

      // Handle Prisma validation errors (like Invalid Date)
      if (exception.message.includes('Invalid value for argument') ||
          exception.message.includes('Provided Date object is invalid')) {
        return ErrorCodes.VALIDATION_ERROR;
      }
    }

    return ErrorCodes.INTERNAL_SERVER_ERROR;
  }

  /**
   * Transform field path to user-friendly field name
   * Examples:
   * - "spouses.0.gender" -> "Spouse 1 gender"
   * - "children.2.firstName" -> "Child 3 first name"
   * - "principalMember.email" -> "Principal member email"
   */
  private transformFieldPath(fieldPath: string): string {
    // Handle array indices (spouses.0, children.1, etc.)
    const spouseMatch = fieldPath.match(/^spouses\.(\d+)\.(.+)$/);
    if (spouseMatch) {
      const index = parseInt(spouseMatch[1], 10) + 1; // Convert 0-based to 1-based
      const field = spouseMatch[2].replace(/([A-Z])/g, ' $1').toLowerCase().trim();
      return `Spouse ${index} ${field}`;
    }

    const childMatch = fieldPath.match(/^children\.(\d+)\.(.+)$/);
    if (childMatch) {
      const index = parseInt(childMatch[1], 10) + 1; // Convert 0-based to 1-based
      const field = childMatch[2].replace(/([A-Z])/g, ' $1').toLowerCase().trim();
      return `Child ${index} ${field}`;
    }

    const beneficiaryMatch = fieldPath.match(/^beneficiaries\.(\d+)\.(.+)$/);
    if (beneficiaryMatch) {
      const index = parseInt(beneficiaryMatch[1], 10) + 1;
      const field = beneficiaryMatch[2].replace(/([A-Z])/g, ' $1').toLowerCase().trim();
      return `Beneficiary ${index} ${field}`;
    }

    // Handle nested objects (principalMember.email, etc.)
    const nestedMatch = fieldPath.match(/^(.+)\.(.+)$/);
    if (nestedMatch) {
      const parent = nestedMatch[1].replace(/([A-Z])/g, ' $1').toLowerCase().trim();
      const field = nestedMatch[2].replace(/([A-Z])/g, ' $1').toLowerCase().trim();
      return `${parent} ${field}`;
    }

    // Default: capitalize first letter and add spaces before capitals
    return fieldPath.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
  }

  /**
   * Transform class-validator error message to user-friendly format
   */
  private transformValidationMessage(errorMessage: string): string {
    // Extract field path and error message
    // Format: "spouses.0.gender must be one of the following values: male, female"
    const match = errorMessage.match(/^([^\s]+)\s+(.+)$/);
    if (match) {
      const fieldPath = match[1];
      const errorText = match[2];
      const friendlyFieldName = this.transformFieldPath(fieldPath);

      // Transform common error messages
      if (errorText.includes('must be one of the following values')) {
        // For gender fields, use "is missing" wording as requested
        if (fieldPath.includes('gender')) {
          return `${friendlyFieldName} is missing`;
        }
        // Extract allowed values from error message if possible
        const valuesMatch = errorText.match(/values:\s*(.+)$/);
        if (valuesMatch) {
          const allowedValues = valuesMatch[1].trim();
          return `${friendlyFieldName} must be ${allowedValues}`;
        }
        return `${friendlyFieldName} is invalid`;
      }
      if (errorText.includes('must be a string')) {
        // Check if this is actually a missing field error
        if (errorText.includes('should not be empty') || errorText.includes('is required')) {
          return `${friendlyFieldName} is required`;
        }
        return `${friendlyFieldName} must be text`;
      }
      if (errorText.includes('should not be empty') || errorText.includes('should not be null') || errorText.includes('should not be undefined')) {
        return `${friendlyFieldName} is required`;
      }
      if (errorText.includes('must be an email')) {
        return `${friendlyFieldName} must be a valid email address`;
      }
      if (errorText.includes('must be a valid date')) {
        return `${friendlyFieldName} must be a valid date`;
      }
      if (errorText.includes('is required')) {
        return `${friendlyFieldName} is required`;
      }

      // Default: use friendly field name with error text
      return `${friendlyFieldName} ${errorText}`;
    }

    return errorMessage;
  }

  /**
   * Get error message from exception
   */
  private getErrorMessage(exception: unknown): string {
    if (exception instanceof ValidationException) {
      return exception.message;
    }

    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'object' && response !== null) {
        const responseObj = response as { error?: { message?: string | string[] }; message?: string | string[] };
        const errorObj = responseObj.error;
        if (errorObj && errorObj.message) {
          // Handle class-validator error arrays
          if (Array.isArray(errorObj.message)) {
            if (errorObj.message.length === 1) {
              return this.transformValidationMessage(errorObj.message[0]);
            }
            return `${errorObj.message.length} fields failed validation`;
          }
          return errorObj.message;
        }
        const message = responseObj.message;
        // Handle class-validator error arrays
        if (Array.isArray(message)) {
          if (message.length === 1) {
            return this.transformValidationMessage(message[0]);
          }
          return `${message.length} fields failed validation`;
        }
        return message ?? exception.message;
      }
      return exception.message;
    }

    if (exception instanceof Error) {
      // Handle Prisma database errors
      if (exception.message.includes('Unique constraint failed')) {
        if (exception.message.includes('email')) {
          return 'Email address already exists';
        }
        if (exception.message.includes('idType') || exception.message.includes('idNumber')) {
          return 'ID number already exists for this ID type';
        }
        return 'A record with this information already exists';
      }

      if (exception.message.includes('Foreign key constraint failed')) {
        return 'Invalid reference to related data';
      }

      if (exception.message.includes('Invalid `this.prismaService')) {
        return 'An error occurred while saving the data';
      }

      // Handle Prisma validation errors (like Invalid Date)
      if (exception.message.includes('Invalid value for argument') ||
          exception.message.includes('Provided Date object is invalid')) {
        if (process.env.NODE_ENV === 'production') {
          return 'Invalid data provided. Please check your input and try again.';
        }
        return exception.message;
      }

      // For other database errors, return generic message in production
      if (process.env.NODE_ENV === 'production') {
        return 'An error occurred while processing your request';
      }

      return exception.message;
    }

    return 'Internal server error';
  }

  /**
   * Get error type for response
   */
  private getErrorType(exception: unknown): string {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status === 422) {
        return 'Validation Error';
      }
      if (status >= 400 && status < 500) {
        return 'Bad Request';
      }
      return 'Internal Server Error';
    }

    return 'Internal Server Error';
  }

  /**
   * Get additional error details
   */
  private getErrorDetails(exception: unknown): Record<string, string> | undefined {
    if (exception instanceof ValidationException) {
      return exception.errorDetails;
    }

    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'object' && response !== null) {
        const responseObj = response as { error?: { details?: Record<string, string>; message?: string | string[] }; message?: string | string[] };
        const errorObj = responseObj.error;
        if (errorObj && errorObj.details) {
          return errorObj.details;
        }

        // Handle class-validator error arrays - transform to friendly format
        const message = errorObj?.message ?? responseObj.message;
        if (Array.isArray(message)) {
          const details: Record<string, string> = {};
          message.forEach((errorMsg: string) => {
            // Extract field path from error message
            const match = errorMsg.match(/^([^\s]+)\s+(.+)$/);
            if (match) {
              const fieldPath = match[1];
              details[fieldPath] = this.transformValidationMessage(errorMsg);
            } else {
              // Fallback: use error message as-is
              details['unknown'] = errorMsg;
            }
          });
          return details;
        }
        return undefined;
      }
    }

    return undefined;
  }

  /**
   * Log error with correlation ID and request context
   */
  private logError(exception: unknown, request: Request, correlationId: string) {
    const errorMessage = this.getErrorMessage(exception);
    const status = this.getHttpStatus(exception);

    this.logger.error(
      `[${correlationId}] ${request.method} ${request.url} - ${status}: ${errorMessage}`,
      exception instanceof Error ? exception.stack : undefined,
      'GlobalExceptionFilter',
    );
  }

}
