import {
  Controller,
  Post,
  Get,
  Body,
  Query,
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
  CreatePolicyRequestDto,
  CreatePolicyResponseDto,
  PolicyResponseDto,
  PolicyPaymentResponseDto,
} from '../../dto/policies/create-policy.dto';
import { CorrelationId } from '../../decorators/correlation-id.decorator';

/**
 * Internal Policy Controller
 *
 * Handles HTTP requests for policy management operations.
 * Provides endpoints for creating policies with payments and tags.
 *
 * Features:
 * - Policy creation with policy number generation
 * - Policy payment creation in transaction
 * - Tag association with policies
 * - Swagger API documentation
 * - Correlation ID tracking
 */
@ApiTags('Internal - Policy Management')
@ApiBearerAuth()
@Controller('internal/policies')
export class PolicyController {
  constructor(private readonly policyService: PolicyService) {}

  /**
   * Create a policy with payment and tags
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create policy with payment',
    description: 'Create a new policy with payment and tags in a single transaction. Policy number is auto-generated based on package format.',
  })
  @ApiResponse({
    status: 201,
    description: 'Policy and payment created successfully',
    type: CreatePolicyResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
  })
  @ApiResponse({
    status: 404,
    description: 'Customer, package, or plan not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async createPolicy(
    @Body() createRequest: CreatePolicyRequestDto,
    @CorrelationId() correlationId: string
  ): Promise<CreatePolicyResponseDto> {
    const result = await this.policyService.createPolicyWithPayment(
      {
        customerId: createRequest.customerId,
        packageId: createRequest.packageId,
        packagePlanId: createRequest.packagePlanId,
        frequency: createRequest.frequency,
        premium: createRequest.premium,
        productName: createRequest.productName,
        tags: createRequest.tags,
        customDays: createRequest.customDays,
        paymentData: {
          paymentType: createRequest.paymentData.paymentType,
          transactionReference: createRequest.paymentData.transactionReference,
          amount: createRequest.paymentData.amount,
          accountNumber: createRequest.paymentData.accountNumber,
          details: createRequest.paymentData.details,
          expectedPaymentDate: new Date(createRequest.paymentData.expectedPaymentDate),
          actualPaymentDate: createRequest.paymentData.actualPaymentDate
            ? new Date(createRequest.paymentData.actualPaymentDate)
            : undefined,
          paymentMessageBlob: createRequest.paymentData.paymentMessageBlob,
        },
      },
      correlationId
    );

    const policyResponse: PolicyResponseDto = {
      id: result.policy.id,
      policyNumber: result.policy.policyNumber,
      status: result.policy.status,
      productName: result.policy.productName,
      premium: Number(result.policy.premium),
      startDate: result.policy.startDate.toISOString(),
      endDate: result.policy.endDate?.toISOString() || '',
    };

    const paymentResponse: PolicyPaymentResponseDto = {
      id: result.policyPayment.id,
      paymentType: result.policyPayment.paymentType,
      transactionReference: result.policyPayment.transactionReference,
      amount: Number(result.policyPayment.amount),
      expectedPaymentDate: result.policyPayment.expectedPaymentDate.toISOString(),
      actualPaymentDate: result.policyPayment.actualPaymentDate?.toISOString(),
    };

    return {
      status: HttpStatus.CREATED,
      correlationId,
      message: 'Policy and payment created successfully',
      policy: policyResponse,
      payment: paymentResponse,
    };
  }

  /**
   * Check if a transaction reference already exists
   */
  @Get('check-transaction-reference')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check if transaction reference exists',
    description: 'Validates if a transaction reference has already been used for a payment. Used to prevent duplicate transaction references before form submission.',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction reference check completed',
    schema: {
      type: 'object',
      properties: {
        exists: {
          type: 'boolean',
          description: 'True if transaction reference exists, false otherwise',
        },
        correlationId: {
          type: 'string',
        },
      },
    },
  })
  async checkTransactionReference(
    @Query('transactionReference') transactionReference: string,
    @CorrelationId() correlationId: string
  ): Promise<{ exists: boolean; correlationId: string }> {
    if (!transactionReference || transactionReference.trim() === '') {
      return {
        exists: false,
        correlationId,
      };
    }

    const exists = await this.policyService.checkTransactionReferenceExists(
      transactionReference,
      correlationId
    );

    return {
      exists,
      correlationId,
    };
  }
}

