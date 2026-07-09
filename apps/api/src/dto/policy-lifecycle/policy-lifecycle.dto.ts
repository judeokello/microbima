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
} from 'class-validator';
import { PaymentFrequency, PolicyStatus } from '@prisma/client';

export class PolicyLifecycleReasonDto {
  @ApiProperty({ description: 'Mandatory reason for the status change', maxLength: 1000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}

export class DeactivatePolicyRequestDto extends PolicyLifecycleReasonDto {}

export class ActivatePolicyRequestDto extends PolicyLifecycleReasonDto {}

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

  @ApiProperty({ description: 'Installment amount (KES) from insurance-pricing.json' })
  @IsNumber()
  @Min(0)
  premium: number;

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

  @ApiPropertyOptional({ nullable: true })
  currentPackageSchemeId: number | null;

  @ApiProperty()
  paymentMigrationAllowed: boolean;

  @ApiProperty({ type: [ModifyPolicyOptionsPaymentDto] })
  eligiblePayments: ModifyPolicyOptionsPaymentDto[];

  @ApiProperty({ type: [ModifyPolicyOptionsSchemeDto] })
  schemes: ModifyPolicyOptionsSchemeDto[];
}
