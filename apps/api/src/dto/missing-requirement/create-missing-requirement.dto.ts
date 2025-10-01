import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, IsEnum, IsOptional } from 'class-validator';
import { RegistrationEntityKind, RegistrationMissingStatus } from '@prisma/client';

export class CreateMissingRequirementDto {
  @ApiProperty({
    description: 'Registration ID this missing requirement belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsUUID()
  registrationId: string;

  @ApiProperty({
    description: 'Customer ID this missing requirement belongs to',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsString()
  @IsUUID()
  customerId: string;

  @ApiProperty({
    description: 'Partner ID',
    example: 1,
  })
  @IsString()
  partnerId: string;

  @ApiProperty({
    description: 'Entity kind this requirement applies to',
    enum: RegistrationEntityKind,
    example: RegistrationEntityKind.CUSTOMER,
  })
  @IsEnum(RegistrationEntityKind)
  entityKind: RegistrationEntityKind;

  @ApiPropertyOptional({
    description: 'ID of the specific entity (spouse/child/beneficiary) if applicable',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  entityId?: string;

  @ApiProperty({
    description: 'Field path that is missing',
    example: 'firstName',
  })
  @IsString()
  fieldPath: string;

  @ApiPropertyOptional({
    description: 'Status of the missing requirement',
    enum: RegistrationMissingStatus,
    default: RegistrationMissingStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(RegistrationMissingStatus)
  status?: RegistrationMissingStatus;
}
