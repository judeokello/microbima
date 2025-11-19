import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, IsObject } from 'class-validator';

export class ErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 400,
    type: Number
  })
  @IsNumber()
  status: number;

  @ApiProperty({
    description: 'Correlation ID for request tracing',
    example: 'req-12345-67890',
    required: false,
    nullable: true
  })
  @IsOptional()
  @IsString()
  correlationId?: string;

  @ApiProperty({
    description: 'Error type',
    example: 'Validation error'
  })
  @IsString()
  error: string;

  @ApiProperty({
    description: 'Detailed error message',
    example: 'Required field \'firstName\' is missing'
  })
  @IsString()
  message: string;

  @ApiProperty({
    description: 'Additional error details',
    required: false,
    type: Object
  })
  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>;
}
