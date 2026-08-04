import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsEnum,
  IsInt,
  IsOptional,
  IsNumber,
  Min,
  ValidateIf,
  IsArray,
  ArrayMinSize,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentFrequency, PolicyStatus, MpesaPaymentSource } from '@prisma/client';

export class PolicyLifecycleReasonDto {
  @ApiProperty({ description: 'Mandatory reason for the status change', maxLength: 1000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}

export class DeactivatePolicyRequestDto extends PolicyLifecycleReasonDto {}

export class ActivatePolicyRequestDto extends PolicyLifecycleReasonDto {}

export class TerminatePolicyRequestDto extends PolicyLifecycleReasonDto {}

export class ResetPolicyStartDateRequestDto extends PolicyLifecycleReasonDto {
  @ApiProperty({ description: 'New policy start date (ISO 8601)', example: '2026-02-15T00:00:00.000Z' })
  @IsString()
  @IsNotEmpty()
  startDate: string;
}

export enum PolicyNumberChoice {
  KEEP_EXISTING = 'KEEP_EXISTING',
  GENERATE_NEW = 'GENERATE_NEW',
}

export class ModifyPolicyRequestDto extends PolicyLifecycleReasonDto {
  @ApiProperty({ example: 2 })
  @IsInt()
  packagePlanId: number;

  @ApiProperty({ enum: PaymentFrequency })
  @IsEnum(PaymentFrequency)
  frequency: PaymentFrequency;

  @ApiProperty({ description: 'Installment amount (KES) from product-pricing/{slug}-pricing.json' })
  @IsNumber()
  @Min(0)
  premium: number;

  @ApiPropertyOptional({
    description: 'Annual premium from pricing JSON (plan/category ± spouse)',
    example: 30660,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  annualPremium?: number;

  @ApiPropertyOptional({ description: 'Required when frequency is CUSTOM' })
  @ValidateIf((o) => o.frequency === PaymentFrequency.CUSTOM)
  @IsInt()
  @Min(1)
  customDays?: number;

  @ApiPropertyOptional({ description: 'New package scheme id (same package)' })
  @IsOptional()
  @IsInt()
  packageSchemeId?: number;

  @ApiProperty({ enum: PolicyNumberChoice })
  @IsEnum(PolicyNumberChoice)
  policyNumberChoice: PolicyNumberChoice;

  @ApiPropertyOptional({
    description: 'First completed payment to migrate (required when source has completed prepaid payments)',
  })
  @IsOptional()
  @IsInt()
  firstPaymentId?: number;
}

export class PolicyLifecyclePolicyDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  policyNumber?: string | null;

  @ApiProperty({ enum: PolicyStatus })
  status: PolicyStatus;
}

export class PolicyLifecycleResponseDto {
  @ApiProperty({ example: 200 })
  status: number;

  @ApiProperty()
  correlationId: string;

  @ApiProperty()
  message: string;

  @ApiProperty({ type: PolicyLifecyclePolicyDto })
  policy: PolicyLifecyclePolicyDto;

  @ApiPropertyOptional({ description: 'Set after modify — select this policy in Payments tab' })
  newPolicyId?: string;
}

export class ModifyPolicyOptionsPaymentDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  transactionReference: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  expectedPaymentDate: string;

  @ApiPropertyOptional()
  actualPaymentDate?: string;

  @ApiProperty({ description: 'COMPLETED or COMPLETED_PENDING_RECEIPT' })
  paymentStatus: string;
}

export class ModifyPolicyOptionsSchemeDto {
  @ApiProperty()
  packageSchemeId: number;

  @ApiProperty()
  schemeName: string;

  @ApiProperty()
  isPostpaid: boolean;
}

export class ModifyPolicyPaymentFrequencyDto {
  @ApiProperty({ example: 'DAILY' })
  frequency: string;

  @ApiProperty({ example: 276 })
  installmentCount: number;
}

export class ModifyPolicyOptionsResponseDto {
  @ApiProperty({ example: 200 })
  status: number;

  @ApiProperty()
  correlationId: string;

  @ApiProperty()
  message: string;

  @ApiProperty()
  packageId: number;

  @ApiProperty()
  packageName: string;

  @ApiPropertyOptional({ nullable: true })
  packageSlug: string | null;

  @ApiProperty({ type: [ModifyPolicyPaymentFrequencyDto] })
  paymentFrequencies: ModifyPolicyPaymentFrequencyDto[];

  @ApiProperty()
  familyCategory: string;

  @ApiProperty()
  additionalSpouse: boolean;

  @ApiProperty()
  currentPackagePlanId: number;

  @ApiPropertyOptional()
  currentPlanName?: string;

  @ApiProperty()
  currentPremium: number;

  @ApiProperty({ enum: PaymentFrequency })
  currentFrequency: PaymentFrequency;

  @ApiProperty()
  currentPaymentCadence: number;

  @ApiPropertyOptional()
  currentExpectedInstallmentCount?: number | null;

  @ApiPropertyOptional({ nullable: true })
  currentPackageSchemeId: number | null;

  @ApiProperty()
  paymentMigrationAllowed: boolean;

  @ApiProperty({ type: [ModifyPolicyOptionsPaymentDto] })
  eligiblePayments: ModifyPolicyOptionsPaymentDto[];

  @ApiProperty({ type: [ModifyPolicyOptionsSchemeDto] })
  schemes: ModifyPolicyOptionsSchemeDto[];
}

export class DailyLifecycleRunResponseDto {
  @ApiProperty()
  evaluatedAt: string;

  @ApiProperty()
  graceEntered: number;

  @ApiProperty()
  graceCleared: number;

  @ApiProperty()
  suspended: number;

  @ApiProperty()
  inactivated: number;

  @ApiProperty()
  expired: number;

  @ApiProperty()
  notificationsQueued: number;

  @ApiProperty()
  correlationId: string;

  @ApiPropertyOptional()
  durationMs?: number;
}

export class RemapMpesaPaymentsRequestDto {
  @ApiProperty({ description: 'Wrong payment account number entered on M-Pesa' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  accountNumber: string;

  @ApiProperty({ type: [String], description: 'Selected mpesa_payment_report_items ids' })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  itemIds: string[];

  @ApiProperty({ description: 'Mandatory admin reason for the remap', maxLength: 400 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(400)
  reason: string;
}

export class UnmappedMpesaPaymentItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  transactionReference: string;

  @ApiProperty()
  paidIn: number;

  @ApiProperty()
  completionTime: string;

  @ApiPropertyOptional({ nullable: true })
  accountNumber: string | null;

  @ApiProperty({ enum: MpesaPaymentSource })
  source: MpesaPaymentSource;
}

export class UnmappedMpesaPaymentsResponseDto {
  @ApiProperty({ example: 200 })
  status: number;

  @ApiProperty()
  correlationId: string;

  @ApiProperty({ type: [UnmappedMpesaPaymentItemDto] })
  items: UnmappedMpesaPaymentItemDto[];
}

export class RemapMpesaPaymentsResponseDto {
  @ApiProperty({ example: 200 })
  status: number;

  @ApiProperty()
  correlationId: string;

  @ApiProperty()
  message: string;

  @ApiProperty()
  mappedCount: number;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty()
  lifecycleAction: string;

  @ApiPropertyOptional({ description: 'Admin-facing note when status did not change as expected' })
  note?: string;
}

export class DetachPaymentsRequestDto {
  @ApiProperty({ type: [Number], description: 'Selected policy_payments ids to detach' })
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  paymentIds: number[];

  @ApiProperty({ description: 'Corrected account number to write onto IPN records' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  newAccountNumber: string;

  @ApiProperty({ description: 'Mandatory admin reason for the detach', maxLength: 400 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(400)
  reason: string;
}

export class DetachablePaymentItemDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  transactionReference: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  expectedPaymentDate: string;

  @ApiPropertyOptional({ nullable: true })
  actualPaymentDate: string | null;

  @ApiProperty()
  paymentStatus: string;

  @ApiPropertyOptional({ nullable: true })
  accountNumber: string | null;

  @ApiPropertyOptional({ nullable: true })
  details: string | null;
}

export class DetachablePaymentsResponseDto {
  @ApiProperty({ example: 200 })
  status: number;

  @ApiProperty()
  correlationId: string;

  @ApiProperty({ type: [DetachablePaymentItemDto] })
  items: DetachablePaymentItemDto[];
}

export class DetachPaymentsResponseDto {
  @ApiProperty({ example: 200 })
  status: number;

  @ApiProperty()
  correlationId: string;

  @ApiProperty()
  message: string;

  @ApiProperty()
  detachedCount: number;

  @ApiProperty()
  detachedTotalAmount: number;

  @ApiProperty()
  sourceLifecycleAction: string;

  @ApiProperty()
  rematchFound: boolean;

  @ApiPropertyOptional({ nullable: true })
  targetPolicyId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  targetPolicyNumber?: string | null;

  @ApiProperty()
  rematchedCount: number;

  @ApiProperty()
  rematchedTotalAmount: number;

  @ApiPropertyOptional({ nullable: true })
  targetLifecycleAction?: string | null;

  @ApiProperty()
  detachSmsEnqueued: boolean;

  @ApiProperty()
  rematchSmsEnqueued: boolean;

  @ApiPropertyOptional()
  note?: string;
}
