import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsInt, MaxLength, Min } from 'class-validator';

export class SchemeDetailDto {
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
    description: 'User ID who created this scheme',
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

export class CreateSchemeRequestDto {
  @ApiProperty({
    description: 'Scheme name',
    example: 'Corporate Scheme',
  })
  @IsString()
  @MaxLength(100)
  schemeName: string;

  @ApiProperty({
    description: 'Scheme description',
    example: 'Corporate insurance scheme for employees',
  })
  @IsString()
  @MaxLength(300)
  description: string;

  @ApiProperty({
    description: 'Whether the scheme is active',
    example: true,
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'Package ID to link the scheme to',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  packageId?: number;
}

export class UpdateSchemeRequestDto {
  @ApiProperty({
    description: 'Scheme name',
    example: 'Corporate Scheme',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  schemeName?: string;

  @ApiProperty({
    description: 'Scheme description',
    example: 'Corporate insurance scheme for employees',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @ApiProperty({
    description: 'Whether the scheme is active',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SchemeCustomerDto {
  @ApiProperty({
    description: 'Customer ID',
    example: 'uuid-here',
  })
  id: string;

  @ApiProperty({
    description: 'First name',
    example: 'John',
  })
  firstName: string;

  @ApiProperty({
    description: 'Middle name',
    example: 'Doe',
    required: false,
  })
  middleName?: string;

  @ApiProperty({
    description: 'Last name',
    example: 'Smith',
  })
  lastName: string;

  @ApiProperty({
    description: 'Phone number',
    example: '0700123456',
  })
  phoneNumber: string;

  @ApiProperty({
    description: 'Gender',
    example: 'male',
  })
  gender: string;

  @ApiProperty({
    description: 'Registration date',
    example: '2025-01-15T10:30:00Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'ID Type',
    example: 'NATIONAL_ID',
  })
  idType: string;

  @ApiProperty({
    description: 'ID Number',
    example: '12345678',
  })
  idNumber: string;

  @ApiProperty({
    description: 'Whether customer has missing requirements',
    example: false,
  })
  hasMissingRequirements: boolean;
}

export class SchemeDetailResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 200,
  })
  status: number;

  @ApiProperty({
    description: 'Correlation ID from request',
    example: 'req-scheme-12345',
  })
  correlationId: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Scheme retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Scheme data',
    type: SchemeDetailDto,
  })
  data: SchemeDetailDto;
}

export class SchemeCustomersResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 200,
  })
  status: number;

  @ApiProperty({
    description: 'Correlation ID from request',
    example: 'req-scheme-customers-12345',
  })
  correlationId: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Customers retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Customers data',
    type: [SchemeCustomerDto],
  })
  data: SchemeCustomerDto[];

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

