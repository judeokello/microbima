import { Controller, Post, Body, Headers, Logger, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MpesaIpnService } from '../../services/mpesa-ipn.service';
import { MpesaIpnPayloadDto, MpesaIpnResponseDto } from '../../dto/mpesa-ipn/mpesa-ipn.dto';
import { IpWhitelistGuard } from '../../guards/ip-whitelist.guard';

/**
 * M-Pesa IPN Controller
 *
 * **System Endpoint** - This controller handles callbacks from M-Pesa Daraja API.
 * These endpoints are NOT intended for general API consumers. They are called by M-Pesa's infrastructure.
 *
 * Public controller for receiving Instant Payment Notification (IPN) callbacks from M-Pesa Daraja API.
 * This endpoint is publicly accessible (no API key authentication) as required by M-Pesa.
 */
@Controller('public/mpesa')
@ApiTags('M-Pesa IPN (System Endpoints)')
export class MpesaIpnController {
  private readonly logger = new Logger(MpesaIpnController.name);

  constructor(private readonly mpesaIpnService: MpesaIpnService) {}

  /**
   * IPN Confirmation Callback
   *
   * Receives Instant Payment Notification (IPN) callbacks from M-Pesa Daraja API.
   * Processes payment notifications in real-time and creates payment records immediately.
   *
   * Always returns success (ResultCode: 0) to prevent M-Pesa retries.
   * Errors are logged internally for investigation.
   */
  @Post('confirmation')
  @UseGuards(IpWhitelistGuard)
  @ApiOperation({
    summary: 'IPN Confirmation Callback (System Endpoint)',
    description: `
      **⚠️ System Endpoint - Called by M-Pesa Infrastructure**
      
      This endpoint receives Instant Payment Notification (IPN) callbacks from M-Pesa Daraja API.
      It processes payment notifications in real-time and creates payment records immediately.
      
      **Important Notes:**
      - This endpoint is NOT for general API consumption
      - It is called automatically by M-Pesa's infrastructure when payments are made
      - Always returns success (ResultCode: 0) to prevent M-Pesa retries, even if processing fails
      - Errors are logged internally for investigation
      
      **Security:**
      - This endpoint is publicly accessible (no API key authentication) as required by M-Pesa
      - Security is implemented via IP whitelist validation (only Safaricom IPs allowed in production)
      
      **Example Request Payload:**
      \`\`\`json
      {
        "TransactionType": "Pay Bill",
        "TransID": "RKTQDM7W6S",
        "TransTime": "20250127143045",
        "TransAmount": "100.00",
        "BusinessShortCode": "174379",
        "BillRefNumber": "POL123456",
        "MSISDN": "254722000000",
        "FirstName": "John",
        "MiddleName": "M",
        "LastName": "Doe",
        "OrgAccountBalance": "50000.00"
      }
      \`\`\`
      
      **Example Response:**
      \`\`\`json
      {
        "ResultCode": 0,
        "ResultDesc": "Accepted"
      }
      \`\`\`
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Success response (always returns ResultCode: 0 to prevent M-Pesa retries)',
    type: MpesaIpnResponseDto,
    schema: {
      example: {
        ResultCode: 0,
        ResultDesc: 'Accepted',
      },
    },
  })
  async processIpn(
    @Body() payload: MpesaIpnPayloadDto,
    @Headers('x-correlation-id') correlationIdHeader?: string
  ): Promise<MpesaIpnResponseDto> {
    // Get correlation ID from M-Pesa headers, or generate one
    const correlationId =
      correlationIdHeader ?? `ipn-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    this.logger.log(
      JSON.stringify({
        event: 'IPN_CALLBACK_RECEIVED',
        correlationId,
        transactionId: payload.TransID,
        timestamp: new Date().toISOString(),
      })
    );

    return this.mpesaIpnService.processIpnNotification(payload, correlationId);
  }
}

