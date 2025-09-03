import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for API key generation response via internal API
 */
export class GenerateApiKeyResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 201,
  })
  status: number;

  @ApiProperty({
    description: 'Correlation ID for request tracing',
    example: 'req_123456789',
  })
  correlationId: string;

  @ApiProperty({
    description: 'Response message',
    example: 'API key generated successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Generated API key data',
    type: 'object',
    properties: {
      apiKey: {
        type: 'string',
        description: 'Generated API key (plain text)',
        example: 'mb_abc123def456...',
      },
      partnerId: {
        type: 'string',
        description: 'Partner ID',
        example: 'partner_123456789',
      },
      createdAt: {
        type: 'string',
        description: 'Creation timestamp',
        example: '2024-01-15T10:30:00.000Z',
      },
    },
  })
  data: {
    apiKey: string;
    partnerId: string;
    createdAt: string;
  };
}
