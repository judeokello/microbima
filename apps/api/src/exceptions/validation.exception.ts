import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCodes, ERROR_CODE_STATUS_MAP } from '../enums/error-codes.enum';

/**
 * Custom exception for validation errors
 * Supports multiple field errors and standardized error codes
 * Works with NestJS built-in exception handling
 */
export class ValidationException extends HttpException {
  constructor(
    code: ErrorCodes = ErrorCodes.VALIDATION_ERROR,
    message: string,
    details?: Record<string, string>
  ) {
    const status = ERROR_CODE_STATUS_MAP[code];

    // Enhance the message to include error code for better debugging
    const enhancedMessage = `${code}: ${message}`;

    // Work with NestJS built-in format
    super(enhancedMessage, status);

    // Store the error details for potential future use
    this.errorCode = code;
    this.errorDetails = details;
  }

  public readonly errorCode: ErrorCodes;
  public readonly errorDetails?: Record<string, string>;

  /**
   * Create a validation exception with multiple field errors
   */
  static withMultipleErrors(
    errors: Record<string, string>,
    code: ErrorCodes = ErrorCodes.VALIDATION_ERROR
  ): ValidationException {
    const errorCount = Object.keys(errors).length;
    const message = errorCount === 1
      ? 'One field failed validation'
      : `${errorCount} fields failed validation`;

    // Enhance the message to include error code and details
    const enhancedMessage = `${code}: ${message}`;

    return new ValidationException(code, enhancedMessage, errors);
  }

  /**
   * Create a validation exception for a single field
   */
  static forField(
    fieldName: string,
    fieldMessage: string,
    code: ErrorCodes = ErrorCodes.VALIDATION_ERROR
  ): ValidationException {
    return new ValidationException(code, fieldMessage, { [fieldName]: fieldMessage });
  }
}
