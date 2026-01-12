import { Controller, Post, Body, Headers, Logger, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { MpesaStkPushService } from '../../services/mpesa-stk-push.service';
import {
  StkPushCallbackDto,
  MpesaCallbackResponseDto,
} from '../../dto/mpesa-stk-push/mpesa-stk-push.dto';
import { IpWhitelistGuard } from '../../guards/ip-whitelist.guard';

/**
 * M-Pesa STK Push Public Controller
 *
 * **System Endpoint** - This controller handles callbacks from M-Pesa Daraja API.
 * These endpoints are NOT intended for general API consumers. They are called by M-Pesa's infrastructure.
 *
 * Public controller for receiving STK Push callback notifications from M-Pesa Daraja API.
 * This endpoint is publicly accessible (no API key authentication) as required by M-Pesa.
 */
@Controller('public/mpesa/stk-push')
@ApiTags('M-Pesa STK Push (System Endpoints)')
export class MpesaStkPushPublicController {
  private readonly logger = new Logger(MpesaStkPushPublicController.name);

  constructor(private readonly mpesaStkPushService: MpesaStkPushService) {}

  /**
   * STK Push Callback
   *
   * Receives STK Push callback notifications from M-Pesa Daraja API.
   * Updates STK Push request status based on customer action.
   *
   * Always returns success (ResultCode: 0) to prevent M-Pesa retries.
   * Errors are logged internally for investigation.
   */
  @Post('callback')
  @UseGuards(IpWhitelistGuard)
  @ApiOperation({
    summary: 'STK Push Callback (System Endpoint)',
    description: `
      **⚠️ System Endpoint - Called by M-Pesa Infrastructure**
      
      This endpoint receives STK Push callback notifications from M-Pesa Daraja API.
      It updates STK Push request status based on customer action (completed, cancelled, timeout, etc.).
      
      **Important Notes:**
      - This endpoint is NOT for general API consumption
      - It is called automatically by M-Pesa's infrastructure when customers interact with STK Push prompts
      - Always returns success (ResultCode: 0) to prevent M-Pesa retries, even if processing fails
      - Errors are logged internally for investigation
      
      **Security:**
      - This endpoint is publicly accessible (no API key authentication) as required by M-Pesa
      - Security is implemented via IP whitelist validation (only Safaricom IPs allowed in production)
      
      **Example Request Payload:**
      \`\`\`json
      {
        "Body": {
          "stkCallback": {
            "MerchantRequestID": "12345-67890-12345",
            "CheckoutRequestID": "ws_CO_270120251430451234567890",
            "ResultCode": 0,
            "ResultDesc": "The service request is processed successfully.",
            "CallbackMetadata": {
              "Item": [
                {
                  "Name": "Amount",
                  "Value": 100.00
                },
                {
                  "Name": "MpesaReceiptNumber",
                  "Value": "RKTQDM7W6S"
                },
                {
                  "Name": "TransactionDate",
                  "Value": 20250127143045
                },
                {
                  "Name": "PhoneNumber",
                  "Value": 254722000000
                }
              ]
            }
          }
        }
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
    type: MpesaCallbackResponseDto,
    schema: {
      example: {
        ResultCode: 0,
        ResultDesc: 'Accepted',
      },
    },
  })
  async callback(
    @Req() request: Request,
    @Body() payload: StkPushCallbackDto,
    @Headers('x-correlation-id') correlationIdHeader?: string
  ): Promise<MpesaCallbackResponseDto> {
    // Get correlation ID from M-Pesa headers, or generate one
    const correlationId =
      correlationIdHeader ?? `stk-callback-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Log raw request body for debugging validation issues
    this.logger.debug(
      JSON.stringify({
        event: 'STK_PUSH_CALLBACK_RAW_BODY',
        correlationId,
        rawBody: request.body,
        timestamp: new Date().toISOString(),
      })
    );

    this.logger.log(
      JSON.stringify({
        event: 'STK_PUSH_CALLBACK_RECEIVED',
        correlationId,
        checkoutRequestId: payload.Body.stkCallback.CheckoutRequestID,
        timestamp: new Date().toISOString(),
      })
    );

    return this.mpesaStkPushService.handleStkPushCallback(payload, correlationId);
  }
}

