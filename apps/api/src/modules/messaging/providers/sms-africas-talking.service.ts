import { Injectable, Logger } from '@nestjs/common';
import { ConfigurationService } from '../../../config/configuration.service';
import axios from 'axios';

@Injectable()
export class AfricasTalkingSmsService {
  private readonly logger = new Logger(AfricasTalkingSmsService.name);
  private readonly apiUrl = 'https://api.africastalking.com/version1/messaging';

  constructor(private readonly config: ConfigurationService) {}

  /**
   * T031: Send SMS via Africa's Talking Bulk SMS API.
   *
   * API Docs: https://developers.africastalking.com/docs/sms/sending/bulk
   *
   * Required env vars:
   * - AFRICAS_TALKING_API_KEY: Your API key from Africa's Talking dashboard
   * - AFRICAS_TALKING_USERNAME: Your Africa's Talking username (usually your app name)
   * - AFRICAS_TALKING_SENDER_ID: Approved sender ID for your messages
   */
  async sendSms(params: { to: string; message: string }) {
    const apiKey = this.config.messaging.africasTalkingApiKey;
    const username = this.config.messaging.africasTalkingUsername;
    const from = this.config.messaging.africasTalkingSenderId;

    if (!apiKey || !username) {
      throw new Error('Africa\'s Talking not configured. Set AFRICAS_TALKING_API_KEY and AFRICAS_TALKING_USERNAME env vars.');
    }

    this.logger.log(`Sending SMS to ${params.to} via Africa's Talking (from=${from || 'default'})`);

    try {
      const requestBody = new URLSearchParams({
        username,
        to: params.to,
        message: params.message,
        ...(from && { from }), // Only include 'from' if sender ID is configured
      });

      const response = await axios.post(this.apiUrl, requestBody.toString(), {
        headers: {
          'apiKey': apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
      });

      // Response format: { SMSMessageData: { Message: "Sent to 1/1 Total Cost: KES 0.8000", Recipients: [{ statusCode: 101, number: "+254...", cost: "KES 0.8", status: "Success", messageId: "..." }] } }
      const messageData = response.data?.SMSMessageData;
      const recipient = messageData?.Recipients?.[0];
      const messageId = recipient?.messageId ?? `at-${Date.now()}`;

      if (recipient?.statusCode === 101 || recipient?.statusCode === 102) {
        // 101 = Sent successfully, 102 = Queued
        this.logger.log(`SMS sent successfully to ${params.to}, messageId=${messageId}, cost=${recipient?.cost}`);
        return { messageId, status: 'sent', cost: recipient?.cost };
      } else {
        this.logger.warn(`SMS send returned non-success status: ${recipient?.status} (code: ${recipient?.statusCode})`);
        throw new Error(`Africa's Talking returned status: ${recipient?.status ?? 'Unknown'}`);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(
          `Africa's Talking API error: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`,
          error.stack
        );
      } else {
        this.logger.error(`SMS send failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      }
      throw error;
    }
  }
}

