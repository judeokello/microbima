import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsEnum,
  IsDateString,
  Min,
  Max,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaymentType } from '@prisma/client';

/** Max amount 7 digits (9,999,999.99) */
const MAX_AMOUNT = 9_999_999.99;

export class CreatePostpaidSchemePaymentBodyDto {
  @ApiProperty({
    description: 'Total payment amount (must match sum of CSV amounts)',
    example: 50000,
    maximum: MAX_AMOUNT,
  })
  @IsNumber()
  @Min(0)
  @Max(MAX_AMOUNT)
  amount: number;

  @ApiProperty({
    description: 'Payment type',
    enum: ['MPESA', 'SASAPAY', 'BANK_TRANSFER', 'CHEQUE'],
  })
  @IsEnum(PaymentType)
  paymentType: PaymentType;

  @ApiProperty({
    description: 'Batch transaction reference (max 35 chars; used in PolicyPayment as postpaid-{ref}-{rowIndex})',
    example: 'BATCH-JAN-2025-001',
    maxLength: 35,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(35)
  transactionReference: string;

  @ApiProperty({
    description:
      'Transaction date (date on payment method, e.g. cheque date or bank transfer date)',
    example: '2025-01-15T00:00:00.000Z',
  })
  @IsDateString()
  transactionDate: string;
}

export class PostpaidSchemePaymentItemDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  postpaidSchemePaymentId: number;

  @ApiProperty()
  policyPaymentId: number;
}

export class PostpaidSchemePaymentDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  schemeId: number;

  @ApiProperty({ example: '50000.00' })
  amount: string;

  @ApiProperty({ enum: PaymentType })
  paymentType: PaymentType;

  @ApiProperty()
  transactionReference: string;

  @ApiProperty()
  createdBy: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

export class PostpaidSchemePaymentListResponseDto {
  @ApiProperty({ type: [PostpaidSchemePaymentDto] })
  data: PostpaidSchemePaymentDto[];

  @ApiProperty()
  status: number;

  @ApiProperty()
  correlationId: string;

  @ApiProperty()
  message: string;
}

export class CreatePostpaidSchemePaymentResponseDto {
  @ApiProperty({ type: PostpaidSchemePaymentDto })
  data: PostpaidSchemePaymentDto;

  @ApiProperty()
  status: number;

  @ApiProperty()
  correlationId: string;

  @ApiProperty()
  message: string;
}

/** CSV row after parsing. Columns: Name, phone number, amount, id number, paid date (optional) */
export interface PostpaidSchemePaymentCsvRow {
  name: string;
  phoneNumber: string;
  amount: number;
  amountRaw: string;
  idNumber: string;
  paidDate: string | null;
}

/** IPN/statement preview for postpaid MPESA batch transaction reference */
export class PostpaidMpesaLookupDto {
  @ApiProperty({ example: true })
  valid: boolean;

  @ApiProperty({
    description: 'Human-readable verification line for the admin UI',
    example: 'Valid M-Pesa payment: SHARON CHEPKORIR NGETICH — 29/07/2026 15:00:22',
    nullable: true,
  })
  displayLabel: string | null;

  @ApiProperty({ example: 'UGTPM18EP7', nullable: true })
  transactionReference: string | null;

  @ApiProperty({ nullable: true })
  payerName: string | null;

  @ApiProperty({
    description: 'Completion time ISO 8601',
    nullable: true,
  })
  completionTime: string | null;

  @ApiProperty({
    description: 'Error when invalid or already mapped',
    nullable: true,
  })
  error: string | null;
}

export class PostpaidMpesaLookupResponseDto {
  @ApiProperty({ type: PostpaidMpesaLookupDto })
  data: PostpaidMpesaLookupDto;

  @ApiProperty()
  status: number;

  @ApiProperty()
  correlationId: string;

  @ApiProperty()
  message: string;
}
