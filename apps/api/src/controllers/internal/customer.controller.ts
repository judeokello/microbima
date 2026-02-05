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
  Req,
  Res,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CustomerService } from '../../services/customer.service';
import { PartnerManagementService } from '../../services/partner-management.service';
import { PrismaService } from '../../prisma/prisma.service';
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
import { RegistrationsChartResponseDto } from '../../dto/customers/registrations-chart.dto';
import { DashboardStatsDto } from '../../dto/customers/dashboard-stats.dto';
import { BrandAmbassadorDashboardStatsDto } from '../../dto/customers/brand-ambassador-dashboard-stats.dto';
import { CustomerDetailResponseDto } from '../../dto/customers/customer-detail.dto';
import { MemberCardsResponseDto } from '../../dto/customers/member-cards.dto';
import { CustomerPoliciesResponseDto, CustomerPaymentsResponseDto, CustomerPaymentsFilterDto } from '../../dto/customers/customer-payments-filter.dto';
import { UpdateCustomerDto } from '../../dto/customers/update-customer.dto';
import { UpdateDependantDto } from '../../dto/dependants/update-dependant.dto';
import { UpdateBeneficiaryDto } from '../../dto/beneficiaries/update-beneficiary.dto';
import { AddDependantsRequestDto } from '../../dto/dependants/add-dependants-request.dto';
import { AddDependantsResponseDto } from '../../dto/dependants/add-dependants-response.dto';
import { CorrelationId } from '../../decorators/correlation-id.decorator';
import { PartnerId } from '../../decorators/api-key.decorator';
import { Request, Response } from 'express';
import { ApiResponseDto } from '../../dto/common/api-response.dto';
import { SchemeDetailResponseDto } from '../../dto/schemes/scheme.dto';

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
    private readonly prismaService: PrismaService,
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
    @Req() req: Request,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ): Promise<BrandAmbassadorRegistrationsResponseDto> {
    const userId = req.user?.id;

    if (!userId) {
      throw new UnauthorizedException('User ID not found in request');
    }

    return this.customerService.getBrandAmbassadorRegistrations(
      userId,
      parseInt(page),
      parseInt(pageSize),
      fromDate,
      toDate,
      correlationId
    );
  }

  /**
   * Get Brand Ambassador registrations chart data
   */
  @Get('my-registrations-chart')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get agent registrations chart data',
    description: 'Get daily registration counts for the logged-in agent over a specified time period.',
  })
  @ApiQuery({
    name: 'period',
    description: 'Time period for chart data',
    required: false,
    enum: ['7d', '30d', '90d'],
    example: '30d',
  })
  @ApiResponse({
    status: 200,
    description: 'Chart data retrieved successfully',
    type: RegistrationsChartResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid authentication',
  })
  async getMyRegistrationsChart(
    @CorrelationId() correlationId: string,
    @Req() req: Request,
    @Query('period') period: '7d' | '30d' | '90d' = '30d',
  ): Promise<RegistrationsChartResponseDto> {
    const userId = req.user?.id ?? 'system';

    return this.customerService.getRegistrationsChartData(userId, period, correlationId);
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
    @Req() req: Request,
  ): Promise<BrandAmbassadorDashboardStatsDto> {
    const userId = req.user?.id ?? 'system';

    // Get Brand Ambassador info to derive partnerId
    const baInfo = await this.partnerManagementService.getBrandAmbassadorByUserId(userId);
    const partnerId = baInfo.partnerId;

    return this.customerService.getBrandAmbassadorDashboardStats(partnerId, correlationId);
  }

  /**
   * Get all registrations chart data (Admin/Customer Care only)
   */
  @Get('all-registrations-chart')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all registrations chart data (Admin)',
    description: 'Get daily registration counts for all agents over a specified time period. Admin/Customer Care role required.',
  })
  @ApiQuery({
    name: 'period',
    description: 'Time period for chart data',
    required: false,
    enum: ['7d', '30d', '90d'],
    example: '30d',
  })
  @ApiResponse({
    status: 200,
    description: 'Chart data retrieved successfully',
    type: RegistrationsChartResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid authentication',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - admin/customer care role required',
  })
  async getAllRegistrationsChart(
    @CorrelationId() correlationId: string,
    @Req() req: Request,
    @Query('period') period: '7d' | '30d' | '90d' = '30d',
  ): Promise<RegistrationsChartResponseDto> {
    // No userId filter - get all registrations
    return this.customerService.getRegistrationsChartData(undefined, period, correlationId);
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
    @Req() _req: Request,
  ) {
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
    @Req() _req: Request,
  ) {
    return this.customerService.getBrandAmbassadorsForFilter(correlationId);
  }

  /**
   * Search customers by name, ID number, phone number, or email
   */
  @Get('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Search customers',
    description: 'Search for customers using partial matching on name, ID number, phone number, or email. At least one search parameter is required.',
  })
  @ApiQuery({
    name: 'name',
    description: 'Partial name to search for (searches first, middle, and last name)',
    required: false,
    example: 'John',
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
    @Req() req: Request,
    @Query('name') name?: string,
    @Query('idNumber') idNumber?: string,
    @Query('phoneNumber') phoneNumber?: string,
    @Query('email') email?: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
  ): Promise<CustomerSearchResponseDto> {
    return this.customerService.searchCustomers(
      name,
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
    @Req() req: Request,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('createdBy') createdBy?: string,
  ): Promise<AdminCustomersResponseDto> {
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
    @Req() req: Request,
    @Res() res: Response,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
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
    @Req() req: Request, // Add request object to access authenticated user
  ): Promise<CreatePrincipalMemberResponseDto> {
    // Extract user ID from authenticated user
    const userId = req.user?.id ?? 'system';

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
    @Req() req: Request, // Add request object to access authenticated user
  ): Promise<AddBeneficiariesResponseDto> {
    // Extract user ID from authenticated user
    const userId = req.user?.id ?? 'system';

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
   * Get customer details with relations (for detail page)
   */
  @Get(':customerId/details')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get customer details (Internal)',
    description: 'Gets customer details with beneficiaries, dependants, and policies. This endpoint is only accessible internally.',
  })
  @ApiParam({
    name: 'customerId',
    description: 'Customer ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Customer details retrieved successfully',
    type: CustomerDetailResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Customer not found or not accessible',
  })
  async getCustomerDetails(
    @Param('customerId') customerId: string,
    @CorrelationId() correlationId: string,
    @Req() req: Request,
  ): Promise<CustomerDetailResponseDto> {
    const userId = req.user?.id ?? 'system';
    const userRoles = req.user?.roles ?? [];
    return this.customerService.getCustomerDetails(customerId, userId, userRoles, correlationId);
  }

  /**
   * Get member cards by policy (for Member cards tab and PNG download)
   */
  @Get(':customerId/member-cards')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get member cards by policy (Internal)',
    description:
      'Returns member cards data grouped by policy. Access same as customer detail page.',
  })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({ status: 200, description: 'Member cards grouped by policy' })
  @ApiResponse({ status: 404, description: 'Customer not found or not accessible' })
  async getMemberCards(
    @Param('customerId') customerId: string,
    @CorrelationId() correlationId: string,
    @Req() req: Request,
  ): Promise<MemberCardsResponseDto> {
    const userId = req.user?.id ?? 'system';
    const userRoles = req.user?.roles ?? [];
    return this.customerService.getMemberCards(customerId, userId, userRoles, correlationId);
  }

  /**
   * Get customer policies for filter dropdown
   */
  @Get(':customerId/policies')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get customer policies (Internal)',
    description: 'Gets customer policies formatted for dropdown filter. This endpoint is only accessible internally.',
  })
  @ApiParam({
    name: 'customerId',
    description: 'Customer ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Customer policies retrieved successfully',
    type: CustomerPoliciesResponseDto,
  })
  async getCustomerPolicies(
    @Param('customerId') customerId: string,
    @CorrelationId() correlationId: string,
    @Req() req: Request,
  ): Promise<CustomerPoliciesResponseDto> {
    const userId = req.user?.id ?? 'system';
    const userRoles = req.user?.roles ?? [];
    return this.customerService.getCustomerPolicies(customerId, userId, userRoles, correlationId);
  }

  /**
   * Get customer's scheme information
   */
  @Get(':customerId/scheme')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get customer scheme information (Internal)',
    description: 'Gets the scheme information for a customer if they belong to one.',
  })
  @ApiParam({
    name: 'customerId',
    description: 'Customer ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Scheme information retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Customer not found or not in a scheme',
  })
  async getCustomerScheme(
    @Param('customerId') customerId: string,
    @CorrelationId() correlationId: string,
  ): Promise<SchemeDetailResponseDto> {
    const schemeCustomer = await this.prismaService.packageSchemeCustomer.findFirst({
      where: { customerId },
      include: {
        packageScheme: {
          include: {
            scheme: {
              select: {
                id: true,
                schemeName: true,
                description: true,
                isActive: true,
                isPostpaid: true,
                frequency: true,
                paymentCadence: true,
                paymentAcNumber: true,
                createdBy: true,
                createdAt: true,
                updatedAt: true,
              },
            },
            package: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!schemeCustomer) {
      throw new NotFoundException('Customer not found or not enrolled in a scheme');
    }

    return {
      status: HttpStatus.OK,
      correlationId,
      message: 'Scheme information retrieved successfully',
      data: {
        id: schemeCustomer.packageScheme.scheme.id,
        schemeName: schemeCustomer.packageScheme.scheme.schemeName,
        description: schemeCustomer.packageScheme.scheme.description,
        isActive: schemeCustomer.packageScheme.scheme.isActive,
        isPostpaid: schemeCustomer.packageScheme.scheme.isPostpaid ?? undefined,
        frequency: schemeCustomer.packageScheme.scheme.frequency ?? undefined,
        paymentCadence: schemeCustomer.packageScheme.scheme.paymentCadence ?? undefined,
        paymentAcNumber: schemeCustomer.packageScheme.scheme.paymentAcNumber ?? undefined,
        createdBy: schemeCustomer.packageScheme.scheme.createdBy,
        createdAt: schemeCustomer.packageScheme.scheme.createdAt.toISOString(),
        updatedAt: schemeCustomer.packageScheme.scheme.updatedAt.toISOString(),
        packageSchemeId: schemeCustomer.packageSchemeId,
        packageId: schemeCustomer.packageScheme.package.id,
      },
    };
  }

  /**
   * Get customer payments with filters
   */
  @Get(':customerId/payments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get customer payments (Internal)',
    description: 'Gets customer payments with optional filters. This endpoint is only accessible internally.',
  })
  @ApiParam({
    name: 'customerId',
    description: 'Customer ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiQuery({
    name: 'policyId',
    description: 'Optional policy ID filter',
    required: false,
  })
  @ApiQuery({
    name: 'fromDate',
    description: 'Optional from date filter (YYYY-MM-DD)',
    required: false,
  })
  @ApiQuery({
    name: 'toDate',
    description: 'Optional to date filter (YYYY-MM-DD)',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Payments retrieved successfully',
    type: CustomerPaymentsResponseDto,
  })
  async getCustomerPayments(
    @Param('customerId') customerId: string,
    @Query() filters: CustomerPaymentsFilterDto,
    @CorrelationId() correlationId: string,
    @Req() req: Request,
  ): Promise<CustomerPaymentsResponseDto> {
    const userId = req.user?.id ?? 'system';
    const userRoles = req.user?.roles ?? [];
    return this.customerService.getCustomerPayments(
      customerId,
      userId,
      userRoles,
      correlationId,
      filters.policyId,
      filters.fromDate,
      filters.toDate
    );
  }

  /**
   * Add dependants to an existing customer (Internal)
   * @param customerId - Customer ID
   * @param addRequest - Dependants addition request
   * @param correlationId - Correlation ID from request header
   * @returns Dependants addition response
   */
  @Post(':customerId/dependants')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add dependants to customer (Internal)',
    description: 'Add children and/or spouses to an existing customer in a single transaction. At least one child or spouse must be provided. This endpoint is for internal use only.',
  })
  @ApiParam({
    name: 'customerId',
    description: 'Customer ID',
    example: 'cust_1234567890',
  })
  @ApiResponse({
    status: 201,
    description: 'Dependants added successfully',
    type: AddDependantsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation errors or no dependants provided',
  })
  @ApiResponse({
    status: 404,
    description: 'Customer not found or not accessible',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid authentication',
  })
  async addDependants(
    @Param('customerId') customerId: string,
    @Body() addRequest: AddDependantsRequestDto,
    @CorrelationId() correlationId: string,
    @Req() req: Request,
  ): Promise<AddDependantsResponseDto> {
    // Extract user ID from authenticated user
    const userId = req.user?.id ?? 'system';

    // Get Brand Ambassador info to derive partnerId
    const baInfo = await this.partnerManagementService.getBrandAmbassadorByUserId(userId);
    const partnerId = baInfo.partnerId;

    return this.customerService.addDependants(
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
    description: 'Customer not found or not accessible',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid authentication',
  })
  async updateCustomer(
    @Param('customerId') customerId: string,
    @Body() updateRequest: UpdateCustomerDto,
    @CorrelationId() correlationId: string,
    @Req() req: Request,
  ): Promise<PrincipalMemberDto> {
    const userId = req.user?.id ?? 'system';
    const userRoles = req.user?.roles ?? [];
    return this.customerService.updateCustomer(customerId, updateRequest, userId, userRoles, correlationId);
  }

  /**
   * Update a dependant
   */
  @Put('dependants/:dependantId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update dependant (Internal)',
    description: 'Updates an existing dependant. This endpoint is only accessible internally.',
  })
  @ApiParam({
    name: 'dependantId',
    description: 'Dependant ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Dependant updated successfully',
  })
  async updateDependant(
    @Param('dependantId') dependantId: string,
    @Body() updateRequest: UpdateDependantDto,
    @CorrelationId() correlationId: string,
    @Req() req: Request,
  ): Promise<ApiResponseDto<{
    id: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    dateOfBirth?: string;
    phoneNumber?: string;
    idType?: string;
    idNumber?: string;
    relationship: string;
  }>> {
    const userId = req.user?.id ?? 'system';
    const userRoles = req.user?.roles ?? [];
    const result = await this.customerService.updateDependant(dependantId, updateRequest, userId, userRoles, correlationId);
    return {
      status: HttpStatus.OK,
      correlationId,
      message: 'Dependant updated successfully',
      data: result as {
        id: string;
        firstName: string;
        middleName?: string;
        lastName: string;
        dateOfBirth?: string;
        phoneNumber?: string;
        idType?: string;
        idNumber?: string;
        relationship: string;
      },
    };
  }

  /**
   * Update a beneficiary
   */
  @Put(':customerId/beneficiaries/:beneficiaryId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update beneficiary (Internal)',
    description: 'Updates an existing beneficiary. This endpoint is only accessible internally.',
  })
  @ApiParam({
    name: 'customerId',
    description: 'Customer ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'beneficiaryId',
    description: 'Beneficiary ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Beneficiary updated successfully',
  })
  async updateBeneficiary(
    @Param('customerId') customerId: string,
    @Param('beneficiaryId') beneficiaryId: string,
    @Body() updateRequest: UpdateBeneficiaryDto,
    @CorrelationId() correlationId: string,
    @Req() req: Request,
  ): Promise<ApiResponseDto<{
    id: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    dateOfBirth?: string;
    gender?: string;
    email?: string;
    phoneNumber?: string;
    idType?: string;
    idNumber?: string;
    relationship?: string;
    relationshipDescription?: string;
    percentage?: number;
  }>> {
    const userId = req.user?.id ?? 'system';
    const userRoles = req.user?.roles ?? [];
    const result = await this.customerService.updateBeneficiary(customerId, beneficiaryId, updateRequest, userId, userRoles, correlationId);
    return {
      status: HttpStatus.OK,
      correlationId,
      message: 'Beneficiary updated successfully',
      data: result as {
        id: string;
        firstName: string;
        middleName?: string;
        lastName: string;
        dateOfBirth?: string;
        gender?: string;
        email?: string;
        phoneNumber?: string;
        idType?: string;
        idNumber?: string;
        relationship?: string;
        relationshipDescription?: string;
        percentage?: number;
      },
    };
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
    @Param('customerId') _customerId: string,
    @PartnerId() _partnerId: string,
    @CorrelationId() _correlationId: string,
  ): Promise<void> {
    // TODO: Implement deleteCustomer method in CustomerService
    throw new Error('Delete customer functionality not yet implemented');
  }

  /**
   * Get customer debug data (Internal - Admin only)
   * Returns raw database records for troubleshooting
   * @param customerId - Customer ID
   * @param correlationId - Correlation ID from request header
   */
  @Get(':customerId/debug')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get customer debug data (Internal - Admin only)',
    description: 'Returns raw database records for a customer including customer, dependants, policies, policy payments, and policy members. Used for troubleshooting.',
  })
  @ApiParam({
    name: 'customerId',
    description: 'Customer ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Debug data retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Customer not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getCustomerDebugData(
    @Param('customerId') customerId: string,
    @CorrelationId() _correlationId: string,
  ): Promise<ApiResponseDto<unknown>> {
    // Get customer record
    const customer = await this.prismaService.customer.findUnique({
      where: { id: customerId },
      include: {
        address: true,
        onboardingProgress: true,
        kycVerification: true,
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${customerId} not found`);
    }

    // Get all dependants for this customer
    const dependants = await this.prismaService.dependant.findMany({
      where: { customerId },
    });

    // Get all policies for this customer
    const policies = await this.prismaService.policy.findMany({
      where: { customerId },
      include: {
        package: true,
        packagePlan: true,
      },
    });

    // Get all policy payments for customer's policies
    const policyIds = policies.map(p => p.id);
    const policyPayments = policyIds.length > 0
      ? await this.prismaService.policyPayment.findMany({
          where: { policyId: { in: policyIds } },
        })
      : [];

    // Get all policy member principals for this customer
    const policyMemberPrincipals = await this.prismaService.policyMemberPrincipal.findMany({
      where: { customerId },
    });

    // Get all policy member dependants via customer's dependants
    const dependantIds = dependants.map(d => d.id);
    const policyMemberDependants = dependantIds.length > 0
      ? await this.prismaService.policyMemberDependant.findMany({
          where: { dependantId: { in: dependantIds } },
        })
      : [];

    return {
      status: HttpStatus.OK,
      correlationId: _correlationId,
      message: 'Debug data retrieved successfully',
      data: {
        customer,
        dependants,
        policies,
        policyPayments,
        policyMemberPrincipals,
        policyMemberDependants,
      },
    };
  }
}
