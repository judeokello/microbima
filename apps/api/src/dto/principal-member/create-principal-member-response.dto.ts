import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsBoolean, IsOptional } from 'class-validator';

export class PolicyInfoDto {
  @ApiProperty({
    description: 'Whether the policy was issued',
    example: true
  })
  @IsBoolean()
  issued: boolean;

  @ApiProperty({
    description: 'Policy number',
    example: 'POL-MFG-1755245811023-5193'
  })
  @IsString()
  policyNumber: string;

  @ApiProperty({
    description: 'Product code',
    example: 'mfanisi-go'
  })
  @IsString()
  productCode: string;

  @ApiProperty({
    description: 'Product name',
    example: 'Mfanisi Go Medical Coverage'
  })
  @IsString()
  productName: string;

  @ApiProperty({
    description: 'Policy status',
    example: 'active'
  })
  @IsString()
  status: string;
}

export class PaymentInfoDto {
  @ApiProperty({
    description: 'Product name',
    example: 'Mfanisi Go Medical Coverage'
  })
  @IsString()
  productName: string;

  @ApiProperty({
    description: 'Daily payment amount',
    example: 0
  })
  @IsNumber()
  dailyAmount: number;

  @ApiProperty({
    description: 'Total payment amount',
    example: 0
  })
  @IsNumber()
  totalAmount: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'KES'
  })
  @IsString()
  currency: string;
}

export class CreatePrincipalMemberResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 201
  })
  @IsNumber()
  status: number;

  @ApiProperty({
    description: 'Correlation ID from request',
    example: 'req-12345-67890'
  })
  @IsString()
  correlationId: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Principal member created successfully'
  })
  @IsString()
  message: string;

  @ApiProperty({
    description: 'Response data',
    type: 'object',
    additionalProperties: true
  })
  data: {
    principalId: string;
    partnerCustomerId: string;
    policy: PolicyInfoDto;
    payment: PaymentInfoDto;
    referredBy?: string;
  };
}
