import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsObject } from 'class-validator';

/**
 * Error Details for the Error Response
 */
export class ErrorDetailsDto {
  @ApiProperty({
    description: 'Error code for programmatic handling',
    example: 'VALIDATION_ERROR',
    enum: [
      'VALIDATION_ERROR',
      'DUPLICATE_EMAIL',
      'DUPLICATE_ID_NUMBER',
      'MALFORMED_REQUEST',
      'AUTHENTICATION_ERROR',
      'AUTHORIZATION_ERROR',
      'NOT_FOUND',
      'DATABASE_ERROR',
      'EXTERNAL_SERVICE_ERROR',
      'RATE_LIMIT_EXCEEDED',
      'INTERNAL_SERVER_ERROR'
    ]
  })
  @IsString()
  code: string;

  @ApiProperty({
    description: 'HTTP status code',
    example: 422
  })
  @IsNumber()
  status: number;

  @ApiProperty({
    description: 'Human-readable error message',
    example: 'One or more fields failed validation'
  })
  @IsString()
  message: string;

  @ApiProperty({
    description: 'Field-specific error details',
    example: {
      'email': 'Email address already exists',
      'id_number': 'ID number already exists for this ID type'
    },
    required: false
  })
  @IsOptional()
  @IsObject()
  details?: Record<string, string>;

  @ApiProperty({
    description: 'Request correlation ID for tracing',
    example: 'req-12345-67890'
  })
  @IsString()
  correlationId: string;

  @ApiProperty({
    description: 'ISO timestamp when error occurred',
    example: '2025-09-15T10:32:45.123Z'
  })
  @IsString()
  timestamp: string;

  @ApiProperty({
    description: 'API endpoint path where error occurred',
    example: '/api/v1/customers',
    required: false
  })
  @IsOptional()
  @IsString()
  path?: string;

  @ApiProperty({
    description: 'Stack trace (development environment only)',
    example: 'ValidationException: One or more fields failed validation',
    required: false
  })
  @IsOptional()
  @IsString()
  stack?: string;
}

/**
 * Standard Error Response DTO
 *
 * Provides a consistent error response format across all API endpoints.
 * Supports multiple validation errors, error codes, and environment-specific details.
 */
export class StandardErrorResponseDto {
  @ApiProperty({
    description: 'Error information container',
    type: ErrorDetailsDto
  })
  error: ErrorDetailsDto;
}
