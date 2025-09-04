import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for partner list response via internal API
 */
export class PartnerListResponseDto {
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
    example: 'Partners retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Partner list data',
    type: 'object',
    properties: {
      partners: {
        type: 'array',
        description: 'List of partners',
        items: {
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
        },
      },
      pagination: {
        type: 'object',
        description: 'Pagination information',
        properties: {
          page: {
            type: 'number',
            description: 'Current page number',
            example: 1,
          },
          limit: {
            type: 'number',
            description: 'Items per page',
            example: 10,
          },
          total: {
            type: 'number',
            description: 'Total number of partners',
            example: 25,
          },
          totalPages: {
            type: 'number',
            description: 'Total number of pages',
            example: 3,
          },
        },
      },
    },
  })
  data: {
    partners: Array<{
      id: number;
      partnerName: string;
      website?: string;
      officeLocation?: string;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}
