import { 
  Controller, 
  Post, 
  Delete, 
  Body, 
  HttpCode, 
  HttpStatus, 
  UsePipes, 
  ValidationPipe, 
  Logger 
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse 
} from '@nestjs/swagger';
import { PartnerManagementService } from '../../services/partner-management.service';
import { PartnerApiKeyMapper } from '../../mappers/partner-api-key.mapper';
import { ApiKey, PartnerId } from '../../decorators/api-key.decorator';
import { CorrelationId } from '../../decorators/correlation-id.decorator';
import {
  GenerateApiKeyRequestDto,
  GenerateApiKeyResponseDto,
  ValidateApiKeyRequestDto,
  ValidateApiKeyResponseDto,
  DeactivateApiKeyRequestDto,
  DeactivateApiKeyResponseDto,
} from '../../dto/partner-management';

/**
 * Public Partner Management Controller
 * 
 * Provides public API endpoints for partner management operations.
 * These endpoints require API key authentication and are used by partners to manage their API keys.
 * 
 * Endpoints:
 * - POST /v1/partner-management/api-keys - Generate new API key for authenticated partner
 * - POST /v1/partner-management/api-keys/validate - Validate API key
 * - DELETE /v1/partner-management/api-keys - Deactivate API key
 */
@ApiTags('Partner Management')
@Controller('v1/partner-management')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class PublicPartnerManagementController {
  private readonly logger = new Logger(PublicPartnerManagementController.name);

  constructor(
    private readonly partnerManagementService: PartnerManagementService
  ) {}

  /**
   * Generate a new API key for the authenticated partner
   * POST /v1/partner-management/api-keys
   */
  @Post('api-keys')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Generate API key for authenticated partner',
    description: 'Generates a new API key for the partner making the request. Requires valid API key authentication.'
  })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'API key generated successfully', 
    type: GenerateApiKeyResponseDto 
  })
  @ApiResponse({ 
    status: HttpStatus.UNAUTHORIZED, 
    description: 'Invalid or missing API key' 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Invalid partner or partner inactive' 
  })
  @ApiResponse({ 
    status: HttpStatus.INTERNAL_SERVER_ERROR, 
    description: 'Internal server error' 
  })
  async generateApiKey(
    @Body() generateRequest: GenerateApiKeyRequestDto,
    @ApiKey() apiKey: string,
    @PartnerId() partnerId: string,
    @CorrelationId() correlationId: string,
  ): Promise<GenerateApiKeyResponseDto> {
    this.logger.log(`[${correlationId}] Received request to generate API key for partner: ${partnerId}`);

    try {
      // Validate that the request is for the authenticated partner
      if (generateRequest.partnerId !== partnerId) {
        throw new Error('Partner ID in request does not match authenticated partner');
      }

      // Generate API key using the service
      const apiKeyData = await this.partnerManagementService.generateApiKey(
        partnerId,
        correlationId
      );

      // Convert to response DTO
      const response = PartnerApiKeyMapper.toApiKeyResponseDto(apiKeyData, correlationId);

      this.logger.log(`[${correlationId}] API key generated successfully for partner: ${partnerId}`);

      return response;
    } catch (error) {
      this.logger.error(`[${correlationId}] Error generating API key: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Validate an API key
   * POST /v1/partner-management/api-keys/validate
   */
  @Post('api-keys/validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Validate API key',
    description: 'Validates an API key and returns partner information if valid. Does not require API key authentication.'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'API key validation result', 
    type: ValidateApiKeyResponseDto 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Invalid API key format' 
  })
  @ApiResponse({ 
    status: HttpStatus.INTERNAL_SERVER_ERROR, 
    description: 'Internal server error' 
  })
  async validateApiKey(
    @Body() validateRequest: ValidateApiKeyRequestDto,
    @CorrelationId() correlationId: string,
  ): Promise<ValidateApiKeyResponseDto> {
    this.logger.log(`[${correlationId}] Received request to validate API key`);

    try {
      // Validate API key using the service
      const validationResult = await this.partnerManagementService.validateApiKey(
        validateRequest.apiKey,
        correlationId
      );

      // Convert to response DTO
      const response = PartnerApiKeyMapper.toApiKeyValidationResponseDto(validationResult, correlationId);

      this.logger.log(`[${correlationId}] API key validation completed: ${validationResult.valid ? 'valid' : 'invalid'}`);

      return response;
    } catch (error) {
      this.logger.error(`[${correlationId}] Error validating API key: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Deactivate an API key
   * DELETE /v1/partner-management/api-keys
   */
  @Delete('api-keys')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Deactivate API key',
    description: 'Deactivates an API key. Requires valid API key authentication.'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'API key deactivated successfully', 
    type: DeactivateApiKeyResponseDto 
  })
  @ApiResponse({ 
    status: HttpStatus.UNAUTHORIZED, 
    description: 'Invalid or missing API key' 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Invalid API key format' 
  })
  @ApiResponse({ 
    status: HttpStatus.INTERNAL_SERVER_ERROR, 
    description: 'Internal server error' 
  })
  async deactivateApiKey(
    @Body() deactivateRequest: DeactivateApiKeyRequestDto,
    @ApiKey() apiKey: string,
    @PartnerId() partnerId: string,
    @CorrelationId() correlationId: string,
  ): Promise<DeactivateApiKeyResponseDto> {
    this.logger.log(`[${correlationId}] Received request to deactivate API key for partner: ${partnerId}`);

    try {
      // Deactivate API key using the service
      const success = await this.partnerManagementService.deactivateApiKey(
        deactivateRequest.apiKey,
        correlationId
      );

      // Create response DTO
      const response: DeactivateApiKeyResponseDto = {
        status: 200,
        correlationId: correlationId,
        message: success ? 'API key deactivated successfully' : 'API key not found or already inactive',
        data: {
          success: success,
        },
      };

      this.logger.log(`[${correlationId}] API key deactivation ${success ? 'successful' : 'failed'} for partner: ${partnerId}`);

      return response;
    } catch (error) {
      this.logger.error(`[${correlationId}] Error deactivating API key: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }
}
