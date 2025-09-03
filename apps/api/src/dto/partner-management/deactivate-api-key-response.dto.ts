import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for API key deactivation response via public API
 */
export class DeactivateApiKeyResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 200,
  })
  status: number;

  @ApiProperty({
    description: 'Correlation ID for request tracing',
    example: 'req_123456789',
  })
  correlationId: string;

  @ApiProperty({
    description: 'Response message',
    example: 'API key deactivated successfully',
  })
  message: string;

  @ApiProperty({
    description: 'API key deactivation result',
    type: 'object',
    properties: {
      success: {
        type: 'boolean',
        description: 'Whether the API key was successfully deactivated',
        example: true,
      },
    },
  })
  data: {
    success: boolean;
  };
}
