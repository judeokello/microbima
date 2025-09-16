import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AddedBeneficiaryDto {
  @ApiProperty({
    description: 'Database ID of the created beneficiary',
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

export class BeneficiariesSummaryDto {
  @ApiProperty({
    description: 'Total number of beneficiaries processed',
    example: 2
  })
  @IsNumber()
  totalProcessed: number;

  @ApiProperty({
    description: 'Whether all beneficiaries were added successfully',
    example: true
  })
  @IsBoolean()
  success: boolean;

  @ApiProperty({
    description: 'Result message',
    example: '2 beneficiaries added successfully'
  })
  @IsString()
  message: string;

  @ApiProperty({
    description: 'Array of successfully added beneficiaries with their IDs',
    type: [AddedBeneficiaryDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddedBeneficiaryDto)
  addedBeneficiaries: AddedBeneficiaryDto[];
}

export class AddBeneficiariesResponseDataDto {
  @ApiProperty({
    description: 'Partner customer ID',
    example: 'CUST-2024-001'
  })
  @IsString()
  partnerCustomerId: string;

  @ApiProperty({
    description: 'Beneficiaries processing summary',
    type: BeneficiariesSummaryDto
  })
  @ValidateNested()
  @Type(() => BeneficiariesSummaryDto)
  beneficiaries: BeneficiariesSummaryDto;
}

export class AddBeneficiariesResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 201
  })
  @IsNumber()
  status: number;

  @ApiProperty({
    description: 'Correlation ID from request',
    example: 'req-add-beneficiaries-12345'
  })
  @IsString()
  correlationId: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Beneficiaries added successfully'
  })
  @IsString()
  message: string;

  @ApiProperty({
    description: 'Response data',
    type: AddBeneficiariesResponseDataDto
  })
  @ValidateNested()
  @Type(() => AddBeneficiariesResponseDataDto)
  data: AddBeneficiariesResponseDataDto;
}
