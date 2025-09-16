import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class BeneficiaryWithIdDto {
  @ApiProperty({
    description: 'Database ID of the beneficiary',
    example: '1234567890'
  })
  @IsString()
  beneficiaryId: string;

  @ApiProperty({
    description: 'First name',
    example: 'Sarah'
  })
  @IsString()
  firstName: string;

  @ApiProperty({
    description: 'Last name',
    example: 'Johnson'
  })
  @IsString()
  lastName: string;

  @ApiProperty({
    description: 'Date of birth',
    example: '1990-08-15'
  })
  @IsString()
  dateOfBirth: string;

  @ApiProperty({
    description: 'Gender',
    enum: ['male', 'female'],
    example: 'female'
  })
  @IsString()
  gender: string;

  @ApiProperty({
    description: 'Email address',
    example: 'sarah.johnson@example.com',
    required: false
  })
  email?: string;

  @ApiProperty({
    description: 'Phone number',
    example: '+254712345678',
    required: false
  })
  phoneNumber?: string;

  @ApiProperty({
    description: 'ID type',
    example: 'national'
  })
  @IsString()
  idType: string;

  @ApiProperty({
    description: 'ID number',
    example: '12345678'
  })
  @IsString()
  idNumber: string;

  @ApiProperty({
    description: 'Relationship to principal member',
    example: 'spouse'
  })
  @IsString()
  relationship: string;

  @ApiProperty({
    description: 'Relationship description (if relationship is "other")',
    example: 'Life partner',
    required: false
  })
  relationshipDescription?: string;

  @ApiProperty({
    description: 'Percentage of benefits',
    example: 50
  })
  @IsNumber()
  percentage: number;
}

export class GetBeneficiariesDataDto {
  @ApiProperty({
    description: 'Partner customer ID',
    example: 'CUST-2024-001'
  })
  @IsString()
  partnerCustomerId: string;

  @ApiProperty({
    description: 'Array of beneficiaries',
    type: [BeneficiaryWithIdDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BeneficiaryWithIdDto)
  beneficiaries: BeneficiaryWithIdDto[];

  @ApiProperty({
    description: 'Total number of beneficiaries',
    example: 2
  })
  @IsNumber()
  totalBeneficiaries: number;
}

export class GetBeneficiariesResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 200
  })
  @IsNumber()
  status: number;

  @ApiProperty({
    description: 'Correlation ID from request',
    example: 'req-get-beneficiaries-12345'
  })
  @IsString()
  correlationId: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Beneficiaries retrieved successfully'
  })
  @IsString()
  message: string;

  @ApiProperty({
    description: 'Response data',
    type: GetBeneficiariesDataDto
  })
  @ValidateNested()
  @Type(() => GetBeneficiariesDataDto)
  data: GetBeneficiariesDataDto;
}
