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
import { PaymentFrequency, PaymentType } from '@prisma/client';

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
    enum: ['MPESA', 'SASAPAY', 'BANK_TRANSFER', 'CHEQUE'],
  })
  @IsEnum(PaymentType)
  paymentType: PaymentType;

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

/** T057: Optional override for messaging recipients (dev/staging only). When set, SMS/email go to these instead of the customer's. */
export class MessagingOverrideDto {
  @ApiProperty({ description: 'Override email recipient', required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ description: 'Override SMS recipient phone', required: false })
  @IsOptional()
  @IsString()
  phone?: string;
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

  @ApiProperty({
    description: 'Optional messaging recipient override (dev/staging only). When set, SMS/email are sent to these instead of the customer.',
    type: MessagingOverrideDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => MessagingOverrideDto)
  messagingOverride?: MessagingOverrideDto;
}

export class PolicyResponseDto {
  @ApiProperty({
    description: 'Policy ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Policy number (null for postpaid policies until activation)',
    example: 'MP/MFG/001',
    nullable: true,
  })
  policyNumber: string | null;

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

  @ApiProperty({
    description: 'Payment account number (null for postpaid policies)',
    example: '1234567890',
    nullable: true,
  })
  paymentAcNumber: string | null;
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

