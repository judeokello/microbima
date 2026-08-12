import { ApiProperty } from '@nestjs/swagger';
import { PaymentFrequency } from '@prisma/client';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  MaxLength,
  Min,
  Max,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsEnum,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PACKAGE_SLUG_REGEX } from '../../utils/package-payment-frequency.util';

export class PackagePaymentFrequencyDto {
  @ApiProperty({
    description: 'Payment frequency',
    enum: PaymentFrequency,
    example: PaymentFrequency.DAILY,
  })
  @IsEnum(PaymentFrequency)
  frequency: PaymentFrequency;

  @ApiProperty({
    description: 'Number of installments for this frequency',
    example: 276,
    minimum: 1,
    maximum: 365,
  })
  @IsInt()
  @Min(1)
  @Max(365)
  installmentCount: number;
}

export class PackageDetailDto {
  @ApiProperty({
    description: 'Package ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Package name',
    example: 'MfanisiGo',
  })
  name: string;

  @ApiProperty({
    description: 'Unique lowercase package slug for pricing file lookup',
    example: 'mfanisi-go',
    required: false,
    nullable: true,
  })
  slug?: string | null;

  @ApiProperty({
    description: 'Package description',
    example: 'Comprehensive health insurance package',
  })
  description: string;

  @ApiProperty({
    description: 'Underwriter ID',
    example: 1,
    required: false,
  })
  underwriterId?: number | null;

  @ApiProperty({
    description: 'Underwriter name',
    example: 'Definite Assurance company Ltd',
    required: false,
  })
  underwriterName?: string | null;

  @ApiProperty({
    description: 'Whether the package is active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Whether schemes under this package may enable parent details at registration',
    example: false,
  })
  parentsSupported: boolean;

  @ApiProperty({
    description: 'Maximum family size; UP_TO_N pricing categories cannot exceed this',
    example: 8,
  })
  maximumFamilySize: number;

  @ApiProperty({
    description: 'Path to the logo file',
    example: '/logos/underwriters/1/packages/1.png',
    required: false,
  })
  logoPath?: string | null;

  @ApiProperty({
    description: 'Card template name for membership card layout (null = use default)',
    example: 'WellnessCard',
    required: false,
  })
  cardTemplateName?: string | null;

  @ApiProperty({
    description: 'User ID who created this package',
    example: 'uuid-here',
  })
  createdBy: string;

  @ApiProperty({
    description: 'Display name of the user who created this package',
    example: 'Jane Doe',
    required: false,
  })
  createdByDisplayName?: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2025-01-15T10:30:00Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2025-01-15T10:30:00Z',
  })
  updatedAt: string;

  @ApiProperty({
    description: 'Supported payment frequencies and installment counts',
    type: [PackagePaymentFrequencyDto],
  })
  paymentFrequencies: PackagePaymentFrequencyDto[];
}

