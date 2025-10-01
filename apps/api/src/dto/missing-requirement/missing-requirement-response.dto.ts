import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RegistrationEntityKind, RegistrationMissingStatus } from '@prisma/client';

export class MissingRequirementResponseDto {
  @ApiProperty({
    description: 'Missing requirement ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Registration ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  registrationId: string;

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
    description: 'Entity kind',
    enum: RegistrationEntityKind,
    example: RegistrationEntityKind.CUSTOMER,
  })
  entityKind: RegistrationEntityKind;

  @ApiPropertyOptional({
    description: 'Entity ID if applicable',
    example: '123e4567-e89b-12d3-a456-426614174003',
  })
  entityId?: string;

  @ApiProperty({
    description: 'Field path that is missing',
    example: 'firstName',
  })
  fieldPath: string;

  @ApiProperty({
    description: 'Status of the missing requirement',
    enum: RegistrationMissingStatus,
    example: RegistrationMissingStatus.PENDING,
  })
  status: RegistrationMissingStatus;

  @ApiPropertyOptional({
    description: 'Date when requirement was resolved',
    example: '2024-01-15T10:30:00Z',
  })
  resolvedAt?: Date;

  @ApiPropertyOptional({
    description: 'User ID who resolved the requirement',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  resolvedBy?: string;

  @ApiProperty({
    description: 'Creation date',
    example: '2024-01-10T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update date',
    example: '2024-01-15T10:30:00Z',
  })
  updatedAt: Date;
}
