import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for partner creation response via internal API
 */
export class CreatePartnerResponseDto {
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
    example: 'Partner created successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Created partner data',
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Partner ID',
        example: 'partner_123456789',
      },
      partnerName: {
        type: 'string',
        description: 'Partner name',
        example: 'Acme Insurance Ltd',
      },
      website: {
        type: 'string',
        description: 'Partner website URL',
        example: 'https://acme-insurance.com',
        nullable: true,
      },
      officeLocation: {
        type: 'string',
        description: 'Partner office location',
        example: 'Nairobi, Kenya',
        nullable: true,
      },
      isActive: {
        type: 'boolean',
        description: 'Partner active status',
        example: true,
      },
      createdAt: {
        type: 'string',
        description: 'Creation timestamp',
        example: '2024-01-15T10:30:00.000Z',
      },
      updatedAt: {
        type: 'string',
        description: 'Last update timestamp',
        example: '2024-01-15T10:30:00.000Z',
      },
    },
  })
  data: {
    id: string;
    partnerName: string;
    website?: string;
    officeLocation?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
}