export class CreatePackageRequestDto {
  @ApiProperty({
    description: 'Package name',
    example: 'MfanisiGo',
  })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Unique lowercase slug (letters, numbers, hyphens)',
    example: 'mfanisi-go',
  })
  @IsString()
  @MaxLength(100)
  @Matches(PACKAGE_SLUG_REGEX, {
    message: 'slug must be lowercase letters, numbers, and hyphens only',
  })
  slug: string;

  @ApiProperty({
    description: 'Package description',
    example: 'Comprehensive health insurance package',
  })
  @IsString()
  @MaxLength(500)
  description: string;

  @ApiProperty({
    description: 'Underwriter ID',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  underwriterId?: number;

  @ApiProperty({
    description: 'Whether the package is active',
    example: false,
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'Whether schemes may enable parent details at registration',
    example: false,
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  parentsSupported?: boolean;

  @ApiProperty({
    description: 'Maximum family size for UP_TO_N pricing bands (required, >= 2)',
    example: 8,
  })
  @IsInt()
  @Min(2)
  @Max(99)
  maximumFamilySize: number;

  @ApiProperty({
    description: 'Supported payment frequencies (at least one; CUSTOM not allowed)',
    type: [PackagePaymentFrequencyDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PackagePaymentFrequencyDto)
  paymentFrequencies: PackagePaymentFrequencyDto[];
}

export class UpdatePackageRequestDto {
  @ApiProperty({
    description: 'Package name',
    example: 'MfanisiGo',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiProperty({
    description: 'Unique lowercase slug (letters, numbers, hyphens)',
    example: 'mfanisi-go',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(PACKAGE_SLUG_REGEX, {
    message: 'slug must be lowercase letters, numbers, and hyphens only',
  })
  slug?: string;

  @ApiProperty({
    description: 'Package description',
    example: 'Comprehensive health insurance package',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'Underwriter ID',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  underwriterId?: number;

  @ApiProperty({
    description: 'Whether the package is active',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description:
      'Whether schemes may enable parent details. When set to false, all linked schemes with parentsSupported=true are also set to false.',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  parentsSupported?: boolean;

  @ApiProperty({
    description:
      'Maximum family size for UP_TO_N bands. Cannot be lower than any existing UP_TO_N maxMembers.',
    example: 8,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(99)
  maximumFamilySize?: number;

  @ApiProperty({
    description: 'Path to the logo file',
    example: '/logos/underwriters/1/packages/1.png',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  logoPath?: string;

  @ApiProperty({
    description: 'Supported payment frequencies (at least one when provided; CUSTOM not allowed)',
    type: [PackagePaymentFrequencyDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PackagePaymentFrequencyDto)
  paymentFrequencies?: PackagePaymentFrequencyDto[];
}

export class PackageSchemeDto {
  @ApiProperty({
    description: 'Scheme ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Scheme name',
    example: 'Corporate Scheme',
  })
  schemeName: string;

  @ApiProperty({
    description: 'Scheme description',
    example: 'Corporate insurance scheme for employees',
  })
  description: string;

  @ApiProperty({
    description: 'Whether the scheme is active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Whether the scheme is postpaid',
    example: false,
  })
  isPostpaid: boolean;

  @ApiProperty({
    description: 'Number of customers in this scheme',
    example: 50,
  })
  customersCount: number;
}

export class PackageDetailResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 200,
  })
  status: number;

  @ApiProperty({
    description: 'Correlation ID from request',
    example: 'req-package-12345',
  })
  correlationId: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Package retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Package data',
    type: PackageDetailDto,
  })
  data: PackageDetailDto;
}

export class PackageSchemesResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 200,
  })
  status: number;

  @ApiProperty({
    description: 'Correlation ID from request',
    example: 'req-package-schemes-12345',
  })
  correlationId: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Schemes retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Schemes data',
    type: [PackageSchemeDto],
  })
  data: PackageSchemeDto[];
}

export class GlobalSchemeListItemDto {
  @ApiProperty({
    description: 'Scheme ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'PackageScheme junction ID',
    example: 10,
  })
  packageSchemeId: number;

  @ApiProperty({
    description: 'Scheme name',
    example: 'Corporate Scheme',
  })
  schemeName: string;

  @ApiProperty({
    description: 'Scheme description',
    example: 'Corporate insurance scheme for employees',
  })
  description: string;

  @ApiProperty({
    description: 'Whether the scheme is active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Whether the scheme is postpaid',
    example: false,
  })
  isPostpaid: boolean;

  @ApiProperty({
    description: 'General scheme waiting period in days',
    example: 30,
    nullable: true,
  })
  generalSchemeWaitingPeriod: number | null;

  @ApiProperty({
    description: 'Number of customers in this package-scheme',
    example: 50,
  })
  customersCount: number;

  @ApiProperty({
    description: 'Package ID',
    example: 1,
  })
  packageId: number;

  @ApiProperty({
    description: 'Package name',
    example: 'Mfanisi Go',
  })
  packageName: string;

  @ApiProperty({
    description: 'Underwriter ID',
    example: 1,
    nullable: true,
  })
  underwriterId: number | null;

  @ApiProperty({
    description: 'Underwriter name',
    example: 'Jubilee Insurance',
    nullable: true,
  })
  underwriterName: string | null;
}

export class GlobalSchemesListResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 200,
  })
  status: number;

  @ApiProperty({
    description: 'Correlation ID from request',
    example: 'req-schemes-list-12345',
  })
  correlationId: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Schemes retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Schemes data',
    type: [GlobalSchemeListItemDto],
  })
  data: GlobalSchemeListItemDto[];

  @ApiProperty({
    description: 'Pagination information',
  })
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
