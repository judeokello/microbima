import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PolicyService } from '../../services/policy.service';
import {
  GetCustomersWithoutPoliciesResponseDto,
  CreatePolicyFromRecoveryRequestDto,
  GetMemberNumberReconciliationResponseDto,
  ReconcilePolicyMemberNumbersRequestDto,
} from '../../dto/recovery/recovery.dto';
import { CorrelationId } from '../../decorators/correlation-id.decorator';

/**
 * Internal Recovery Controller
 *
 * Handles recovery flow for customers whose policy creation failed.
 * Used when M-Pesa payments exist but no policy record was created.
 */
@ApiTags('Internal - Recovery')
@ApiBearerAuth()
@Controller('internal/recovery')
export class RecoveryController {
  constructor(private readonly policyService: PolicyService) {}

  @Get('customers-without-policies')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get customers without policies who have M-Pesa payments',
    description:
      'Returns customers where accountNumber in mpesa_payment_report_items matches customers.idNumber, and the customer has no policy. Used for recovery flow.',
  })
  @ApiResponse({ status: 200, description: 'List of customers with payments' })
  async getCustomersWithoutPolicies(
    @CorrelationId() correlationId: string
  ): Promise<GetCustomersWithoutPoliciesResponseDto> {
    const customers =
      await this.policyService.getCustomersWithoutPoliciesWithPayments(
        correlationId
      );
    return {
      customers: customers.map((c) => ({
        id: c.id,
        fullName: c.fullName,
        idNumber: c.idNumber,
        packageId: c.packageId,
        packageName: c.packageName,
        payments: c.payments.map((p) => ({
          id: p.id,
          transactionReference: p.transactionReference,
          paidIn: p.paidIn,
          completionTime: p.completionTime.toISOString(),
          accountNumber: p.accountNumber,
        })),
        earliestPaymentDate: c.earliestPaymentDate.toISOString(),
      })),
    };
  }

  @Post('create-policy')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create policy from recovery',
    description:
      'Creates policy, policy_payments from M-Pesa items, and activates the policy. For customers whose policy creation failed.',
  })
  @ApiResponse({ status: 201, description: 'Policy created and activated' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Customer or package not found' })
  async createPolicyFromRecovery(
    @Body() body: CreatePolicyFromRecoveryRequestDto,
    @CorrelationId() correlationId: string
  ) {
    const policy = await this.policyService.createPolicyFromRecovery(
      {
        customerId: body.customerId,
        packageId: body.packageId,
        packagePlanId: body.packagePlanId,
        premium: body.premium,
        frequency: body.frequency,
        customDays: body.customDays,
      },
      correlationId
    );
    return {
      status: HttpStatus.CREATED,
      correlationId,
      message: 'Policy created and activated successfully',
      policy: {
        id: policy.id,
        policyNumber: policy.policyNumber,
        status: policy.status,
        productName: policy.productName,
        premium: Number(policy.premium),
        startDate: policy.startDate?.toISOString() ?? '',
        endDate: policy.endDate?.toISOString() ?? '',
        paymentAcNumber: policy.paymentAcNumber,
      },
    };
  }

  @Get('member-number-reconciliation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get member number reconciliation list',
    description:
      'Returns first 50 customers (by createdAt) with their policies. Each row is one policy or one customer without policy (policy number N/A). For temporary reconciliation of member numbers on cards vs DB.',
  })
  @ApiResponse({ status: 200, description: 'List of rows for reconciliation' })
  async getMemberNumberReconciliation(
    @CorrelationId() correlationId: string
  ): Promise<GetMemberNumberReconciliationResponseDto> {
    const rows = await this.policyService.getMemberNumberReconciliationList(correlationId);
    return { rows };
  }

  @Patch('member-number-reconciliation/:policyId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reconcile policy member numbers',
    description:
      'Updates policy number and regenerates principal + dependant member numbers using package format (spouses 01, 02, then others). Policy number must be unique and max 15 characters.',
  })
  @ApiResponse({ status: 200, description: 'Reconciliation completed' })
  @ApiResponse({ status: 400, description: 'Validation error (e.g. policy number too long)' })
  @ApiResponse({ status: 404, description: 'Policy not found' })
  @ApiResponse({ status: 409, description: 'Policy number already in use' })
  async reconcilePolicyMemberNumbers(
    @Param('policyId') policyId: string,
    @Body() body: ReconcilePolicyMemberNumbersRequestDto,
    @CorrelationId() correlationId: string
  ): Promise<{ status: number; correlationId: string; message: string }> {
    await this.policyService.reconcilePolicyMemberNumbers(
      policyId,
      body.policyNumber,
      correlationId
    );
    return {
      status: HttpStatus.OK,
      correlationId,
      message: 'Member numbers reconciled successfully',
    };
  }
}
