import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsString, Min, MinLength } from 'class-validator';

/** Request body for PATCH .../customers/:customerId/policies/:policyId/scheme */
export class UpdateCustomerPolicySchemeDto {
  @ApiProperty({ description: 'New PackageScheme id (must be for the same package)' })
  @IsInt()
  @Min(1)
  packageSchemeId: number;
}

/**
 * Complete postpaid shell-policy pricing at registration payment step (no STK).
 * PATCH .../customers/:customerId/policies/postpaid-enrollment
 */
export class CompletePostpaidEnrollmentDto {
  @ApiProperty({ description: 'Package plan ID' })
  @IsInt()
  @Min(1)
  packagePlanId: number;

  @ApiProperty({ description: 'Installment premium amount' })
  @IsNumber()
  @Min(0)
  premium: number;

  @ApiProperty({ description: 'Annual premium from pricing JSON' })
  @IsNumber()
  @Min(0)
  annualPremium: number;

  @ApiProperty({ description: 'Product display name', example: 'Mfanisi Go Gold' })
  @IsString()
  @MinLength(1)
  productName: string;
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

  @ApiProperty({ description: 'Total / annual premium (from policy.annualPremium)' })
  totalPremium: string;

  @ApiProperty({ description: 'Installment amount (from policy.premium)' })
  installment: string;

  @ApiProperty({ description: 'Installments paid (ceil of confirmed amount / premium)' })
  installmentsPaid: number;

  @ApiProperty({ description: 'True when installments paid is approximate (show ~)' })
  installmentsPaidApproximate: boolean;

  @ApiProperty({ description: 'Missed installments past due as of today' })
  missedPayments: number;

  @ApiProperty({ description: 'True when missed count is approximate (show ~)' })
  missedPaymentsApproximate: boolean;

  @ApiProperty({ description: 'Count of confirmed payment transactions (tooltip)' })
  paymentsMadeCount: number;

  @ApiProperty({ description: 'Expected installment count for this policy frequency', nullable: true })
  expectedInstallmentCount: number | null;
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

/** One side of missed-payments amount (premium due or excess). */
export class MissedPaymentsAmountSideDto {
  @ApiProperty({ description: 'Premium due (missed amount); 0.00 when in excess' })
  amountMissed: string;

  @ApiProperty({
    description: 'Excess payment amount when paid exceeds expected; null when not in excess',
    nullable: true,
  })
  excessAmount: string | null;
}

export class MissedPaymentsAmountDto {
  @ApiProperty({ type: MissedPaymentsAmountSideDto })
  allTime: MissedPaymentsAmountSideDto;

  @ApiProperty({
    type: MissedPaymentsAmountSideDto,
    nullable: true,
    description: 'Filtered as-of to date when to date is before today; null when bracket not shown',
  })
  filtered: MissedPaymentsAmountSideDto | null;
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
  @ApiProperty({ nullable: true, description: 'Employer / LCT staff number' })
  staffNumber: string | null;

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
    /** Package slug for pricing file lookup */
    packageSlug: string | null;
  };

  enrollment: {
    startDate: string | null;
    endDate: string | null;
    frequency: string;
    paymentCadence: number;
    /** Snapshot of expected installments for this policy's frequency */
    expectedInstallmentCount: number | null;
    /** Nominal last installment date (set at activation) */
    nominalPaymentPeriodEndDate: string | null;
  };

  /** Total / annual premium (from policy.annualPremium) */
  totalPremium: string;
  /** Installment amount (from policy) */
  installmentAmount: string;
  totalPaidToDate: string;
  installmentsPaid: number;
  installmentsPaidApproximate: boolean;
  missedPayments: number;
  missedPaymentsApproximate: boolean;
  /** Confirmed payment transaction count (info tooltip) */
  paymentsMadeCount: number;

  @ApiProperty({ type: MissedPaymentsAmountDto })
  missedPaymentsAmount: MissedPaymentsAmountDto;

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
