import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Param, 
  Query, 
  HttpCode, 
  HttpStatus, 
  UsePipes, 
  ValidationPipe, 
  Logger 
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiParam, 
  ApiQuery 
} from '@nestjs/swagger';
import { PartnerManagementService } from '../../services/partner-management.service';
import { PartnerMapper } from '../../mappers/partner.mapper';
import { PartnerApiKeyMapper } from '../../mappers/partner-api-key.mapper';
import { CorrelationId } from '../../decorators/correlation-id.decorator';
import {
  CreatePartnerRequestDto,
  CreatePartnerResponseDto,
  GenerateApiKeyRequestDto,
  GenerateApiKeyResponseDto,
  PartnerListResponseDto,
} from '../../dto/partner-management';

/**
 * Internal Partner Management Controller
 * 
 * Provides internal API endpoints for partner management operations.
 * These endpoints are used by internal admin operations and do not require API key authentication.
 * 
 * Endpoints:
 * - POST /internal/partner-management/partners - Create new partner
 * - GET /internal/partner-management/partners - List all partners (paginated)
 * - GET /internal/partner-management/partners/:id - Get partner by ID
 * - POST /internal/partner-management/api-keys - Generate API key for partner
 */
@ApiTags('Internal - Partner Management')
@Controller('internal/partner-management')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class InternalPartnerManagementController {
  private readonly logger = new Logger(InternalPartnerManagementController.name);

  constructor(
    private readonly partnerManagementService: PartnerManagementService
  ) {}

  /**
   * Create a new partner (idempotent operation)
   * POST /internal/partner-management/partners
   */
  @Post('partners')
  @ApiOperation({ 
    summary: 'Create a new partner (Internal API)',
    description: 'Creates a new partner in the system. If a partner with the same name already exists, returns the existing partner with status 200. This endpoint is for internal admin use only.'
  })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Partner created successfully', 
    type: CreatePartnerResponseDto 
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Partner already exists', 
    type: CreatePartnerResponseDto 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Invalid input data' 
  })
  @ApiResponse({ 
    status: HttpStatus.INTERNAL_SERVER_ERROR, 
    description: 'Internal server error' 
  })
  async createPartner(
    @Body() createRequest: CreatePartnerRequestDto,
  ): Promise<CreatePartnerResponseDto> {
    this.logger.log(`[internal] Received request to create partner: ${createRequest.partnerName}`);

    try {
      // Create partner using the service (service handles idempotency)
      const result = await this.partnerManagementService.createPartner(
        {
          partnerName: createRequest.partnerName,
          website: createRequest.website,
          officeLocation: createRequest.officeLocation,
        },
        'internal'
      );

      // Convert to response DTO with appropriate status based on whether it was created - no correlation ID for internal API
      const response = PartnerMapper.toPartnerResponseDto(result.partner, '', result.wasCreated);
      // Set correlation ID to undefined for internal API
      response.correlationId = undefined;

      this.logger.log(`[internal] Partner ${result.wasCreated ? 'created' : 'retrieved'} successfully: ${result.partner.id}`);

      return response;
    } catch (error) {
      this.logger.error(`[internal] Error creating partner: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Get all partners (paginated)
   * GET /internal/partner-management/partners
   */
  @Get('partners')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Get all partners (Internal API)',
    description: 'Retrieves a paginated list of all partners in the system. This endpoint is for internal admin use only.'
  })
  @ApiQuery({ 
    name: 'page', 
    required: false, 
    type: Number, 
    description: 'Page number (default: 1)',
    example: 1
  })
  @ApiQuery({ 
    name: 'limit', 
    required: false, 
    type: Number, 
    description: 'Items per page (default: 10, max: 100)',
    example: 10
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Partners retrieved successfully', 
    type: PartnerListResponseDto 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Invalid pagination parameters' 
  })
  @ApiResponse({ 
    status: HttpStatus.INTERNAL_SERVER_ERROR, 
    description: 'Internal server error' 
  })
  async getPartners(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<PartnerListResponseDto> {
    this.logger.log(`[internal] Received request to get partners, page: ${page}, limit: ${limit}`);

    try {
      // Get partners using the service
      const result = await this.partnerManagementService.getPartners(
        'internal',
        page || 1,
        limit || 10
      );

      // Convert to response DTO (no correlation ID for internal API)
      const response: PartnerListResponseDto = {
        status: 200,
        message: 'Partners retrieved successfully',
        correlationId: undefined, // No correlation ID for internal API
        data: {
          partners: result.partners.map(partner => PartnerMapper.toPartnerListItemDto(partner)),
          pagination: result.pagination,
        },
      };

      this.logger.log(`[internal] Retrieved ${result.partners.length} partners`);

      return response;
    } catch (error) {
      this.logger.error(`[internal] Error getting partners: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Get partner by ID
   * GET /internal/partner-management/partners/:id
   */
  @Get('partners/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Get partner by ID (Internal API)',
    description: 'Retrieves a specific partner by their ID. This endpoint is for internal admin use only.'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'Partner ID',
    example: 'partner_123456789'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Partner retrieved successfully', 
    type: CreatePartnerResponseDto 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Partner not found' 
  })
  @ApiResponse({ 
    status: HttpStatus.INTERNAL_SERVER_ERROR, 
    description: 'Internal server error' 
  })
  async getPartnerById(
    @Param('id') partnerId: string,
  ): Promise<CreatePartnerResponseDto> {
    this.logger.log(`[internal] Received request to get partner: ${partnerId}`);

    try {
      // Get partner using the service
      const partner = await this.partnerManagementService.getPartnerById(
        Number(partnerId),
        'internal'
      );

      // Convert to response DTO (GET operation should return status 200) - no correlation ID for internal API
      const response = PartnerMapper.toPartnerResponseDto(partner, '', false);
      // Set correlation ID to undefined for internal API
      response.correlationId = undefined;

      this.logger.log(`[internal] Partner retrieved successfully: ${partnerId}`);

      return response;
    } catch (error) {
      this.logger.error(`[internal] Error getting partner: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Generate API key for a partner
   * POST /internal/partner-management/api-keys
   */
  @Post('api-keys')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Generate API key for partner (Internal API)',
    description: 'Generates a new API key for the specified partner. This endpoint is for internal admin use only.'
  })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'API key generated successfully', 
    type: GenerateApiKeyResponseDto 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Invalid partner ID or partner not found' 
  })
  @ApiResponse({ 
    status: HttpStatus.INTERNAL_SERVER_ERROR, 
    description: 'Internal server error' 
  })
  async generateApiKey(
    @Body() generateRequest: GenerateApiKeyRequestDto,
  ): Promise<GenerateApiKeyResponseDto> {
    this.logger.log(`[internal] Received request to generate API key for partner: ${generateRequest.partnerId}`);

    try {
      // Generate API key using the service
      const apiKeyData = await this.partnerManagementService.generateApiKey(
        Number(generateRequest.partnerId),
        'internal'
      );

      // Convert to response DTO - no correlation ID for internal API
      const response = PartnerApiKeyMapper.toApiKeyResponseDto(apiKeyData, '');
      // Set correlation ID to undefined for internal API
      response.correlationId = undefined;

      this.logger.log(`[internal] API key generated successfully for partner: ${generateRequest.partnerId}`);

      return response;
    } catch (error) {
      this.logger.error(`[internal] Error generating API key: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }
}
