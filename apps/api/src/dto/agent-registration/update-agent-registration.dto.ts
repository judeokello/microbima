import { PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsDateString } from 'class-validator';
import { RegistrationStatus } from '@prisma/client';
import { CreateAgentRegistrationDto } from './create-agent-registration.dto';

export class UpdateAgentRegistrationDto extends PartialType(CreateAgentRegistrationDto) {
  @ApiPropertyOptional({
    description: 'Registration status',
    enum: RegistrationStatus,
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
