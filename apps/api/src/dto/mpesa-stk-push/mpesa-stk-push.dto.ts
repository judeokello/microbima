import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, Min, Max, ValidateNested, IsArray } from 'class-validator';
import { Type, Transform } from 'class-transformer';

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
 * STK Push Callback Item DTO
 *
 * Individual item in the CallbackMetadata Item array.
 * Note: M-Pesa sends some values as numbers (Amount, TransactionDate, PhoneNumber)
 * and some items may not have a Value property (e.g., "Balance").
 */
export class StkCallbackItemDto {
  @ApiProperty({
    description: 'Item name (e.g., "Amount", "MpesaReceiptNumber", "TransactionDate", "PhoneNumber")',
    example: 'Amount',
  })
  @IsString()
  Name: string;

  @ApiProperty({
    description: 'Item value (M-Pesa may send as string or number, will be converted to string)',
    example: '100.00',
    required: false,
  })
  @Transform(({ value }) => {
    // Convert number to string if needed (M-Pesa sends numbers for Amount, TransactionDate, PhoneNumber)
    // Transform runs before validation, so convert numbers to strings here
    if (value !== undefined && value !== null) {
      return String(value);
    }
    return value;
  })
  @IsOptional()
  @IsString()
  Value?: string;
}

/**
 * STK Push Callback Metadata DTO
 *
 * Additional metadata provided in successful STK Push callbacks.
 */
export class StkCallbackMetadataDto {
  @ApiProperty({
    description: 'Array of callback metadata items',
    type: [StkCallbackItemDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StkCallbackItemDto)
  Item?: StkCallbackItemDto[];
}

/**
 * STK Push Callback Data DTO
 *
 * The stkCallback object within the Body.
 */
export class StkCallbackDto {
  @ApiProperty({
    description: 'Merchant request ID (same as STK Push request ID)',
    example: '12345-67890-12345',
  })
  @IsString()
  MerchantRequestID: string;

  @ApiProperty({
    description: 'Checkout request ID from M-Pesa',
    example: 'ws_CO_270120251430451234567890',
  })
  @IsString()
  CheckoutRequestID: string;

  @ApiProperty({
    description: 'Result code (0 = success, non-zero = error)',
    example: 0,
  })
  @IsNumber()
  ResultCode: number;

  @ApiProperty({
    description: 'Result description',
    example: 'The service request is processed successfully.',
  })
  @IsString()
  ResultDesc: string;

  @ApiProperty({
    description: 'Additional callback metadata (present on success)',
    type: StkCallbackMetadataDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => StkCallbackMetadataDto)
  CallbackMetadata?: StkCallbackMetadataDto;
}

/**
 * STK Push Callback Body DTO
 *
 * The Body object containing stkCallback.
 */
export class StkPushCallbackBodyDto {
  @ApiProperty({
    description: 'STK callback data',
    type: StkCallbackDto,
  })
  @ValidateNested()
  @Type(() => StkCallbackDto)
  stkCallback: StkCallbackDto;
}

/**
 * STK Push Callback Payload DTO
 *
 * Payload sent by M-Pesa for STK Push callback notifications.
 */
export class StkPushCallbackDto {
  @ApiProperty({
    description: 'Callback body containing STK callback data',
    type: StkPushCallbackBodyDto,
  })
  @ValidateNested()
  @Type(() => StkPushCallbackBodyDto)
  Body: StkPushCallbackBodyDto;
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

