import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AfricasTalkingWebhookService } from '../../../modules/messaging/africas-talking-webhook.service';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';

/**
 * T036: Store raw payload, link to delivery when possible, always return 200.
 * T037: Rate limit 60 requests per minute per IP.
 * T038: Idempotent (dedupe by providerEventId); do not regress terminal outcomes.
 */
@ApiTags('Webhooks - Messaging')
@Controller('webhooks/messaging/africas-talking')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 60, ttl: 60000 } }) // 60 req/min per IP (T037)
export class AfricasTalkingWebhookController {
  constructor(private readonly webhookService: AfricasTalkingWebhookService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Africa\'s Talking SMS webhook (public)' })
  @ApiResponse({ status: 200, description: 'Webhook received' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async handle(@Body() body: unknown, @Req() req: Request) {
    const payload = body ?? (req as Request & { body?: unknown }).body;
    await this.webhookService.handlePayload(payload);
    return { status: HttpStatus.OK };
  }
}

