import { ApiProperty } from '@nestjs/swagger';
import { MpesaStatementReasonType } from '@prisma/client';

export class MpesaPaymentReportItemDto {
  @ApiProperty({
    description: 'Transaction item ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Transaction reference (Receipt No.)',
    example: 'TK5AY9DLMG',
  })
  transactionReference: string;

  @ApiProperty({
    description: 'Completion time',
    example: '2025-11-05T21:45:13Z',
  })
  completionTime: Date;

  @ApiProperty({
    description: 'Initiation time',
    example: '2025-11-05T21:45:13Z',
  })
  initiationTime: Date;

  @ApiProperty({
    description: 'Payment details',
    example: 'Pay Bill from 25472****108 -',
    required: false,
  })
  paymentDetails?: string;

  @ApiProperty({
    description: 'Transaction status',
    example: 'Completed',
    required: false,
  })
  transactionStatus?: string;

  @ApiProperty({
    description: 'Amount paid in',
    example: 111.0,
  })
  paidIn: number;

  @ApiProperty({
    description: 'Amount withdrawn',
    example: 0.0,
  })
  withdrawn: number;

  @ApiProperty({
    description: 'Account balance after transaction',
    example: 82459.0,
  })
  accountBalance: number;

  @ApiProperty({
    description: 'Balance confirmed',
    example: 'true',
    required: false,
  })
  balanceConfirmed?: string;

  @ApiProperty({
    description: 'Reason type',
    example: 'PayBill_STK',
    enum: MpesaStatementReasonType,
  })
  reasonType: MpesaStatementReasonType;

  @ApiProperty({
    description: 'Other party info',
    example: '25472****108 - VICTOR **** NGURE',
    required: false,
  })
  otherPartyInfo?: string;

  @ApiProperty({
    description: 'Linked transaction ID',
    example: '37941535',
    required: false,
  })
  linkedTransactionId?: string;

  @ApiProperty({
    description: 'Account number',
    example: '37941535',
    required: false,
  })
  accountNumber?: string;

  @ApiProperty({
    description: 'Whether the item has been processed',
    example: false,
  })
  isProcessed: boolean;

  @ApiProperty({
    description: 'Whether the item has been mapped to a policy payment',
    example: false,
  })
  isMapped: boolean;

  @ApiProperty({
    description: 'Created at timestamp',
    example: '2025-11-05T21:45:13Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Updated at timestamp',
    example: '2025-11-05T21:45:13Z',
  })
  updatedAt: Date;
}

export class MpesaPaymentReportUploadDto {
  @ApiProperty({
    description: 'Upload ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Account holder name',
    example: 'PAA INSURANCE AGENCY LIMITED',
  })
  accountHolder: string;

  @ApiProperty({
    description: 'Short code',
    example: '4125223',
    required: false,
  })
  shortCode?: string;

  @ApiProperty({
    description: 'Account type',
    example: 'Utility Account',
    required: false,
  })
  account?: string;

  @ApiProperty({
    description: 'Time period from',
    example: '2025-10-11T00:00:00Z',
  })
  timeFrom: Date;

  @ApiProperty({
    description: 'Time period to',
    example: '2025-11-05T23:59:59Z',
  })
  timeTo: Date;

  @ApiProperty({
    description: 'Operator username',
    example: 'jponyango',
    required: false,
  })
  operator?: string;

  @ApiProperty({
    description: 'Opening balance',
    example: 4040.0,
    required: false,
  })
  openingBalance?: number;

  @ApiProperty({
    description: 'Closing balance',
    example: 82459.0,
    required: false,
  })
  closingBalance?: number;

  @ApiProperty({
    description: 'Available balance',
    example: 82459.0,
    required: false,
  })
  availableBalance?: number;

  @ApiProperty({
    description: 'Total paid in',
    example: 172055.0,
    required: false,
  })
  totalPaidIn?: number;

  @ApiProperty({
    description: 'Total withdrawn',
    example: -89636.0,
    required: false,
  })
  totalWithdrawn?: number;

  @ApiProperty({
    description: 'File path in storage',
    example: 'mpesa_statements/statement_1699200000000.xlsx',
    required: false,
  })
  filePath?: string;

  @ApiProperty({
    description: 'User ID who created the upload',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  createdBy?: string;

  @ApiProperty({
    description: 'Created at timestamp',
    example: '2025-11-05T21:45:13Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Updated at timestamp',
    example: '2025-11-05T21:45:13Z',
  })
  updatedAt: Date;
}

export class MpesaPaymentReportUploadListResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 200,
  })
  status: number;

  @ApiProperty({
    description: 'Correlation ID for request tracking',
    example: 'req-1234567890',
  })
  correlationId: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Uploads retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'List of MPESA payment report uploads',
    type: [MpesaPaymentReportUploadDto],
  })
  data: MpesaPaymentReportUploadDto[];

  @ApiProperty({
    description: 'Pagination information',
    example: {
      page: 1,
      pageSize: 20,
      totalItems: 100,
      totalPages: 5,
      hasNextPage: true,
      hasPreviousPage: false,
    },
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

export class MpesaPaymentReportUploadDetailsResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 200,
  })
  status: number;

  @ApiProperty({
    description: 'Correlation ID for request tracking',
    example: 'req-1234567890',
  })
  correlationId: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Upload details retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Upload details',
    type: MpesaPaymentReportUploadDto,
  })
  upload: MpesaPaymentReportUploadDto;

  @ApiProperty({
    description: 'Transaction items',
    type: [MpesaPaymentReportItemDto],
  })
  items: MpesaPaymentReportItemDto[];

  @ApiProperty({
    description: 'Pagination information for items',
    example: {
      page: 1,
      pageSize: 20,
      totalItems: 150,
      totalPages: 8,
      hasNextPage: true,
      hasPreviousPage: false,
    },
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

export class MpesaPaymentUploadResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 201,
  })
  status: number;

  @ApiProperty({
    description: 'Correlation ID for request tracking',
    example: 'req-1234567890',
  })
  correlationId: string;

  @ApiProperty({
    description: 'Response message',
    example: 'File uploaded and parsed successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Upload details',
    type: MpesaPaymentReportUploadDto,
  })
  upload: MpesaPaymentReportUploadDto;

  @ApiProperty({
    description: 'Number of transaction items imported',
    example: 150,
  })
  itemsCount: number;
}

