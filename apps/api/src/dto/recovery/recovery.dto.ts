import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsEnum,
  IsUUID,
  IsInt,
  IsOptional,
  Min,
  IsString,
  MaxLength,
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

/** Member number reconciliation: one row per policy (or per customer with no policy) */
export class MemberNumberReconciliationDependantDto {
  @ApiProperty({ description: 'Dependant full name' })
  fullName: string;

  @ApiProperty({ description: 'Member number' })
  memberNumber: string;
}

export class MemberNumberReconciliationRowDto {
  @ApiProperty({ description: 'Customer ID' })
  customerId: string;

  @ApiProperty({ description: 'Customer full name' })
  fullName: string;

  @ApiProperty({ description: 'Phone number' })
  phoneNumber: string;

  @ApiProperty({ description: 'ID number' })
  idNumber: string;

  @ApiProperty({ description: 'Count of dependants (from dependants table)' })
  dependantCount: number;

  @ApiProperty({ description: 'Policy ID', nullable: true })
  policyId: string | null;

  @ApiProperty({ description: 'Policy number or N/A when no policy', nullable: true })
  policyNumber: string | null;

  @ApiProperty({ description: 'Principal member number', nullable: true })
  principalMemberNumber: string | null;

  @ApiProperty({
    description: 'Dependants with member numbers (for policies only)',
    type: [MemberNumberReconciliationDependantDto],
  })
  dependants: MemberNumberReconciliationDependantDto[];
}

export class GetMemberNumberReconciliationResponseDto {
  @ApiProperty({ description: 'Rows for reconciliation (one per policy or per customer without policy)', type: [MemberNumberReconciliationRowDto] })
  rows: MemberNumberReconciliationRowDto[];
}

export class ReconcilePolicyMemberNumbersRequestDto {
  @ApiProperty({ description: 'New policy number (max 15 characters)', example: 'MP/MFG/007' })
  @IsString()
  @MaxLength(15)
  policyNumber: string;
}
