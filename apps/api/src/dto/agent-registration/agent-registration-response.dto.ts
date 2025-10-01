import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RegistrationStatus } from '@prisma/client';

export class AgentRegistrationResponseDto {
  @ApiProperty({
    description: 'Registration ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Brand Ambassador ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  baId: string;

  @ApiProperty({
    description: 'Customer ID',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  customerId: string;

  @ApiProperty({
    description: 'Partner ID',
    example: 1,
  })
  partnerId: number;

  @ApiProperty({
    description: 'Registration status',
    enum: RegistrationStatus,
    example: RegistrationStatus.IN_PROGRESS,
  })
  registrationStatus: RegistrationStatus;

  @ApiPropertyOptional({
    description: 'Date when registration was completed',
    example: '2024-01-15T10:30:00Z',
  })
  completedAt?: Date;

  @ApiProperty({
    description: 'Registration creation date',
    example: '2024-01-10T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Registration last update date',
    example: '2024-01-15T10:30:00Z',
  })
  updatedAt: Date;

  // Nested objects
  @ApiPropertyOptional({
    description: 'Brand Ambassador details',
    type: 'object',
    additionalProperties: true,
  })
  ba?: {
    id: string;
    displayName: string;
    phoneNumber?: string;
    perRegistrationRateCents: number;
    isActive: boolean;
  };

  @ApiPropertyOptional({
    description: 'Customer details (may be masked for BA users)',
    type: 'object',
    additionalProperties: true,
  })
  customer?: {
    id: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    phoneNumber: string;
    hasMissingRequirements: boolean;
  };

  @ApiPropertyOptional({
    description: 'Partner details',
    type: 'object',
    additionalProperties: true,
  })
  partner?: {
    id: number;
    partnerName: string;
    isActive: boolean;
  };

  @ApiPropertyOptional({
    description: 'Missing requirements for this registration',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        entityKind: { type: 'string' },
        entityId: { type: 'string' },
        fieldPath: { type: 'string' },
        status: { type: 'string' },
      },
    },
  })
  missingRequirements?: Array<{
    id: string;
    entityKind: string;
    entityId?: string;
    fieldPath: string;
    status: string;
    createdAt: Date;
  }>;
}
