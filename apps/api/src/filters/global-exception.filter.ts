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
import { ErrorCodes, ERROR_CODE_STATUS_MAP } from '../enums/error-codes.enum';
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
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

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

    // Report error to Sentry asynchronously (non-blocking)
    if (exception instanceof Error) {
      this.externalIntegrationsService.reportErrorToSentry(exception, {
        correlationId,
        requestUrl: request.url,
        requestMethod: request.method,
        userId: request['userId'], // Will be set by auth middleware
      });
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
      if (typeof response === 'object' && response !== null) {
        const errorObj = (response as any).error;
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
   * Get error message from exception
   */
  private getErrorMessage(exception: unknown): string {
    if (exception instanceof ValidationException) {
      return exception.message;
    }

    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'object' && response !== null) {
        const errorObj = (response as any).error;
        if (errorObj && errorObj.message) {
          return errorObj.message;
        }
        return (response as any).message || exception.message;
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
        const errorObj = (response as any).error;
        if (errorObj && errorObj.details) {
          return errorObj.details;
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
