import { PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsDateString, IsString } from 'class-validator';
import { RegistrationMissingStatus } from '@prisma/client';
import { CreateMissingRequirementDto } from './create-missing-requirement.dto';

export class UpdateMissingRequirementDto extends PartialType(CreateMissingRequirementDto) {
  @ApiPropertyOptional({
    description: 'Status of the missing requirement',
    enum: RegistrationMissingStatus,
  })
  @IsOptional()
  @IsEnum(RegistrationMissingStatus)
  status?: RegistrationMissingStatus;

  @ApiPropertyOptional({
    description: 'Date when requirement was resolved',
    example: '2024-01-15T10:30:00Z',
  })
  @IsOptional()
  @IsDateString()
  resolvedAt?: string;

  @ApiPropertyOptional({
    description: 'User ID who resolved the requirement',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  resolvedBy?: string;
}
