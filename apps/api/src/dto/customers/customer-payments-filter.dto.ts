import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString, IsEnum } from 'class-validator';

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
    description: 'From date for payment filtering (YYYY-MM-DD)',
    example: '2024-01-01',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiProperty({
    description: 'To date for payment filtering (YYYY-MM-DD)',
    example: '2024-12-31',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;
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
    example: 5000.00,
  })
  amount: number;
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


