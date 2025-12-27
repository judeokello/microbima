import { Controller, Post, Body, Headers, Logger, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MpesaIpnService } from '../../services/mpesa-ipn.service';
import { MpesaIpnPayloadDto, MpesaIpnResponseDto } from '../../dto/mpesa-ipn/mpesa-ipn.dto';
import { IpWhitelistGuard } from '../../guards/ip-whitelist.guard';

/**
 * M-Pesa IPN Controller
 *
 * Public controller for receiving Instant Payment Notification (IPN) callbacks from M-Pesa Daraja API.
 * This endpoint is publicly accessible (no API key authentication) as required by M-Pesa.
 */
@Controller('public/mpesa')
@ApiTags('M-Pesa IPN')
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
    summary: 'IPN Confirmation Callback',
    description: `
      Public endpoint that receives Instant Payment Notification (IPN) callbacks from M-Pesa Daraja API.
      This endpoint processes payment notifications in real-time and creates payment records immediately.
      
      **Security**: This endpoint is publicly accessible (no API key authentication) as required by M-Pesa.
      Security is implemented via IP whitelist validation.
      
      **Response**: Always returns success (ResultCode: 0) to prevent M-Pesa retries, even if processing fails.
      Errors are logged internally for investigation.
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Success response (always returns success to prevent M-Pesa retries)',
    type: MpesaIpnResponseDto,
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

