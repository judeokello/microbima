import { ApiProperty } from '@nestjs/swagger';

/**
 * T025: Admin-visible delivery DTO with error fields
 */
export class DeliveryDto {
  @ApiProperty({ description: 'Delivery ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ description: 'Template key', example: 'policy_purchase' })
  templateKey: string;

  @ApiProperty({ description: 'Messaging channel', enum: ['SMS', 'EMAIL'] })
  channel: 'SMS' | 'EMAIL';

  @ApiProperty({ description: 'Customer ID', required: false })
  customerId?: string;

  @ApiProperty({ description: 'Policy ID', required: false })
  policyId?: string;

  @ApiProperty({ description: 'Recipient phone number', required: false })
  recipientPhone?: string;

  @ApiProperty({ description: 'Recipient email address', required: false })
  recipientEmail?: string;

  @ApiProperty({ description: 'Requested language code', example: 'en' })
  requestedLanguage: string;

  @ApiProperty({ description: 'Actually used language code after fallback', required: false, example: 'en' })
  usedLanguage?: string;

  @ApiProperty({ description: 'Rendered email subject', required: false })
  renderedSubject?: string;

  @ApiProperty({ description: 'Rendered message body' })
  renderedBody: string;

  @ApiProperty({ description: 'Rendered plain text body for email', required: false })
  renderedTextBody?: string;

  @ApiProperty({ description: 'Human-readable error message', required: false })
  errorMessage?: string;

  @ApiProperty({ description: 'Array of missing placeholder keys', required: false, type: [String] })
  missingPlaceholderKeys?: string[];

  @ApiProperty({ description: 'Render error details (JSON)', required: false })
  renderError?: string;

  @ApiProperty({ description: 'Last provider/send error details', required: false })
  lastError?: string;

  @ApiProperty({ description: 'Delivery status', enum: ['PENDING', 'PROCESSING', 'SENT', 'FAILED', 'RETRY_WAIT'] })
  status: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'RETRY_WAIT';

  @ApiProperty({ description: 'Number of send attempts', example: 0 })
  attemptCount: number;

  @ApiProperty({ description: 'Maximum allowed attempts', example: 2 })
  maxAttempts: number;

  @ApiProperty({ description: 'Next retry attempt timestamp', required: false })
  nextAttemptAt?: Date;

  @ApiProperty({ description: 'Last send attempt timestamp', required: false })
  lastAttemptAt?: Date;

  @ApiProperty({ description: 'Provider message ID', required: false })
  providerMessageId?: string;

  @ApiProperty({ description: 'Correlation ID for tracing', required: false })
  correlationId?: string;

  @ApiProperty({ description: 'Original delivery ID if this is a resend', required: false })
  originalDeliveryId?: string;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last updated timestamp' })
  updatedAt: Date;
}
