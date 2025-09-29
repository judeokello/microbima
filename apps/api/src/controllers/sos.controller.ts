import {
  Controller,
  Get,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
} from '@nestjs/swagger';
import { SosService } from '../services/sos.service';
import { SosResponseDto } from '../dto/sos/sos-response.dto';
import { CorrelationId } from '../decorators/correlation-id.decorator';

/**
 * SOS Controller
 *
 * Handles HTTP requests for emergency contact information.
 * Provides access to ambulance and rescue service contacts for insurance customers.
 *
 * Features:
 * - Emergency contact retrieval
 * - API key authentication
 * - Swagger API documentation
 * - Correlation ID tracking
 * - Cached response for performance
 */
@ApiTags('Emergency Services')
@ApiSecurity('api-key')
@Controller('v1/sos')
export class SosController {
  constructor(private readonly sosService: SosService) {}

  /**
   * Get emergency contacts
   * @param correlationId - Correlation ID from request header
   * @returns Emergency contacts response
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get SOS emergency contacts',
    description: 'Retrieve emergency contacts for ambulance and rescue services. Returns cached static data for optimal performance.',
  })
  @ApiResponse({
    status: 200,
    description: 'SOS contacts retrieved successfully',
    type: SosResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or inactive API key',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getEmergencyContacts(
    @CorrelationId() correlationId: string,
  ): Promise<SosResponseDto> {
    return this.sosService.getEmergencyContacts(correlationId);
  }
}
