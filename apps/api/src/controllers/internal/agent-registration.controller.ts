import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AgentRegistrationService } from '../../services/agent-registration.service';
import { MissingRequirementService } from '../../services/missing-requirement.service';
import {
  CreateAgentRegistrationDto,
  UpdateAgentRegistrationDto,
  AgentRegistrationResponseDto,
} from '../../dto/agent-registration';
import {
  CreateMissingRequirementDto,
  UpdateMissingRequirementDto,
  MissingRequirementResponseDto,
} from '../../dto/missing-requirement';
import { CorrelationId } from '../../decorators/correlation-id.decorator';
import { BAAuth, AdminOnly, BAOnly, AdminOrBA } from '../../decorators/ba-auth.decorator';
import { DataMaskingInterceptor } from '../../interceptors/data-masking.interceptor';
import { EnableDataMasking } from '../../decorators/data-masking.decorator';

/**
 * Internal Agent Registration Controller
 *
 * Handles HTTP requests for agent registration operations.
 * Provides CRUD operations for agent registrations and missing requirements.
 *
 * Features:
 * - Agent registration management
 * - Missing requirements tracking
 * - BA authorization and data masking
 * - Swagger API documentation
 * - Correlation ID tracking
 */
@ApiTags('Internal - Agent Registration')
@ApiBearerAuth()
@Controller('internal/agent-registrations')
@UseInterceptors(DataMaskingInterceptor)
export class AgentRegistrationController {
  constructor(
    private readonly agentRegistrationService: AgentRegistrationService,
    private readonly missingRequirementService: MissingRequirementService,
  ) {}

