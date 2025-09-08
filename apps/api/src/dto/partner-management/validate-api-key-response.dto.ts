import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for API key validation response via public API
 */
export class ValidateApiKeyResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 200,
  })
  status: number;

  @ApiProperty({
    description: 'Correlation ID for request tracing',
    example: 'req_123456789',
    required: false,
  })
  correlationId?: string;

  @ApiProperty({
    description: 'Response message',
    example: 'API key is valid',
  })
  message: string;

  @ApiProperty({
    description: 'API key validation result',
    type: 'object',
    properties: {
      valid: {
        type: 'boolean',
        description: 'Whether the API key is valid',
        example: true,
      },
      partnerId: {
        type: 'string',
        description: 'Partner ID if valid',
        example: 'partner_123456789',
        nullable: true,
      },
    },
  })
  data: {
    valid: boolean;
    partnerId?: number;
  };
}
