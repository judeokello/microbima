import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsEnum,
  IsUUID,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';
import { PaymentFrequency } from '@prisma/client';

export class MpesaPaymentItemDto {
  @ApiProperty({ description: 'M-Pesa payment report item ID' })
  id: string;

  @ApiProperty({ description: 'Transaction reference' })
  transactionReference: string;

  @ApiProperty({ description: 'Amount paid in' })
  paidIn: number;

  @ApiProperty({ description: 'Completion time' })
  completionTime: string;

  @ApiProperty({ description: 'Account number' })
  accountNumber: string | null;
}

export class CustomerWithoutPolicyDto {
  @ApiProperty({ description: 'Customer ID' })
  id: string;

  @ApiProperty({ description: 'Full name' })
  fullName: string;

  @ApiProperty({ description: 'ID number' })
  idNumber: string;

  @ApiProperty({ description: 'Package ID from customer scheme' })
  packageId: number;

  @ApiProperty({ description: 'Package name' })
  packageName: string;

  @ApiProperty({ description: 'M-Pesa payments for this customer', type: [MpesaPaymentItemDto] })
  payments: MpesaPaymentItemDto[];

  @ApiProperty({ description: 'Earliest payment date (for startDate)' })
  earliestPaymentDate: string;
}

export class GetCustomersWithoutPoliciesResponseDto {
  @ApiProperty({ description: 'Customers without policies', type: [CustomerWithoutPolicyDto] })
  customers: CustomerWithoutPolicyDto[];
}

export class CreatePolicyFromRecoveryRequestDto {
  @ApiProperty({ description: 'Customer ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  customerId: string;

  @ApiProperty({ description: 'Package ID', example: 1 })
  @IsInt()
  @Min(1)
  packageId: number;

  @ApiProperty({ description: 'Package plan ID', example: 1 })
  @IsInt()
  @Min(1)
  packagePlanId: number;

  @ApiProperty({ description: 'Premium amount', example: 500 })
  @IsNumber()
  @Min(0)
  premium: number;

  @ApiProperty({ description: 'Payment frequency', enum: PaymentFrequency })
  @IsEnum(PaymentFrequency)
  frequency: PaymentFrequency;

  @ApiProperty({ description: 'Custom days for CUSTOM frequency', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  customDays?: number;
}