  /**
   * Create a new agent registration
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @BAAuth({ allowBA: true })
  @EnableDataMasking()
  @ApiOperation({
    summary: 'Create agent registration',
    description: 'Create a new agent registration for a customer by a brand ambassador.',
  })
  @ApiResponse({
    status: 201,
    description: 'Agent registration created successfully',
    type: AgentRegistrationResponseDto,
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
  async createRegistration(
    @Body() dto: CreateAgentRegistrationDto,
    @CorrelationId() correlationId: string,
  ): Promise<AgentRegistrationResponseDto> {
    // TODO: Extract user ID from JWT token
    const userId = 'system'; // Placeholder until auth is implemented
    
    return this.agentRegistrationService.createRegistration(dto, userId);
  }

  /**
   * Get agent registration by ID
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @AdminOrBA()
  @EnableDataMasking()
  @ApiOperation({
    summary: 'Get agent registration by ID',
    description: 'Retrieve a specific agent registration by its ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'Agent registration ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Agent registration retrieved successfully',
    type: AgentRegistrationResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Registration not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid authentication',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getRegistration(
    @Param('id') id: string,
    @CorrelationId() correlationId: string,
  ): Promise<AgentRegistrationResponseDto> {
    // TODO: Extract user ID and role from JWT token
    const userId = 'system'; // Placeholder until auth is implemented
    const isAdmin = false; // TODO: Check user role
    
    return this.agentRegistrationService.getRegistrationById(id, userId, isAdmin);
  }

  /**
   * Update agent registration
   */
  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @AdminOrBA()
  @EnableDataMasking()
  @ApiOperation({
    summary: 'Update agent registration',
    description: 'Update an existing agent registration.',
  })
  @ApiParam({
    name: 'id',
    description: 'Agent registration ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Agent registration updated successfully',
    type: AgentRegistrationResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Registration not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid authentication',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async updateRegistration(
    @Param('id') id: string,
    @Body() dto: UpdateAgentRegistrationDto,
    @CorrelationId() correlationId: string,
  ): Promise<AgentRegistrationResponseDto> {
    // TODO: Extract user ID from JWT token
    const userId = 'system'; // Placeholder until auth is implemented
    
    return this.agentRegistrationService.updateRegistration(id, dto, userId);
  }

  /**
   * Get registrations by Brand Ambassador ID
   */
  @Get('ba/:baId')
  @HttpCode(HttpStatus.OK)
  @AdminOrBA()
  @EnableDataMasking()
  @ApiOperation({
    summary: 'Get registrations by Brand Ambassador',
    description: 'Retrieve all registrations for a specific brand ambassador.',
  })
  @ApiParam({
    name: 'baId',
    description: 'Brand Ambassador ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of records to return',
    required: false,
    example: 50,
  })
  @ApiQuery({
    name: 'offset',
    description: 'Number of records to skip',
    required: false,
    example: 0,
  })
  @ApiResponse({
    status: 200,
    description: 'Registrations retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        registrations: {
          type: 'array',
          items: { $ref: '#/components/schemas/AgentRegistrationResponseDto' },
        },
        total: { type: 'number' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid authentication',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getRegistrationsByBA(
    @Param('baId') baId: string,
    @CorrelationId() correlationId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ registrations: AgentRegistrationResponseDto[]; total: number }> {
    // TODO: Extract user ID and role from JWT token
    const userId = 'system'; // Placeholder until auth is implemented
    const isAdmin = false; // TODO: Check user role
    
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    
    return this.agentRegistrationService.getRegistrationsByBA(baId, userId, isAdmin, limitNum, offsetNum);
  }

  /**
   * Create missing requirement
   */
  @Post('missing-requirements')
  @HttpCode(HttpStatus.CREATED)
  @AdminOnly()
  @ApiOperation({
    summary: 'Create missing requirement',
    description: 'Create a new missing requirement for a registration.',
  })
  @ApiResponse({
    status: 201,
    description: 'Missing requirement created successfully',
    type: MissingRequirementResponseDto,
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
  async createMissingRequirement(
    @Body() dto: CreateMissingRequirementDto,
    @CorrelationId() correlationId: string,
  ): Promise<MissingRequirementResponseDto> {
    // TODO: Extract user ID from JWT token
    const userId = 'system'; // Placeholder until auth is implemented
    
    return this.missingRequirementService.createMissingRequirement(dto, userId);
  }

  /**
   * Get missing requirement by ID
   */
  @Get('missing-requirements/:id')
  @HttpCode(HttpStatus.OK)
  @AdminOnly()
  @ApiOperation({
    summary: 'Get missing requirement by ID',
    description: 'Retrieve a specific missing requirement by its ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'Missing requirement ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Missing requirement retrieved successfully',
    type: MissingRequirementResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Missing requirement not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid authentication',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getMissingRequirement(
    @Param('id') id: string,
    @CorrelationId() correlationId: string,
  ): Promise<MissingRequirementResponseDto> {
    // TODO: Extract user ID from JWT token
    const userId = 'system'; // Placeholder until auth is implemented
    
    return this.missingRequirementService.getMissingRequirementById(id, userId);
  }

  /**
   * Update missing requirement
   */
  @Put('missing-requirements/:id')
  @HttpCode(HttpStatus.OK)
  @AdminOnly()
  @ApiOperation({
    summary: 'Update missing requirement',
    description: 'Update an existing missing requirement.',
  })
  @ApiParam({
    name: 'id',
    description: 'Missing requirement ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Missing requirement updated successfully',
    type: MissingRequirementResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Missing requirement not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid authentication',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async updateMissingRequirement(
    @Param('id') id: string,
    @Body() dto: UpdateMissingRequirementDto,
    @CorrelationId() correlationId: string,
  ): Promise<MissingRequirementResponseDto> {
    // TODO: Extract user ID from JWT token
    const userId = 'system'; // Placeholder until auth is implemented
    
    return this.missingRequirementService.updateMissingRequirement(id, dto, userId);
  }

  /**
   * Get missing requirements by registration ID
   */
  @Get(':registrationId/missing-requirements')
  @HttpCode(HttpStatus.OK)
  @AdminOrBA()
  @EnableDataMasking()
  @ApiOperation({
    summary: 'Get missing requirements by registration',
    description: 'Retrieve all missing requirements for a specific registration.',
  })
  @ApiParam({
    name: 'registrationId',
    description: 'Registration ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of records to return',
    required: false,
    example: 50,
  })
  @ApiQuery({
    name: 'offset',
    description: 'Number of records to skip',
    required: false,
    example: 0,
  })
  @ApiResponse({
    status: 200,
    description: 'Missing requirements retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        missingRequirements: {
          type: 'array',
          items: { $ref: '#/components/schemas/MissingRequirementResponseDto' },
        },
        total: { type: 'number' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid authentication',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getMissingRequirementsByRegistration(
    @Param('registrationId') registrationId: string,
    @CorrelationId() correlationId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ missingRequirements: MissingRequirementResponseDto[]; total: number }> {
    // TODO: Extract user ID from JWT token
    const userId = 'system'; // Placeholder until auth is implemented
    
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    
    return this.missingRequirementService.getMissingRequirementsByRegistration(
      registrationId,
      userId,
      limitNum,
      offsetNum,
    );
  }

  /**
   * Get pending missing requirements for admin resolution
   */
  @Get('missing-requirements/pending')
  @HttpCode(HttpStatus.OK)
  @AdminOnly()
  @ApiOperation({
    summary: 'Get pending missing requirements',
    description: 'Retrieve all pending missing requirements for admin resolution.',
  })
  @ApiQuery({
    name: 'partnerId',
    description: 'Filter by partner ID',
    required: false,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of records to return',
    required: false,
    example: 50,
  })
  @ApiQuery({
    name: 'offset',
    description: 'Number of records to skip',
    required: false,
    example: 0,
  })
  @ApiResponse({
    status: 200,
    description: 'Pending missing requirements retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        missingRequirements: {
          type: 'array',
          items: { $ref: '#/components/schemas/MissingRequirementResponseDto' },
        },
        total: { type: 'number' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid authentication',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getPendingMissingRequirements(
    @CorrelationId() correlationId: string,
    @Query('partnerId') partnerId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ missingRequirements: MissingRequirementResponseDto[]; total: number }> {
    // TODO: Extract user ID from JWT token
    const userId = 'system'; // Placeholder until auth is implemented
    
    const partnerIdNum = partnerId ? parseInt(partnerId, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    
    return this.missingRequirementService.getPendingMissingRequirements(
      userId,
      partnerIdNum,
      limitNum,
      offsetNum,
    );
  }
}
