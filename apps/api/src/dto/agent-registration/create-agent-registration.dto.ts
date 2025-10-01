import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, IsEnum, IsOptional, IsDateString, IsBoolean } from 'class-validator';
import { RegistrationStatus } from '@prisma/client';

export class CreateAgentRegistrationDto {
  @ApiProperty({
    description: 'Brand Ambassador ID who is creating the registration',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsUUID()
  baId: string;

  @ApiProperty({
    description: 'Customer ID being registered',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsString()
  @IsUUID()
  customerId: string;

  @ApiProperty({
    description: 'Partner ID for the registration',
    example: 1,
  })
  @IsString()
  partnerId: string;

  @ApiPropertyOptional({
    description: 'Registration status',
    enum: RegistrationStatus,
    default: RegistrationStatus.IN_PROGRESS,
  })
  @IsOptional()
  @IsEnum(RegistrationStatus)
  registrationStatus?: RegistrationStatus;

  @ApiPropertyOptional({
    description: 'Date when registration was completed',
    example: '2024-01-15T10:30:00Z',
  })
  @IsOptional()
  @IsDateString()
  completedAt?: string;
}
