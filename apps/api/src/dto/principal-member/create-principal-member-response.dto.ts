import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsBoolean, IsOptional } from 'class-validator';

export class PolicyInfoDto {
  @ApiProperty({
    description: 'Whether the policy was issued',
    example: true
  })
  @IsBoolean()
  issued: boolean;

  @ApiProperty({
    description: 'Policy number',
    example: 'POL-MFG-1755245811023-5193'
  })
  @IsString()
  policyNumber: string | null;

  @ApiProperty({
    description: 'Product code',
    example: 'mfanisi-go'
  })
  @IsString()
  productCode: string;

  @ApiProperty({
    description: 'Product name',
    example: 'Mfanisi Go Medical Coverage'
  })
  @IsString()
  productName: string;

  @ApiProperty({
    description: 'Policy status',
    example: 'active'
  })
  @IsString()
  status: string;
}

export class PaymentInfoDto {
  @ApiProperty({
    description: 'Product name',
    example: 'Mfanisi Go Medical Coverage'
  })
  @IsString()
  productName: string;

  @ApiProperty({
    description: 'Daily payment amount',
    example: 0
  })
  @IsNumber()
  dailyAmount: number;

  @ApiProperty({
    description: 'Total payment amount',
    example: 0
  })
  @IsNumber()
  totalAmount: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'KES'
  })
  @IsString()
  currency: string;
}

export class DependantInfoDto {
  @ApiProperty({
    description: 'Database ID of the dependant',
    example: '1234567890'
  })
  @IsString()
  dependantId: string;

  @ApiProperty({
    description: 'First name',
    example: 'Tommy'
  })
  @IsString()
  firstName: string;

  @ApiProperty({
    description: 'Last name',
    example: 'Doe'
  })
  @IsString()
  lastName: string;

  @ApiProperty({
    description: 'Date of birth',
    example: '2010-05-15'
  })
  @IsString()
  dateOfBirth: string;

  @ApiProperty({
    description: 'Gender',
    enum: ['male', 'female'],
    example: 'male'
  })
  @IsString()
  gender: string;

  @ApiProperty({
    description: 'Email address (for spouses)',
    example: 'jane.doe@example.com',
    required: false
  })
  email?: string;

  @ApiProperty({
    description: 'ID type (for spouses)',
    example: 'national',
    required: false
  })
  idType?: string;

  @ApiProperty({
    description: 'ID number (for spouses)',
    example: '87654321',
    required: false
  })
  idNumber?: string;
}

export class BeneficiaryInfoDto {
  @ApiProperty({
    description: 'Database ID of the beneficiary',
    example: '9876543210'
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

  @ApiProperty({
    description: 'Address information',
    type: 'object',
    additionalProperties: true
  })
  address?: {
    street?: string;
    city?: string;
    county?: string;
    postalCode?: string;
  };
}

export class DependantsInfoDto {
  @ApiProperty({
    description: 'Array of children',
    type: [DependantInfoDto]
  })
  children: DependantInfoDto[];

  @ApiProperty({
    description: 'Array of spouses',
    type: [DependantInfoDto]
  })
  spouses: DependantInfoDto[];

  @ApiProperty({
    description: 'Total number of dependants',
    example: 2
  })
  @IsNumber()
  totalDependants: number;
}

export class CreatePrincipalMemberResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 201
  })
  @IsNumber()
  status: number;

  @ApiProperty({
    description: 'Correlation ID from request',
    example: 'req-12345-67890'
  })
  @IsString()
  correlationId: string;

  @ApiProperty({
    description: 'Optional referral information',
    example: 'Agent Smith',
    required: false
  })
  @IsString()
  referredBy?: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Principal member created successfully'
  })
  @IsString()
  message: string;

  @ApiProperty({
    description: 'Response data',
    type: 'object',
    additionalProperties: true
  })
  data: {
    principalId: string;
    partnerCustomerId: string;
    policy: PolicyInfoDto;
    payment: PaymentInfoDto;
    dependants: DependantsInfoDto;
    beneficiaries: BeneficiaryInfoDto[];
  };
}
