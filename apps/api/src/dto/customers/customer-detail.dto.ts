import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PrincipalMemberDto } from '../principal-member/principal-member.dto';

export class PolicySummaryDto {
  @ApiProperty({
    description: 'Policy ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'Policy number',
    example: 'MP/MFG/001',
  })
  @IsString()
  policyNumber: string;

  @ApiProperty({
    description: 'Package name',
    example: 'MfanisiGo',
  })
  @IsString()
  packageName: string;

  @ApiProperty({
    description: 'Package plan name',
    example: 'Gold',
    required: false,
  })
  @IsOptional()
  @IsString()
  planName?: string;

  @ApiProperty({
    description: 'Policy status',
    example: 'ACTIVE',
  })
  @IsString()
  status: string;
}

export class BeneficiarySummaryDto {
  @ApiProperty({
    description: 'Beneficiary ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'First name',
    example: 'Jane',
  })
  @IsString()
  firstName: string;

  @ApiProperty({
    description: 'Middle name',
    example: 'Marie',
    required: false,
  })
  @IsOptional()
  @IsString()
  middleName?: string;

  @ApiProperty({
    description: 'Last name',
    example: 'Doe',
  })
  @IsString()
  lastName: string;

  @ApiProperty({
    description: 'Date of birth',
    example: '1990-05-15',
    required: false,
  })
  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @ApiProperty({
    description: 'Phone number',
    example: '+254712345678',
    required: false,
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiProperty({
    description: 'Gender',
    example: 'male',
    enum: ['male', 'female'],
    required: false,
  })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiProperty({
    description: 'ID type',
    example: 'national',
  })
  @IsString()
  idType: string;

  @ApiProperty({
    description: 'ID number',
    example: '12345678',
  })
  @IsString()
  idNumber: string;
}

export class DependantSummaryDto {
  @ApiProperty({
    description: 'Dependant ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'First name',
    example: 'Alice',
  })
  @IsString()
  firstName: string;

  @ApiProperty({
    description: 'Middle name',
    example: 'Rose',
    required: false,
  })
  @IsOptional()
  @IsString()
  middleName?: string;

  @ApiProperty({
    description: 'Last name',
    example: 'Doe',
  })
  @IsString()
  lastName: string;

  @ApiProperty({
    description: 'Date of birth',
    example: '2010-05-15',
    required: false,
  })
  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @ApiProperty({
    description: 'Phone number (for spouses)',
    example: '+254712345678',
    required: false,
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiProperty({
    description: 'Gender',
    example: 'male',
    enum: ['male', 'female'],
    required: false,
  })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiProperty({
    description: 'ID type',
    example: 'national',
    required: false,
  })
  @IsOptional()
  @IsString()
  idType?: string;

  @ApiProperty({
    description: 'ID number',
    example: '12345678',
    required: false,
  })
  @IsOptional()
  @IsString()
  idNumber?: string;

  @ApiProperty({
    description: 'Relationship to customer',
    example: 'SPOUSE',
  })
  @IsString()
  relationship: string;
}

export class CustomerDetailDataDto {
  @ApiProperty({
    description: 'Customer information',
    type: PrincipalMemberDto,
  })
  @ValidateNested()
  @Type(() => PrincipalMemberDto)
  customer: PrincipalMemberDto & {
    id: string;
    createdAt: string;
    createdBy?: string;
  };

  @ApiProperty({
    description: 'List of beneficiaries (Next of Kin)',
    type: [BeneficiarySummaryDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BeneficiarySummaryDto)
  beneficiaries: BeneficiarySummaryDto[];

  @ApiProperty({
    description: 'List of dependants (spouses and children)',
    type: [DependantSummaryDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DependantSummaryDto)
  dependants: DependantSummaryDto[];

  @ApiProperty({
    description: 'List of customer policies',
    type: [PolicySummaryDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PolicySummaryDto)
  policies: PolicySummaryDto[];
}

export class CustomerDetailResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 200,
  })
  status: number;

  @ApiProperty({
    description: 'Correlation ID from request',
    example: 'req-customer-detail-12345',
  })
  correlationId: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Customer details retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Customer detail data',
    type: CustomerDetailDataDto,
  })
  @ValidateNested()
  @Type(() => CustomerDetailDataDto)
  data: CustomerDetailDataDto;
}


