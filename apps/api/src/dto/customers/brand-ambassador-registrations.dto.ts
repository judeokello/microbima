import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BrandAmbassadorRegistrationDto {
  @ApiProperty({
    description: 'Customer ID',
    example: 'cust_1234567890',
  })
  id: string;

  @ApiProperty({
    description: 'Customer first name',
    example: 'John',
  })
  firstName: string;

  @ApiPropertyOptional({
    description: 'Customer middle name',
    example: 'Michael',
  })
  middleName?: string;

  @ApiProperty({
    description: 'Customer last name',
    example: 'Doe',
  })
  lastName: string;

  @ApiProperty({
    description: 'Customer phone number',
    example: '+254712345678',
  })
  phoneNumber: string;

  @ApiProperty({
    description: 'Customer gender',
    example: 'male',
    enum: ['male', 'female'],
  })
  gender: string;

  @ApiProperty({
    description: 'Registration date',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'ID type',
    example: 'NATIONAL_ID',
    enum: ['NATIONAL_ID', 'PASSPORT', 'DRIVERS_LICENSE'],
  })
  idType: string;

  @ApiProperty({
    description: 'ID number',
    example: '12345678',
  })
  idNumber: string;

  @ApiProperty({
    description: 'Whether customer has missing requirements',
    example: false,
  })
  hasMissingRequirements: boolean;
}

export class BrandAmbassadorRegistrationsResponseDto {
  @ApiProperty({
    description: 'List of customer registrations',
    type: [BrandAmbassadorRegistrationDto],
  })
  data: BrandAmbassadorRegistrationDto[];

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
