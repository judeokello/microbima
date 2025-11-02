import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsArray,
  ValidateNested,
  IsDateString,
  IsInt,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentFrequency } from '@prisma/client';

export class TagInputDto {
  @ApiProperty({
    description: 'Tag ID (if tag already exists)',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  id?: number;

  @ApiProperty({
    description: 'Tag name (required if id is not provided)',
    example: 'corporate',
  })
  @IsString()
  @MinLength(1)
  name: string;
}

export class PaymentDataDto {
  @ApiProperty({
    description: 'Payment type',
    example: 'MPESA',
    enum: ['MPESA', 'SASAPAY'],
  })
  @IsEnum(['MPESA', 'SASAPAY'])
  paymentType: 'MPESA' | 'SASAPAY';

  @ApiProperty({
    description: 'Transaction reference',
    example: 'MPX123456789',
  })
  @IsString()
  @MinLength(1)
  transactionReference: string;

  @ApiProperty({
    description: 'Payment amount',
    example: 5000.00,
  })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({
    description: 'Account number',
    example: '254712345678',
    required: false,
  })
  @IsOptional()
  @IsString()
  accountNumber?: string;

  @ApiProperty({
    description: 'Payment details',
    example: 'Premium payment for policy',
    required: false,
  })
  @IsOptional()
  @IsString()
  details?: string;

  @ApiProperty({
    description: 'Expected payment date (ISO string)',
    example: '2024-10-01T00:00:00Z',
  })
  @IsDateString()
  expectedPaymentDate: string;

  @ApiProperty({
    description: 'Actual payment date (ISO string)',
    example: '2024-10-01T12:30:00Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  actualPaymentDate?: string;

  @ApiProperty({
    description: 'Payment message blob',
    example: 'Payment confirmation message',
    required: false,
  })
  @IsOptional()
  @IsString()
  paymentMessageBlob?: string;
}

export class CreatePolicyRequestDto {
  @ApiProperty({
    description: 'Customer ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @MinLength(1)
  customerId: string;

  @ApiProperty({
    description: 'Package ID',
    example: 1,
  })
  @IsInt()
  @Min(1)
  packageId: number;

  @ApiProperty({
    description: 'Package plan ID',
    example: 1,
  })
  @IsInt()
  @Min(1)
  packagePlanId: number;

  @ApiProperty({
    description: 'Payment frequency',
    example: 'MONTHLY',
    enum: PaymentFrequency,
  })
  @IsEnum(PaymentFrequency)
  frequency: PaymentFrequency;

  @ApiProperty({
    description: 'Premium amount',
    example: 5000.00,
  })
  @IsNumber()
  @Min(0)
  premium: number;

  @ApiProperty({
    description: 'Product name (format: "Package Name - Plan Name")',
    example: 'MfanisiGo - Gold',
  })
  @IsString()
  @MinLength(1)
  productName: string;

  @ApiProperty({
    description: 'Tags associated with the policy',
    type: [TagInputDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TagInputDto)
  tags?: TagInputDto[];

  @ApiProperty({
    description: 'Payment data',
    type: PaymentDataDto,
  })
  @ValidateNested()
  @Type(() => PaymentDataDto)
  paymentData: PaymentDataDto;

  @ApiProperty({
    description: 'Custom days for CUSTOM frequency',
    example: 45,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  customDays?: number;
}

export class PolicyResponseDto {
  @ApiProperty({
    description: 'Policy ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Policy number',
    example: 'MP/MFG/001',
  })
  policyNumber: string;

  @ApiProperty({
    description: 'Policy status',
    example: 'PENDING_ACTIVATION',
  })
  status: string;

  @ApiProperty({
    description: 'Product name',
    example: 'MfanisiGo - Gold',
  })
  productName: string;

  @ApiProperty({
    description: 'Premium amount',
    example: 5000.00,
  })
  premium: number;

  @ApiProperty({
    description: 'Start date',
    example: '2024-10-01T00:00:00Z',
  })
  startDate: string;

  @ApiProperty({
    description: 'End date',
    example: '2025-10-01T00:00:00Z',
  })
  endDate: string;
}

export class PolicyPaymentResponseDto {
  @ApiProperty({
    description: 'Payment ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Payment type',
    example: 'MPESA',
  })
  paymentType: string;

  @ApiProperty({
    description: 'Transaction reference',
    example: 'MPX123456789',
  })
  transactionReference: string;

  @ApiProperty({
    description: 'Payment amount',
    example: 5000.00,
  })
  amount: number;

  @ApiProperty({
    description: 'Expected payment date',
    example: '2024-10-01T00:00:00Z',
  })
  expectedPaymentDate: string;

  @ApiProperty({
    description: 'Actual payment date',
    example: '2024-10-01T12:30:00Z',
    required: false,
  })
  actualPaymentDate?: string;
}

export class CreatePolicyResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 201,
  })
  status: number;

  @ApiProperty({
    description: 'Correlation ID from request',
    example: 'req-policy-12345',
  })
  correlationId: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Policy and payment created successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Created policy data',
    type: PolicyResponseDto,
  })
  policy: PolicyResponseDto;

  @ApiProperty({
    description: 'Created payment data',
    type: PolicyPaymentResponseDto,
  })
  payment: PolicyPaymentResponseDto;
}

