import { ApiProperty } from '@nestjs/swagger';

export class TestCustomerResponseDto {
  @ApiProperty({ description: 'Test customer ID' })
  id!: string;

  @ApiProperty({ description: 'Display name' })
  name!: string;

  @ApiProperty({ description: 'Phone number (normalized)' })
  phoneNumber!: string;

  @ApiProperty({ description: 'When the record was created' })
  createdAt!: string;

  @ApiProperty({ description: 'User ID who created', nullable: true })
  createdBy!: string | null;
}

export class TestCustomerListResponseDto {
  @ApiProperty({ type: [TestCustomerResponseDto], description: 'List of test customers' })
  data!: TestCustomerResponseDto[];

  @ApiProperty({
    description: 'Pagination info',
    example: {
      page: 1,
      pageSize: 20,
      totalItems: 5,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  })
  pagination!: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
