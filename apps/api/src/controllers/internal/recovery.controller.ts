import {
  Controller,
  Get,
  Post,
  Body,
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
}
