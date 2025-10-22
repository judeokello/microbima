import { ApiProperty } from '@nestjs/swagger';

export class AdminCustomerDto {
  @ApiProperty({
    description: 'Customer ID',
    example: 'cust_1234567890',
  })
  id: string;

  @ApiProperty({
    description: 'Customer full name',
    example: 'John Michael Doe',
  })
  fullName: string;

  @ApiProperty({
    description: 'Customer phone number (unmasked)',
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
    description: 'Display name of user who registered the customer',
    example: 'Jane Smith',
  })
  registeredBy: string;

  @ApiProperty({
    description: 'ID type',
    example: 'NATIONAL_ID',
    enum: ['NATIONAL_ID', 'PASSPORT', 'DRIVERS_LICENSE'],
  })
  idType: string;

  @ApiProperty({
    description: 'ID number (unmasked)',
    example: '12345678',
  })
  idNumber: string;

  @ApiProperty({
    description: 'Whether customer has missing requirements',
    example: false,
  })
  hasMissingRequirements: boolean;
}

export class AdminCustomersResponseDto {
  @ApiProperty({
    description: 'List of all customers',
    type: [AdminCustomerDto],
  })
  data: AdminCustomerDto[];

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
