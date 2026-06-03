import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsArray,
} from 'class-validator';
import { PaymentStatus } from '@prisma/client';
import { Type, Transform } from 'class-transformer';

function parseCsvToPaymentStatuses(value: unknown): PaymentStatus[] | undefined {
  if (value == null || value === '') return undefined;
  const raw = Array.isArray(value) ? value : String(value).split(',');
  const parts = raw.map((s) => String(s).trim()).filter(Boolean);
  if (parts.length === 0) return undefined;
  return parts as PaymentStatus[];
}

export class CustomerPaymentsFilterDto {
  @ApiProperty({
    description: 'Policy ID to filter payments',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsString()
  policyId?: string;

  @ApiProperty({
    description: 'From date for payment filtering (YYYY-MM-DD), UTC start of day',
    example: '2024-01-01',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiProperty({
    description: 'To date for payment filtering (YYYY-MM-DD), UTC end of day',
    example: '2024-12-31',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiProperty({
    description: 'Filter by payment status (comma-separated or repeated query params)',
    enum: PaymentStatus,
    isArray: true,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => parseCsvToPaymentStatuses(value))
  @IsArray()
  @IsEnum(PaymentStatus, { each: true })
  paymentStatus?: PaymentStatus[];

  @ApiProperty({ description: 'Page number (1-based); use with pageSize', required: false, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ description: 'Page size; pagination applies when both page and pageSize are set', required: false, example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  pageSize?: number;
}

export class PolicyOptionDto {
  @ApiProperty({
    description: 'Policy ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'Formatted policy option text: "Package Name - Plan Name"',
    example: 'MfanisiGo - Gold',
  })
  @IsString()
  displayText: string;

  @ApiProperty({
    description: 'Package name',
    example: 'MfanisiGo',
  })
  @IsString()
  packageName: string;

  @ApiProperty({
    description: 'Plan name',
    example: 'Gold',
    required: false,
  })
  @IsOptional()
  @IsString()
  planName?: string;
}

export class PaymentDto {
  @ApiProperty({
    description: 'Payment ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Payment type',
    example: 'MPESA',
    enum: ['MPESA', 'SASAPAY'],
  })
  @IsEnum(['MPESA', 'SASAPAY'])
  paymentType: string;

  @ApiProperty({
    description: 'Transaction reference',
    example: 'MPX123456789',
  })
  @IsString()
  transactionReference: string;

  @ApiProperty({
    description: 'Account number',
    example: '254712345678',
    required: false,
  })
  @IsOptional()
  @IsString()
  accountNumber?: string;

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
  @IsOptional()
  actualPaymentDate?: string;

  @ApiProperty({
    description: 'Payment amount',
    example: 5000.0,
  })
  amount: number;

  @ApiProperty({
    description: 'Payment row status (e.g. PENDING_STK_CALLBACK, COMPLETED)',
    enum: PaymentStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;
}

export class CustomerPaymentsResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 200,
  })
  status: number;

  @ApiProperty({
    description: 'Correlation ID from request',
    example: 'req-payments-12345',
  })
  correlationId: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Payments retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Payments data',
    type: [PaymentDto],
  })
  data: PaymentDto[];

  @ApiProperty({
    required: false,
    description: 'Present when page and pageSize are provided',
  })
  pagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export class CustomerPoliciesResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 200,
  })
  status: number;

  @ApiProperty({
    description: 'Correlation ID from request',
    example: 'req-policies-12345',
  })
  correlationId: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Customer policies retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Policy options for dropdown',
    type: [PolicyOptionDto],
  })
  data: PolicyOptionDto[];
}
