import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';

/**
 * Initiate STK Push Request DTO
 *
 * Request payload for initiating an STK Push payment request.
 */
export class InitiateStkPushDto {
  @ApiProperty({
    description: 'Customer phone number (will be normalized to international format 254XXXXXXXXX)',
    example: '254722000000',
  })
  @IsString()
  phoneNumber: string;

  @ApiProperty({
    description: 'Transaction amount (must be between 1 and 70,000 KES)',
    example: 100.0,
    minimum: 1,
    maximum: 70000,
  })
  @IsNumber()
  @Min(1)
  @Max(70000)
  amount: number;

  @ApiProperty({
    description: 'Policy payment account number (BillRefNumber)',
    example: 'POL123456',
    maxLength: 100,
  })
  @IsString()
  accountReference: string;

  @ApiProperty({
    description: 'Transaction description (optional)',
    example: 'Premium payment for policy POL123456',
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  transactionDesc?: string;
}

/**
 * STK Push Request Response DTO
 *
 * Response payload for STK Push request initiation.
 */
export class StkPushRequestResponseDto {
  @ApiProperty({
    description: 'STK Push request ID (used as MerchantRequestID)',
    example: '12345-67890-12345',
  })
  id: string;

  @ApiProperty({
    description: 'Checkout request ID from M-Pesa',
    example: 'ws_CO_270120251430451234567890',
  })
  checkoutRequestID: string;

  @ApiProperty({
    description: 'Merchant request ID (same as id)',
    example: '12345-67890-12345',
  })
  merchantRequestID: string;

  @ApiProperty({
    description: 'Current request status',
    enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED'],
    example: 'PENDING',
  })
  status: string;

  @ApiProperty({
    description: 'Customer phone number',
    example: '254722000000',
  })
  phoneNumber: string;

  @ApiProperty({
    description: 'Transaction amount',
    example: 100.0,
  })
  amount: number;

  @ApiProperty({
    description: 'Account reference',
    example: 'POL123456',
  })
  accountReference: string;

  @ApiProperty({
    description: 'When the request was initiated',
    example: '2025-01-27T14:30:45Z',
  })
  initiatedAt: Date;
}

/**
 * STK Push Callback Payload DTO
 *
 * Payload sent by M-Pesa for STK Push callback notifications.
 */
export class StkPushCallbackDto {
  @ApiProperty({
    description: 'Callback body containing STK callback data',
  })
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{
          Name: string;
          Value: string;
        }>;
      };
    };
  };
}

/**
 * M-Pesa Callback Response DTO
 *
 * Response format for M-Pesa callback endpoints (IPN and STK Push callback).
 * Always returns success (ResultCode: 0) to prevent M-Pesa retries.
 */
export class MpesaCallbackResponseDto {
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

