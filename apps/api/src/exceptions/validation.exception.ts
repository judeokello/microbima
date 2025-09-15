import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Custom exception for validation errors
 * Returns 422 Unprocessable Entity status code
 */
export class ValidationException extends HttpException {
  constructor(message: string, details?: any) {
    super(
      {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        message,
        error: 'Validation Error',
        details,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
