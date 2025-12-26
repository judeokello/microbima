import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

/**
 * M-Pesa IPN Payload DTO
 *
 * Represents the payload sent by M-Pesa Daraja API for Instant Payment Notifications (IPN).
 * All fields match the M-Pesa API specification exactly.
 */
export class MpesaIpnPayloadDto {
  @ApiProperty({
    description: 'M-Pesa transaction type (e.g., "Pay Bill", "Buy Goods")',
    example: 'Pay Bill',
  })
  @IsString()
  TransactionType: string;

  @ApiProperty({
    description: 'Unique transaction ID from M-Pesa',
    example: 'RKTQDM7W6S',
  })
  @IsString()
  TransID: string;

  @ApiProperty({
    description: 'Transaction time in format YYYYMMDDHHmmss',
    example: '20250127143045',
  })
  @IsString()
  TransTime: string;

  @ApiProperty({
    description: 'Transaction amount as decimal string',
    example: '100.00',
  })
  @IsString()
  TransAmount: string;

  @ApiProperty({
    description: 'Business short code',
    example: '174379',
  })
  @IsString()
  BusinessShortCode: string;

  @ApiProperty({
    description: 'Account reference (policy payment account number)',
    example: 'POL123456',
    required: false,
  })
  @IsOptional()
  @IsString()
  BillRefNumber?: string;

  @ApiProperty({
    description: 'Invoice number (if applicable)',
    example: '',
    required: false,
  })
  @IsOptional()
  @IsString()
  InvoiceNumber?: string;

  @ApiProperty({
    description: 'Organization account balance as decimal string',
    example: '50000.00',
    required: false,
  })
  @IsOptional()
  @IsString()
  OrgAccountBalance?: string;

  @ApiProperty({
    description: 'Third party transaction ID (if applicable)',
    example: '',
    required: false,
  })
  @IsOptional()
  @IsString()
  ThirdPartyTransID?: string;

  @ApiProperty({
    description: 'Customer phone number in international format',
    example: '254722000000',
  })
  @IsString()
  MSISDN: string;

  @ApiProperty({
    description: 'Customer first name',
    example: 'John',
    required: false,
  })
  @IsOptional()
  @IsString()
  FirstName?: string;

  @ApiProperty({
    description: 'Customer middle name',
    example: 'M',
    required: false,
  })
  @IsOptional()
  @IsString()
  MiddleName?: string;

  @ApiProperty({
    description: 'Customer last name',
    example: 'Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  LastName?: string;
}

/**
 * M-Pesa IPN Response DTO
 *
 * Response format for M-Pesa IPN callback endpoints.
 * Always returns success (ResultCode: 0) to prevent M-Pesa retries.
 */
export class MpesaIpnResponseDto {
  @ApiProperty({
    description: 'Result code (0 = success, always 0 to prevent retries)',
    example: 0,
  })
  ResultCode: number;

  @ApiProperty({
    description: 'Result description',
    example: 'Accepted',
  })
  ResultDesc: string;
}

