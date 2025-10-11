import {
  Controller,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpStatus,
  HttpCode,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiSecurity,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CustomerService } from '../../services/customer.service';
import { PartnerManagementService } from '../../services/partner-management.service';
// TODO: Create UpdatePrincipalMemberRequestDto when implementing update functionality
// import { UpdatePrincipalMemberRequestDto } from '../../dto/principal-member/update-principal-member-request.dto';
import { PrincipalMemberDto } from '../../dto/principal-member/principal-member.dto';
import { CreatePrincipalMemberRequestDto } from '../../dto/principal-member/create-principal-member-request.dto';
import { CreatePrincipalMemberResponseDto } from '../../dto/principal-member/create-principal-member-response.dto';
import { AddBeneficiariesRequestDto } from '../../dto/beneficiaries/add-beneficiaries-request.dto';
import { AddBeneficiariesResponseDto } from '../../dto/beneficiaries/add-beneficiaries-response.dto';
import { CorrelationId } from '../../decorators/correlation-id.decorator';
import { PartnerId } from '../../decorators/api-key.decorator';

/**
 * Internal Customer Controller
 *
 * Handles internal HTTP requests for customer management operations.
 * These endpoints are NOT exposed through the public Kong gateway.
 *
 * Features:
 * - Customer updates (internal only)
 * - Customer deletion (internal only)
 * - Proper error handling and validation
 * - Swagger API documentation
 * - Correlation ID tracking
 */
@ApiTags('Internal - Customer Management')
@ApiBearerAuth()
@Controller('internal/customers')
export class InternalCustomerController {
  constructor(
    private readonly customerService: CustomerService,
    private readonly partnerManagementService: PartnerManagementService,
  ) {}

  /**
   * Create a new customer (Internal with userId support)
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create customer (Internal)',
    description: 'Create a new customer with userId tracking for internal use.',
  })
  @ApiResponse({
    status: 201,
    description: 'Customer created successfully',
    type: CreatePrincipalMemberResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid authentication',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async createCustomer(
    @Body() createRequest: CreatePrincipalMemberRequestDto,
    @CorrelationId() correlationId: string,
    @Req() req: any, // Add request object to access authenticated user
  ): Promise<CreatePrincipalMemberResponseDto> {
    // Extract user ID from authenticated user
    const userId = req.user?.id || 'system';
    
    // Get Brand Ambassador info to derive partnerId
    const baInfo = await this.partnerManagementService.getBrandAmbassadorByUserId(userId);
    const partnerId = baInfo.partnerId;
    
    return this.customerService.createCustomer(
      createRequest,
      partnerId,
      correlationId,
      true, // Skip redundant partner validation
      userId
    );
  }

  /**
   * Add beneficiaries to an existing customer (Internal)
   * @param customerId - Customer ID
   * @param addRequest - Beneficiaries addition request
   * @param correlationId - Correlation ID from request header
   * @returns Beneficiaries addition response
   */
  @Post(':customerId/beneficiaries')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add beneficiaries to customer (Internal)',
    description: 'Add one or more beneficiaries to an existing customer in a single transaction. At least one beneficiary must be provided. This endpoint is for internal use only.',
  })
  @ApiParam({
    name: 'customerId',
    description: 'Customer ID',
    example: 'cust_1234567890',
  })
  @ApiResponse({
    status: 201,
    description: 'Beneficiaries added successfully',
    type: AddBeneficiariesResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation errors or no beneficiaries provided',
  })
  @ApiResponse({
    status: 404,
    description: 'Customer not found or not accessible to this partner',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid authentication',
  })
  async addBeneficiaries(
    @Param('customerId') customerId: string,
    @Body() addRequest: AddBeneficiariesRequestDto,
    @CorrelationId() correlationId: string,
    @Req() req: any, // Add request object to access authenticated user
  ): Promise<AddBeneficiariesResponseDto> {
    // Extract user ID from authenticated user
    const userId = req.user?.id || 'system';
    
    // Get Brand Ambassador info to derive partnerId
    const baInfo = await this.partnerManagementService.getBrandAmbassadorByUserId(userId);
    const partnerId = baInfo.partnerId;
    
    return this.customerService.addBeneficiaries(
      customerId,
      addRequest,
      partnerId,
      correlationId
    );
  }

  /**
   * Update an existing customer
   * @param customerId - Customer ID
   * @param updateRequest - Customer update request
   * @param partnerId - Partner ID from API key validation
   * @param correlationId - Correlation ID from request header
   * @returns Updated customer data
   */
  @Put(':customerId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update customer (Internal)',
    description: 'Updates an existing customer. This endpoint is only accessible internally and not exposed through the public API gateway.',
  })
  @ApiParam({
    name: 'customerId',
    description: 'Customer ID',
    example: 'cust_1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Customer updated successfully',
    type: PrincipalMemberDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation errors',
  })
  @ApiResponse({
    status: 404,
    description: 'Customer not found or not accessible to this partner',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or inactive API key',
  })
  async updateCustomer(
    @Param('customerId') customerId: string,
    @Body() updateRequest: any, // TODO: Replace with UpdatePrincipalMemberRequestDto
    @PartnerId() partnerId: string,
    @CorrelationId() correlationId: string,
  ): Promise<PrincipalMemberDto> {
    // TODO: Implement updateCustomer method in CustomerService
    throw new Error('Update customer functionality not yet implemented');
  }

  /**
   * Delete a customer
   * @param customerId - Customer ID
   * @param partnerId - Partner ID from API key validation
   * @param correlationId - Correlation ID from request header
   * @returns Deletion confirmation
   */
  @Delete(':customerId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete customer (Internal)',
    description: 'Deletes a customer. This endpoint is only accessible internally and not exposed through the public API gateway.',
  })
  @ApiParam({
    name: 'customerId',
    description: 'Customer ID',
    example: 'cust_1234567890',
  })
  @ApiResponse({
    status: 204,
    description: 'Customer deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Customer not found or not accessible to this partner',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or inactive API key',
  })
  async deleteCustomer(
    @Param('customerId') customerId: string,
    @PartnerId() partnerId: string,
    @CorrelationId() correlationId: string,
  ): Promise<void> {
    // TODO: Implement deleteCustomer method in CustomerService
    throw new Error('Delete customer functionality not yet implemented');
  }
}
