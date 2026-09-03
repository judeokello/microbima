import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentFrequency } from '@prisma/client';
import { SpouseDto } from '../family-members/spouse.dto';
import { ChildDto } from '../family-members/child.dto';
import { ParentDto } from '../family-members/parent.dto';
import { BeneficiaryDto } from '../family-members/beneficiary.dto';

export class CreateAdditionalPolicyRequestDto {
  @ApiProperty({ description: 'PackageScheme junction id for the new product' })
  @IsInt()
  @Min(1)
  packageSchemeId: number;

  @ApiProperty({ description: 'Package plan ID' })
  @IsInt()
  @Min(1)
  packagePlanId: number;

  @ApiProperty({ enum: PaymentFrequency })
  @IsEnum(PaymentFrequency)
  frequency: PaymentFrequency;

  @ApiProperty({ description: 'Installment premium' })
  @IsNumber()
  @Min(0)
  premium: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  annualPremium?: number;

  @ApiProperty({ example: 'MfanisiGo Gold' })
  @IsString()
  @MinLength(1)
  productName: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  existingDependantIds?: string[];

  @ApiProperty({ required: false, type: [SpouseDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpouseDto)
  newSpouses?: SpouseDto[];

  @ApiProperty({ required: false, type: [ChildDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChildDto)
  newChildren?: ChildDto[];

  @ApiProperty({ required: false, type: [ParentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParentDto)
  newParents?: ParentDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  beneficiaryId?: string;

  @ApiProperty({ required: false, type: BeneficiaryDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BeneficiaryDto)
  newBeneficiary?: BeneficiaryDto;

  @ApiProperty({
    description: 'When a name-only duplicate is shown, confirm creating a new person',
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  confirmNewPersonKeys?: string[];

  @ApiProperty({
    description: 'Skip STK and leave the new policy PENDING_ACTIVATION',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  skipPayment?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  customDays?: number;
}

export class AdditionalPolicyResponseDto {
  @ApiProperty({ example: 201 })
  status: number;

  @ApiProperty()
  correlationId: string;

  @ApiProperty()
  message: string;

  @ApiProperty()
  policy: {
    id: string;
    policyNumber: string | null;
    status: string;
    productName: string;
    premium: number;
    paymentAcNumber: string | null;
  };
}
