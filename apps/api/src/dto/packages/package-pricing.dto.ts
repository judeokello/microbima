import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Frequencies allowed on pricing grids (CUSTOM rejected). */
export enum PackagePricingFrequencyDto {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUALLY = 'ANNUALLY',
}

export enum PackagePricingCategoryKindDto {
  MEMBER_ONLY = 'MEMBER_ONLY',
  UP_TO_N = 'UP_TO_N',
  ADDITIONAL_SPOUSE = 'ADDITIONAL_SPOUSE',
}

export class RateBandDto {
  @ApiPropertyOptional({ example: 56 })
  @IsOptional()
  @IsInt()
  @Min(1)
  daily?: number;

  @ApiPropertyOptional({ example: 392 })
  @IsOptional()
  @IsInt()
  @Min(1)
  weekly?: number;

  @ApiPropertyOptional({ example: 1765 })
  @IsOptional()
  @IsInt()
  @Min(1)
  monthly?: number;

  @ApiPropertyOptional({ example: 5295 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quarterly?: number;

  @ApiPropertyOptional({ example: 17645 })
  @IsOptional()
  @IsInt()
  @Min(1)
  annually?: number;
}

export class PricingCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  id?: number;

  @ApiProperty({ example: 'member_only' })
  @IsString()
  @MaxLength(50)
  key: string;

  @ApiProperty({ example: 'M', description: 'Display label' })
  @IsString()
  @MaxLength(100)
  display: string;

  @ApiProperty({ enum: PackagePricingCategoryKindDto })
  @IsEnum(PackagePricingCategoryKindDto)
  kind: PackagePricingCategoryKindDto;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(2)
  maxMembers?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class PutPackagePricingPlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  planId?: number;

  @ApiProperty({
    description: 'Map categoryKey → rate band',
    type: 'object',
    additionalProperties: { $ref: '#/components/schemas/RateBandDto' },
  })
  @IsObject()
  rates: Record<string, RateBandDto>;
}

export class PutPackagePricingRequestDto {
  @ApiProperty({ type: [PricingCategoryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PricingCategoryDto)
  categories: PricingCategoryDto[];

  @ApiProperty({
    description: 'Map plan key/name → plan rates',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  plans: Record<string, PutPackagePricingPlanDto>;
}

export class CreatePricingCategoryRequestDto {
  @ApiProperty({ enum: PackagePricingCategoryKindDto })
  @IsEnum(PackagePricingCategoryKindDto)
  kind: PackagePricingCategoryKindDto;

  @ApiProperty({ example: 'M(5)' })
  @IsString()
  @MaxLength(100)
  display: string;

  @ApiPropertyOptional({ description: 'Optional; server may derive from kind/maxMembers' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  key?: string;

  @ApiPropertyOptional({ description: 'Required for UP_TO_N' })
  @IsOptional()
  @IsInt()
  @Min(2)
  maxMembers?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class SuggestFillRequestDto {
  @ApiProperty()
  @IsInt()
  planId: number;

  @ApiProperty({ example: 'member_only' })
  @IsString()
  categoryKey: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  overwriteFilled?: boolean;

  /**
   * Optional current rate band from the admin UI (unsaved edits).
   * When provided, suggestions are based on these amounts instead of DB-only rates.
   */
  @ApiPropertyOptional({
    description:
      'Current UI rate band (daily/weekly/monthly/quarterly/annually). Prefer over DB when present.',
  })
  @IsOptional()
  @IsObject()
  rates?: {
    daily?: number;
    weekly?: number;
    monthly?: number;
    quarterly?: number;
    annually?: number;
  };
}
