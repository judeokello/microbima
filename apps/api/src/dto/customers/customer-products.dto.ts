import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

/** Request body for PATCH .../customers/:customerId/policies/:policyId/scheme */
export class UpdateCustomerPolicySchemeDto {
  @ApiProperty({ description: 'New PackageScheme id (must be for the same package)' })
  @IsInt()
  @Min(1)
  packageSchemeId: number;
}

/**
 * Rich policy list item for Products tab (GET .../policies/list)
 */
export class CustomerPolicyListItemDto {
  @ApiProperty({ description: 'Policy ID' })
  id: string;

  @ApiProperty({ description: 'Product name' })
  productName: string;

  @ApiProperty({ description: 'Package name' })
  packageName: string;

  @ApiProperty({ description: 'Plan name', required: false })
  planName?: string | null;

  @ApiProperty({ description: 'Scheme name (or — if none)' })
  schemeName: string;

  @ApiProperty({ description: 'Underwriter name (or — if none)', required: false })
  underwriterName?: string | null;

  @ApiProperty({ description: 'Policy status' })
  status: string;

  @ApiProperty({ description: 'Total premium (from package)' })
  totalPremium: string;

  @ApiProperty({ description: 'Installment amount (from policy)' })
  installment: string;

  @ApiProperty({ description: 'Number of installments paid (actualPaymentDate set)' })
  installmentsPaid: number;

  @ApiProperty({ description: 'Number of missed payments (expected in past, no actual)' })
  missedPayments: number;
}

export class CustomerPolicyListResponseDto {
  @ApiProperty({ example: 200 })
  status: number;
  @ApiProperty()
  correlationId: string;
  @ApiProperty()
  message: string;
  @ApiProperty({ type: [CustomerPolicyListItemDto] })
  data: CustomerPolicyListItemDto[];
}

/**
 * Policy detail for product detail page (GET .../policies/:policyId)
 */
export class CustomerPolicyDetailDto {
  @ApiProperty()
  id: string;
  @ApiProperty({ nullable: true })
  policyNumber: string | null;
  @ApiProperty()
  status: string;

  /** Package ID (for loading schemes and updating scheme) */
  packageId: number;
  /** Current scheme assignment: PackageScheme id (for dropdown value and PATCH) */
  packageSchemeId: number | null;

  product: {
    underwriterName: string | null;
    packageName: string;
    planName: string | null;
    schemeName: string;
    productName: string;
    /** Days in premium year for installment helpers; null until configured */
    productDurationDays: number | null;
  };

  enrollment: {
    startDate: string | null;
    endDate: string | null;
    frequency: string;
    paymentCadence: number;
  };

  /** Total premium (from package) */
  totalPremium: string;
  /** Installment amount (from policy) */
  installmentAmount: string;
  totalPaidToDate: string;
  installmentsPaid: number;
  missedPayments: number;

  @ApiProperty({
    description: 'Billing mode from linked scheme',
    enum: ['prepaid', 'postpaid'],
  })
  schemeBillingMode: 'prepaid' | 'postpaid';
}

export class CustomerPolicyDetailResponseDto {
  @ApiProperty({ example: 200 })
  status: number;
  @ApiProperty()
  correlationId: string;
  @ApiProperty()
  message: string;
  @ApiProperty({ type: CustomerPolicyDetailDto })
  data: CustomerPolicyDetailDto;
}
