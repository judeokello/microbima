import {
  Controller,
  Post,
  Put,
  Delete,
  Get,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
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
import { BrandAmbassadorRegistrationsResponseDto } from '../../dto/customers/brand-ambassador-registrations.dto';
import { AdminCustomersResponseDto } from '../../dto/customers/admin-customers.dto';
import { CustomerSearchResponseDto } from '../../dto/customers/customer-search.dto';
import { DashboardStatsDto } from '../../dto/customers/dashboard-stats.dto';
import { BrandAmbassadorDashboardStatsDto } from '../../dto/customers/brand-ambassador-dashboard-stats.dto';
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
   * Get brand ambassador's customer registrations
   */
  @Get('my-registrations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get agent registrations',
    description: 'Get customers registered by the current agent with pagination and date filtering.',
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number (1-based)',
    required: false,
    example: 1,
  })
  @ApiQuery({
    name: 'pageSize',
    description: 'Number of items per page',
    required: false,
    example: 20,
  })
  @ApiQuery({
    name: 'fromDate',
    description: 'Filter from date (ISO 8601 format)',
    required: false,
    example: '2024-01-01',
  })
  @ApiQuery({
    name: 'toDate',
    description: 'Filter to date (ISO 8601 format)',
    required: false,
    example: '2024-12-31',
  })
  @ApiResponse({
    status: 200,
    description: 'Customer registrations retrieved successfully',
    type: BrandAmbassadorRegistrationsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid authentication',
  })
  async getMyRegistrations(
    @CorrelationId() correlationId: string,
    @Req() req: any,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ): Promise<BrandAmbassadorRegistrationsResponseDto> {
    const userId = req.user?.id || 'system';
    const baInfo = await this.partnerManagementService.getBrandAmbassadorByUserId(userId);
    const partnerId = baInfo.partnerId;

    return this.customerService.getBrandAmbassadorRegistrations(
      partnerId,
      parseInt(page),
      parseInt(pageSize),
      fromDate,
      toDate,
      correlationId
    );
  }

  /**
   * Get Brand Ambassador dashboard statistics
   */
  @Get('my-dashboard-stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Brand Ambassador dashboard statistics',
    description: 'Get dashboard statistics for the logged-in Brand Ambassador including registrations today, yesterday, this week, last week, and total.',
  })
  @ApiResponse({
    status: 200,
    description: 'Brand Ambassador dashboard statistics retrieved successfully',
    type: BrandAmbassadorDashboardStatsDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid authentication',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - brand ambassador role required',
  })
  async getBrandAmbassadorDashboardStats(
    @CorrelationId() correlationId: string,
    @Req() req: any,
  ): Promise<BrandAmbassadorDashboardStatsDto> {
    const userId = req.user?.id || 'system';
    
    // Get Brand Ambassador info to derive partnerId
    const baInfo = await this.partnerManagementService.getBrandAmbassadorByUserId(userId);
    const partnerId = baInfo.partnerId;
    
    return this.customerService.getBrandAmbassadorDashboardStats(partnerId, correlationId);
  }

  /**
   * Get dashboard statistics (Admin/Customer Care only)
   */
  @Get('dashboard-stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get dashboard statistics',
    description: 'Get dashboard statistics including total agents, active agents, total customers, registrations today, and pending MRs. Admin/Customer Care role required.',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard statistics retrieved successfully',
    type: DashboardStatsDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid authentication',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - admin/customer care role required',
  })
  async getDashboardStats(
    @CorrelationId() correlationId: string,
    @Req() req: any,
  ) {
    const userId = req.user?.id || 'system';
    
    return this.customerService.getDashboardStats(correlationId);
  }

  /**
   * Get Brand Ambassadors for filter dropdown (Admin/Customer Care only)
   */
  @Get('brand-ambassadors')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Brand Ambassadors for filter',
    description: 'Get list of Brand Ambassadors for the Created By filter dropdown. Admin/Customer Care role required.',
  })
  @ApiResponse({
    status: 200,
    description: 'Brand Ambassadors retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid authentication',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - admin/customer care role required',
  })
  async getBrandAmbassadorsForFilter(
    @CorrelationId() correlationId: string,
    @Req() req: any,
  ) {
    const userId = req.user?.id || 'system';
    
    return this.customerService.getBrandAmbassadorsForFilter(correlationId);
  }

  /**
   * Search customers by ID number, phone number, or email
   */
  @Get('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Search customers',
    description: 'Search for customers using partial matching on ID number, phone number, or email. At least one search parameter is required.',
  })
  @ApiQuery({
    name: 'idNumber',
    description: 'Partial ID number to search for',
    required: false,
    example: '123',
  })
  @ApiQuery({
    name: 'phoneNumber',
    description: 'Partial phone number to search for',
    required: false,
    example: '0700',
  })
  @ApiQuery({
    name: 'email',
    description: 'Partial email to search for',
    required: false,
    example: 'john',
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number (1-based)',
    required: false,
    example: 1,
  })
  @ApiQuery({
    name: 'pageSize',
    description: 'Number of items per page',
    required: false,
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'Search results retrieved successfully',
    type: CustomerSearchResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid authentication',
  })
  async searchCustomers(
    @CorrelationId() correlationId: string,
    @Req() req: any,
    @Query('idNumber') idNumber?: string,
    @Query('phoneNumber') phoneNumber?: string,
    @Query('email') email?: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
  ): Promise<CustomerSearchResponseDto> {
    return this.customerService.searchCustomers(
      idNumber,
      phoneNumber,
      email,
      parseInt(page),
      parseInt(pageSize),
      correlationId
    );
  }

  /**
   * Get all customers (Admin/Customer Care only)
   */
  @Get('all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all customers (Admin)',
    description: 'Get all customers in the system with pagination and date filtering. Admin/Customer Care role required.',
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number (1-based)',
    required: false,
    example: 1,
  })
  @ApiQuery({
    name: 'pageSize',
    description: 'Number of items per page',
    required: false,
    example: 20,
  })
  @ApiQuery({
    name: 'fromDate',
    description: 'Filter from date (ISO 8601 format)',
    required: false,
    example: '2024-01-01',
  })
  @ApiQuery({
    name: 'toDate',
    description: 'Filter to date (ISO 8601 format)',
    required: false,
    example: '2024-12-31',
  })
  @ApiQuery({
    name: 'createdBy',
    description: 'Filter by Brand Ambassador display name',
    required: false,
    example: 'John Doe',
  })
  @ApiResponse({
    status: 200,
    description: 'All customers retrieved successfully',
    type: AdminCustomersResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid authentication',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - admin/customer care role required',
  })
  async getAllCustomers(
    @CorrelationId() correlationId: string,
    @Req() req: any,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('createdBy') createdBy?: string,
  ): Promise<AdminCustomersResponseDto> {
    const userId = req.user?.id || 'system';
    
    return this.customerService.getAllCustomers(
      parseInt(page),
      parseInt(pageSize),
      fromDate,
      toDate,
      createdBy,
      correlationId
    );
  }

  /**
   * Export customers to CSV (Admin/Customer Care only)
   */
  @Get('export')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Export customers to CSV (Admin)',
    description: 'Export customer data to CSV format. Admin/Customer Care role required.',
  })
  @ApiQuery({
    name: 'fromDate',
    description: 'Filter from date (ISO 8601 format)',
    required: false,
    example: '2024-01-01',
  })
  @ApiQuery({
    name: 'toDate',
    description: 'Filter to date (ISO 8601 format)',
    required: false,
    example: '2024-12-31',
  })
  @ApiResponse({
    status: 200,
    description: 'CSV file generated successfully',
    content: {
      'text/csv': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid authentication',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - admin/customer care role required',
  })
  async exportCustomers(
    @CorrelationId() correlationId: string,
    @Req() req: any,
    @Res() res: any,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    const userId = req.user?.id || 'system';
    
    const exportData = await this.customerService.exportCustomersToCSV(
      fromDate,
      toDate,
      correlationId
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${exportData.filename}"`);
    res.send(exportData.content);
  }

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
