import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsInt, MaxLength } from 'class-validator';

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
    description: 'Creation timestamp',
    example: '2025-01-15T10:30:00Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2025-01-15T10:30:00Z',
  })
  updatedAt: string;
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
    description: 'Path to the logo file',
    example: '/logos/underwriters/1/packages/1.png',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  logoPath?: string;
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

