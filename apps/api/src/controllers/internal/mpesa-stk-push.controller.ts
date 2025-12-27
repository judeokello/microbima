import { Controller, Post, Body, Headers, Logger, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MpesaStkPushService } from '../../services/mpesa-stk-push.service';
import {
  InitiateStkPushDto,
  StkPushRequestResponseDto,
} from '../../dto/mpesa-stk-push/mpesa-stk-push.dto';
import { StandardErrorResponseDto } from '../../dto/common/standard-error-response.dto';

/**
 * M-Pesa STK Push Internal Controller
 *
 * Internal controller for agent-initiated STK Push payment requests.
 * Requires Supabase Bearer token authentication (agents are logged in).
 */
@Controller('internal/mpesa/stk-push')
@ApiTags('M-Pesa STK Push')
@ApiBearerAuth()
export class MpesaStkPushController {
  private readonly logger = new Logger(MpesaStkPushController.name);

  constructor(private readonly mpesaStkPushService: MpesaStkPushService) {}

  /**
   * Initiate STK Push Request
   *
   * Creates a payment prompt on the customer's phone and tracks the request status.
   */
  @Post('initiate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Initiate STK Push Request',
    description: `
      Internal endpoint for agents to initiate STK Push payment requests.
      Creates a payment prompt on the customer's phone and tracks the request status.
      
      **Authentication**: Requires Supabase Bearer token authentication (agents must be logged in).
    `,
  })
  @ApiResponse({
    status: 201,
    description: 'STK Push request created successfully',
    type: StkPushRequestResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request (malformed request payload)',
    type: StandardErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized (missing or invalid Bearer token)',
    type: StandardErrorResponseDto,
  })
  @ApiResponse({
    status: 422,
    description: 'Validation error (invalid phone number, amount out of range, account reference not found, etc.)',
    type: StandardErrorResponseDto,
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests (rate limit exceeded - M-Pesa API rate limiting)',
    type: StandardErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    type: StandardErrorResponseDto,
  })
  async initiate(
    @Body() dto: InitiateStkPushDto,
    @Headers('x-correlation-id') correlationIdHeader?: string
  ): Promise<StkPushRequestResponseDto> {
    // Get correlation ID from header, or generate one
    const correlationId =
      correlationIdHeader ?? `stk-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Get user ID from request (if available from auth middleware)
    const userId = undefined; // TODO: Extract from auth context when available

    return this.mpesaStkPushService.initiateStkPush(dto, correlationId, userId);
  }

  /**
   * Test STK Push Endpoint
   *
   * Simple test endpoint for quick STK Push testing during development.
   * This allows testing STK Push integration independently before integrating into register/payment page flow.
   *
   * **Note**: This endpoint is for development/testing purposes. Consider removing in production or gating behind feature flag.
   */
  @Post('test')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Test STK Push Request',
    description: `
      Test endpoint for quick STK Push testing during development.
      Accepts minimal payload and initiates STK Push request.
      
      **Note**: This is for development/testing only.
    `,
  })
  @ApiResponse({
    status: 201,
    description: 'STK Push request created successfully',
    type: StkPushRequestResponseDto,
  })
  async test(
    @Body() dto: InitiateStkPushDto,
    @Headers('x-correlation-id') correlationIdHeader?: string
  ): Promise<StkPushRequestResponseDto> {
    const correlationId =
      correlationIdHeader ?? `stk-test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    return this.mpesaStkPushService.initiateStkPush(dto, correlationId);
  }
}

