import { ApiProperty } from '@nestjs/swagger';

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

  @ApiProperty({
    description: 'Customer phone number (masked)',
    example: '+254***678',
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
    description: 'ID number (masked)',
    example: '12***78',
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
