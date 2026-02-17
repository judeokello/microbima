import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

@ApiTags('Webhooks - Messaging')
@Controller('webhooks/messaging/africas-talking')
export class AfricasTalkingWebhookController {
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Africa\'s Talking SMS webhook (public)' })
  @ApiResponse({ status: 200, description: 'Webhook received' })
  async handle(@Body() _body: unknown, @Req() _req: Request) {
    // Implemented in T036–T038 (store raw payload, dedupe, rate limiting).
    return { status: HttpStatus.OK };
  }
}

