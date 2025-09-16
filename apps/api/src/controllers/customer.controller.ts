import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiSecurity,
} from '@nestjs/swagger';
import { CustomerService } from '../services/customer.service';
import { CreatePrincipalMemberRequestDto } from '../dto/principal-member/create-principal-member-request.dto';
import { CreatePrincipalMemberResponseDto } from '../dto/principal-member/create-principal-member-response.dto';
import { PrincipalMemberDto } from '../dto/principal-member/principal-member.dto';
import { AddDependantsRequestDto } from '../dto/dependants/add-dependants-request.dto';
import { AddDependantsResponseDto } from '../dto/dependants/add-dependants-response.dto';
import { GetDependantsResponseDto } from '../dto/dependants/get-dependants-response.dto';
import { AddBeneficiariesRequestDto } from '../dto/beneficiaries/add-beneficiaries-request.dto';
import { AddBeneficiariesResponseDto } from '../dto/beneficiaries/add-beneficiaries-response.dto';
import { GetBeneficiariesResponseDto } from '../dto/beneficiaries/get-beneficiaries-response.dto';
import { CorrelationId } from '../decorators/correlation-id.decorator';
import { PartnerId } from '../decorators/api-key.decorator';

/**
 * Customer Controller
 * 
 * Handles HTTP requests for customer CRUD operations
 * All endpoints are scoped to the authenticated partner via API key
 * 
 * Features:
 * - Customer creation with partner relationship
 * - Customer retrieval (single and list) scoped to partner
 * - Proper error handling and validation
 * - Swagger API documentation
 * - Correlation ID tracking
 */
