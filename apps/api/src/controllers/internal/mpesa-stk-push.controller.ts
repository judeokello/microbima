import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  Param,
  Query,
  Logger,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MpesaStkPushService } from '../../services/mpesa-stk-push.service';
import { ConfigurationService } from '../../config/configuration.service';
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
 * Dev/staging-only: GET requests/:id, POST jobs/run-expiration, POST jobs/run-missing-ipn-check, GET jobs/debug.
 */
@Controller('internal/mpesa/stk-push')
@ApiTags('M-Pesa STK Push')
@ApiBearerAuth()
export class MpesaStkPushController {
  private readonly logger = new Logger(MpesaStkPushController.name);

  constructor(
    private readonly mpesaStkPushService: MpesaStkPushService,
    private readonly configService: ConfigurationService,
  ) {}

  private isDevOrStaging(): boolean {
    const env = this.configService.environment;
    return env === 'development' || env === 'staging';
  }

  private ensureDevOrStaging(): void {
    if (!this.isDevOrStaging()) {
      throw new NotFoundException('Not available in this environment.');
    }
  }

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
      
      **Example Request Payload:**
      \`\`\`json
      {
        "phoneNumber": "254722000000",
        "amount": 100.00,
        "accountReference": "POL123456",
        "transactionDesc": "Premium payment for policy POL123456"
      }
      \`\`\`
      
      **Example Success Response (201 Created):**
      \`\`\`json
      {
        "id": "12345-67890-12345",
        "checkoutRequestID": "ws_CO_270120251430451234567890",
        "merchantRequestID": "12345-67890-12345",
        "status": "PENDING",
        "phoneNumber": "254722000000",
        "amount": 100.00,
        "accountReference": "POL123456",
        "initiatedAt": "2025-01-27T14:30:45Z"
      }
      \`\`\`
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
  @ApiResponse({
    status: 503,
    description: 'STK push is disabled (runtime configuration)',
    type: StandardErrorResponseDto,
  })
  async initiate(
    @Body() dto: InitiateStkPushDto,
    @Headers('x-correlation-id') correlationIdHeader?: string
  ): Promise<StkPushRequestResponseDto> {
    if (!this.configService.mpesa.stkPushEnabled) {
      throw new ServiceUnavailableException('M-Pesa STK push is currently disabled.');
    }

    // Get correlation ID from header, or generate one
    const correlationId =
      correlationIdHeader ?? `stk-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Get user ID from request (if available from auth middleware)
    const userId = undefined; // TODO: Extract from auth context when available

    return this.mpesaStkPushService.initiateStkPush(dto, correlationId, userId);
  }

  /**
   * Get STK Push request by ID (dev/staging only). Use to verify status after running jobs.
   */
  @Get('requests/:id')
  @ApiOperation({
    summary: 'Get STK Push request by ID (dev/staging only)',
    description: 'Returns request details for verification. Only available when NODE_ENV is development or staging.',
  })
  @ApiResponse({ status: 200, description: 'Request found' })
  @ApiResponse({ status: 404, description: 'Not found or not available in this environment' })
  async getRequestById(@Param('id') id: string) {
    this.ensureDevOrStaging();
    const req = await this.mpesaStkPushService.getStkPushRequestById(id);
    if (!req) throw new NotFoundException('STK Push request not found.');
    return {
      id: req.id,
      status: req.status,
      initiatedAt: req.initiatedAt.toISOString(),
      completedAt: req.completedAt?.toISOString() ?? null,
      accountReference: req.accountReference,
      phoneNumber: req.phoneNumber,
      amount: req.amount,
      linkedTransactionId: req.linkedTransactionId,
      checkoutRequestId: req.checkoutRequestId,
    };
  }

  /**
   * Run expiration job manually (dev/staging only). Marks PENDING requests older than timeout as EXPIRED.
   */
  @Post('jobs/run-expiration')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Run STK Push expiration job (dev/staging only)',
    description: 'Marks PENDING requests older than timeout as EXPIRED. Only available when NODE_ENV is development or staging.',
  })
  @ApiResponse({ status: 200, description: 'Job run result' })
  @ApiResponse({ status: 404, description: 'Not available in this environment' })
  async runExpirationJob(@Headers('x-correlation-id') correlationIdHeader?: string) {
    this.ensureDevOrStaging();
    const correlationId =
      correlationIdHeader ?? `run-expiry-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    return this.mpesaStkPushService.markExpiredStkPushRequests(correlationId);
  }

  /**
   * Run missing IPN check job manually (dev/staging only). Logs COMPLETED requests with no IPN within 24h.
   */
  @Post('jobs/run-missing-ipn-check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Run missing IPN check job (dev/staging only)',
    description: 'Finds COMPLETED requests with no IPN within 24h and logs warning. Only available when NODE_ENV is development or staging.',
  })
  @ApiResponse({ status: 200, description: 'Job run result' })
  @ApiResponse({ status: 404, description: 'Not available in this environment' })
  async runMissingIpnCheckJob(@Headers('x-correlation-id') correlationIdHeader?: string) {
    this.ensureDevOrStaging();
    const correlationId =
      correlationIdHeader ?? `run-missing-ipn-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    return this.mpesaStkPushService.checkMissingIpn(correlationId);
  }

  /**
   * List request IDs for debugging (dev/staging only). type=expired | missing-ipn.
   */
  @Get('jobs/debug')
  @ApiOperation({
    summary: 'List expired or missing-IPN request IDs (dev/staging only)',
    description: 'Returns request IDs for verification. type=expired (recently expired) or type=missing-ipn. Only available when NODE_ENV is development or staging.',
  })
  @ApiResponse({ status: 200, description: 'List of request IDs' })
  @ApiResponse({ status: 404, description: 'Not available in this environment' })
  async getJobsDebug(@Query('type') type: 'expired' | 'missing-ipn') {
    this.ensureDevOrStaging();
    if (type === 'expired') {
      const requestIds = await this.mpesaStkPushService.getExpiredRequestIdsForDebug();
      return { type: 'expired', requestIds };
    }
    if (type === 'missing-ipn') {
      const requestIds = await this.mpesaStkPushService.getMissingIpnRequestIdsForDebug();
      return { type: 'missing-ipn', requestIds };
    }
    throw new NotFoundException('Query param type must be "expired" or "missing-ipn".');
  }
}

