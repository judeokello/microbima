import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsUrl, MaxLength } from 'class-validator';

export class UnderwriterDto {
  @ApiProperty({
    description: 'Underwriter ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Underwriter name',
    example: 'Definite Assurance company Ltd',
  })
  name: string;

  @ApiProperty({
    description: 'Underwriter short name',
    example: 'Definite',
  })
  shortName: string;

  @ApiProperty({
    description: 'Underwriter website',
    example: 'https://definiteassurance.com',
  })
  website: string;

  @ApiProperty({
    description: 'Office location',
    example: 'ABSA TOWERS, 1st Floor, Loita Street, Nairobi Kenya',
  })
  officeLocation: string;

  @ApiProperty({
    description: 'Whether the underwriter is active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Path to the logo file',
    example: '/logos/underwriters/1/logo.png',
    required: false,
  })
  logoPath?: string | null;

  @ApiProperty({
    description: 'User ID who created this underwriter',
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

  @ApiProperty({
    description: 'Number of packages linked to this underwriter',
    example: 5,
    required: false,
  })
  packagesCount?: number;
}

export class CreateUnderwriterRequestDto {
  @ApiProperty({
    description: 'Underwriter name',
    example: 'Definite Assurance company Ltd',
  })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Underwriter short name',
    example: 'Definite',
  })
  @IsString()
  @MaxLength(50)
  shortName: string;

  @ApiProperty({
    description: 'Underwriter website',
    example: 'https://definiteassurance.com',
  })
  @IsString()
  @IsUrl()
  @MaxLength(100)
  website: string;

  @ApiProperty({
    description: 'Office location',
    example: 'ABSA TOWERS, 1st Floor, Loita Street, Nairobi Kenya',
  })
  @IsString()
  @MaxLength(200)
  officeLocation: string;

  @ApiProperty({
    description: 'Path to the logo file (optional, set after upload)',
    example: '/logos/underwriters/1/logo.png',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  logoPath?: string;

  @ApiProperty({
    description: 'Whether the underwriter is active',
    example: true,
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateUnderwriterRequestDto {
  @ApiProperty({
    description: 'Underwriter name',
    example: 'Definite Assurance company Ltd',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiProperty({
    description: 'Underwriter short name',
    example: 'Definite',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  shortName?: string;

  @ApiProperty({
    description: 'Underwriter website',
    example: 'https://definiteassurance.com',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsUrl()
  @MaxLength(100)
  website?: string;

  @ApiProperty({
    description: 'Office location',
    example: 'ABSA TOWERS, 1st Floor, Loita Street, Nairobi Kenya',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  officeLocation?: string;

  @ApiProperty({
    description: 'Path to the logo file',
    example: '/logos/underwriters/1/logo.png',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  logoPath?: string;

  @ApiProperty({
    description: 'Whether the underwriter is active',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UnderwriterListResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 200,
  })
  status: number;

  @ApiProperty({
    description: 'Correlation ID from request',
    example: 'req-underwriters-12345',
  })
  correlationId: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Underwriters retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Underwriters data',
    type: [UnderwriterDto],
  })
  data: UnderwriterDto[];

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

export class UnderwriterResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 200,
  })
  status: number;

  @ApiProperty({
    description: 'Correlation ID from request',
    example: 'req-underwriter-12345',
  })
  correlationId: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Underwriter retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Underwriter data',
    type: UnderwriterDto,
  })
  data: UnderwriterDto;
}

export class UnderwriterPackagesDto {
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
    description: 'Package description (first 40 characters)',
    example: 'Comprehensive health insurance package...',
  })
  description: string;

  @ApiProperty({
    description: 'Full package description',
    example: 'Comprehensive health insurance package for individuals and families',
  })
  fullDescription: string;

  @ApiProperty({
    description: 'Number of schemes subscribed to this package',
    example: 5,
  })
  schemesCount: number;

  @ApiProperty({
    description: 'Total number of customers across all schemes',
    example: 150,
  })
  totalCustomers: number;
}

export class UnderwriterPackagesResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 200,
  })
  status: number;

  @ApiProperty({
    description: 'Correlation ID from request',
    example: 'req-packages-12345',
  })
  correlationId: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Packages retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Packages data',
    type: [UnderwriterPackagesDto],
  })
  data: UnderwriterPackagesDto[];
}

