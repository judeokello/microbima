import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentFrequency } from '@prisma/client';
import { ChildDto } from '../family-members/child.dto';
import { SpouseDto } from '../family-members/spouse.dto';
import { BeneficiaryDto } from '../family-members/beneficiary.dto';

export class AdditionalPolicyRequestDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  packageId: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  packagePlanId: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  packageSchemeId: number;

  @ApiProperty({ enum: PaymentFrequency })
  @IsEnum(PaymentFrequency)
  frequency: PaymentFrequency;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  customDays?: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  premium: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  annualPremium?: number;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  productName: string;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dependantIds?: string[];

  @ApiProperty({ type: [SpouseDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpouseDto)
  newSpouses?: SpouseDto[];

  @ApiProperty({ type: [ChildDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChildDto)
  newChildren?: ChildDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  beneficiaryId?: string;

  @ApiProperty({ type: BeneficiaryDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => BeneficiaryDto)
  newBeneficiary?: BeneficiaryDto;

  @ApiProperty({ description: 'Skip STK and leave the policy PENDING_ACTIVATION' })
  @IsBoolean()
  skipPayment: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  paymentPhone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  initiateStk?: boolean;
}

export class AdditionalPolicyEligibilityDto {
  @ApiProperty()
  canAdd: boolean;

  @ApiProperty({ type: [String] })
  blockedReasons: string[];
}
