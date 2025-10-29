import { ApiProperty } from '@nestjs/swagger';

export class CustomerSearchResultDto {
  @ApiProperty({
    description: 'Customer ID',
    example: 'cust_1234567890',
  })
  id: string;

  @ApiProperty({
    description: 'Full name (First + Middle + Last)',
    example: 'John Michael Doe',
  })
  fullName: string;

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
    description: 'Phone number',
    example: '+254700123456',
  })
  phoneNumber: string;

  @ApiProperty({
    description: 'Email address',
    example: 'john.doe@example.com',
    required: false,
  })
  email?: string;

  @ApiProperty({
    description: 'Number of spouses',
    example: 1,
  })
  numberOfSpouses: number;

  @ApiProperty({
    description: 'Number of children',
    example: 2,
  })
  numberOfChildren: number;

  @ApiProperty({
    description: 'Whether Next of Kin (beneficiary) has been added',
    example: true,
  })
  nokAdded: boolean;
}

export class CustomerSearchResponseDto {
  @ApiProperty({
    description: 'List of customers matching the search criteria',
    type: [CustomerSearchResultDto],
  })
  data: CustomerSearchResultDto[];

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