@ApiTags('Customer Management')
@ApiSecurity('api-key')
@Controller('v1/customers')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  /**
   * Create a new customer
   * @param createRequest - Customer creation request
   * @param partnerId - Partner ID from API key validation
   * @param correlationId - Correlation ID from request header
   * @returns Customer creation response
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new customer',
    description: 'Creates a new customer with partner relationship. The customer will be scoped to the authenticated partner.',
  })
  @ApiResponse({
    status: 201,
    description: 'Customer created successfully',
    type: CreatePrincipalMemberResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation errors or duplicate customer',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or inactive API key',
  })
  async createCustomer(
    @Body() createRequest: CreatePrincipalMemberRequestDto,
    @PartnerId() partnerId: string,
    @CorrelationId() correlationId: string,
  ): Promise<CreatePrincipalMemberResponseDto> {
    // Skip partner validation since API key middleware already validated it
    return this.customerService.createCustomer(
      createRequest,
      Number(partnerId),
      correlationId,
      true // Skip redundant partner validation
    );
  }

  /**
   * Get customer by ID
   * @param customerId - Customer ID
   * @param partnerId - Partner ID from API key validation
   * @param correlationId - Correlation ID from request header
   * @returns Customer data
   */
  @Get(':customerId')
  @ApiOperation({
    summary: 'Get customer by ID',
    description: 'Retrieves a specific customer by ID. Only returns customers that belong to the authenticated partner.',
  })
  @ApiParam({
    name: 'customerId',
    description: 'Customer ID',
    example: 'cust_1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Customer retrieved successfully',
    type: PrincipalMemberDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Customer not found or not accessible to this partner',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or inactive API key',
  })
  async getCustomerById(
    @Param('customerId') customerId: string,
    @PartnerId() partnerId: string,
    @CorrelationId() correlationId: string,
  ): Promise<PrincipalMemberDto> {
    return this.customerService.getCustomerById(
      customerId,
      Number(partnerId),
      correlationId
    );
  }

  /**
   * Get all customers for the authenticated partner
   * @param partnerId - Partner ID from API key validation
   * @param correlationId - Correlation ID from request header
   * @param page - Page number (default: 1)
   * @param limit - Items per page (default: 10, max: 100)
   * @returns Paginated customer list
   */
  @Get()
  @ApiOperation({
    summary: 'Get all customers for partner',
    description: 'Retrieves a paginated list of all customers that belong to the authenticated partner.',
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number',
    required: false,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Items per page (max: 100)',
    required: false,
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Customers retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        customers: {
          type: 'array',
          items: { $ref: '#/components/schemas/PrincipalMemberDto' },
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 10 },
            total: { type: 'number', example: 25 },
            totalPages: { type: 'number', example: 3 },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or inactive API key',
  })
  async getCustomers(
    @PartnerId() partnerId: string,
    @CorrelationId() correlationId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<{
    customers: PrincipalMemberDto[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    // Parse and validate query parameters
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNumber = limit ? parseInt(limit, 10) : 10;

    return this.customerService.getCustomersByPartner(
      Number(partnerId),
      correlationId,
      pageNumber,
      limitNumber
    );
  }

  /**
   * Add dependants (children and/or spouses) to an existing customer
   * @param customerId - Customer ID
   * @param addRequest - Dependants addition request
   * @param partnerId - Partner ID from API key validation
   * @param correlationId - Correlation ID from request header
   * @returns Dependants addition response
   */
  @Post(':customerId/dependants')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add dependants to customer',
    description: 'Add children and/or spouses to an existing customer in a single transaction. At least one child or spouse must be provided.',
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
    description: 'Customer not found or not accessible to this partner',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or inactive API key',
  })
  async addDependants(
    @Param('customerId') customerId: string,
    @Body() addRequest: AddDependantsRequestDto,
    @PartnerId() partnerId: string,
    @CorrelationId() correlationId: string,
  ): Promise<AddDependantsResponseDto> {
    return this.customerService.addDependants(
      customerId,
      addRequest,
      Number(partnerId),
      correlationId
    );
  }

  /**
   * Get all dependants (children and spouses) for a customer
   * @param customerId - Customer ID
   * @param partnerId - Partner ID from API key validation
   * @param correlationId - Correlation ID from request header
   * @returns Dependants retrieval response
   */
  @Get(':customerId/dependants')
  @ApiOperation({
    summary: 'Get customer dependants',
    description: 'Retrieve all children and spouses for a specific customer. Only returns dependants for customers that belong to the authenticated partner.',
  })
  @ApiParam({
    name: 'customerId',
    description: 'Customer ID',
    example: 'cust_1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Dependants retrieved successfully',
    type: GetDependantsResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Customer not found or not accessible to this partner',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or inactive API key',
  })
  async getDependants(
    @Param('customerId') customerId: string,
    @PartnerId() partnerId: string,
    @CorrelationId() correlationId: string,
  ): Promise<GetDependantsResponseDto> {
    return this.customerService.getDependants(
      customerId,
      Number(partnerId),
      correlationId
    );
  }

  /**
   * Add beneficiaries to an existing customer
   * @param customerId - Customer ID
   * @param addRequest - Beneficiaries addition request
   * @param partnerId - Partner ID from API key validation
   * @param correlationId - Correlation ID from request header
   * @returns Beneficiaries addition response
   */
  @Post(':customerId/beneficiaries')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add beneficiaries to customer',
    description: 'Add one or more beneficiaries to an existing customer in a single transaction. At least one beneficiary must be provided.',
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
    description: 'Unauthorized - invalid or inactive API key',
  })
  async addBeneficiaries(
    @Param('customerId') customerId: string,
    @Body() addRequest: AddBeneficiariesRequestDto,
    @PartnerId() partnerId: string,
    @CorrelationId() correlationId: string,
  ): Promise<AddBeneficiariesResponseDto> {
    return this.customerService.addBeneficiaries(
      customerId,
      addRequest,
      Number(partnerId),
      correlationId
    );
  }

  /**
   * Get all beneficiaries for a customer
   * @param customerId - Customer ID
   * @param partnerId - Partner ID from API key validation
   * @param correlationId - Correlation ID from request header
   * @returns Beneficiaries retrieval response
   */
  @Get(':customerId/beneficiaries')
  @ApiOperation({
    summary: 'Get customer beneficiaries',
    description: 'Retrieve all beneficiaries for a specific customer. Only returns beneficiaries for customers that belong to the authenticated partner.',
  })
  @ApiParam({
    name: 'customerId',
    description: 'Customer ID',
    example: 'cust_1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Beneficiaries retrieved successfully',
    type: GetBeneficiariesResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Customer not found or not accessible to this partner',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or inactive API key',
  })
  async getBeneficiaries(
    @Param('customerId') customerId: string,
    @PartnerId() partnerId: string,
    @CorrelationId() correlationId: string,
  ): Promise<GetBeneficiariesResponseDto> {
    return this.customerService.getBeneficiaries(
      customerId,
      Number(partnerId),
      correlationId
    );
  }
}
