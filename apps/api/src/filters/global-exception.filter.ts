import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ExternalIntegrationsService } from '../services/external-integrations.service';

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

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    
    // Extract correlation ID from request
    const correlationId = request.correlationId || 'unknown';
    
    // Determine HTTP status code
    const status = this.getHttpStatus(exception);
    
    // Create consistent error response
    const errorResponse = {
      statusCode: status,
      message: this.getErrorMessage(exception),
      error: this.getErrorType(exception),
      timestamp: new Date().toISOString(),
      path: request.url,
      correlationId: correlationId,
      // Additional context for debugging (only in development)
      ...(process.env.NODE_ENV === 'development' && {
        stack: exception instanceof Error ? exception.stack : undefined,
        details: this.getErrorDetails(exception),
      }),
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
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    
    // Default to 500 for unknown exceptions
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  /**
   * Get error message from exception
   */
  private getErrorMessage(exception: unknown): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'object' && response !== null) {
        return (response as any).message || exception.message;
      }
      return exception.message;
    }
    
    if (exception instanceof Error) {
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
      if (status >= 400 && status < 500) {
        return 'Bad Request';
      }
      return 'Internal Server Error';
    }
    
    return 'Internal Server Error';
  }

  /**
   * Get additional error details (for development only)
   */
  private getErrorDetails(exception: unknown): any {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'object' && response !== null) {
        return response;
      }
    }
    
    return {
      name: exception instanceof Error ? exception.name : 'Unknown',
      constructor: exception?.constructor?.name || 'Unknown',
    };
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
