import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

@ApiTags('Webhooks - Messaging')
@Controller('webhooks/messaging/sendgrid')
export class SendGridWebhookController {
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'SendGrid event webhook (public)' })
  @ApiResponse({ status: 200, description: 'Webhook received' })
  async handle(@Body() _body: unknown, @Req() _req: Request) {
    // Implemented in T035–T038 (store raw payload, dedupe, rate limiting, caps).
    return { status: HttpStatus.OK };
  }
}

