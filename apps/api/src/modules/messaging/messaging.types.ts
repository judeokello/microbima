export type MessagingChannel = 'SMS' | 'EMAIL';

/** One dynamic attachment to generate from a template (path-based). */
export interface DynamicAttachmentSpec {
  attachmentTemplateId: string;
  params: Record<string, string>;
}

export interface EnqueueMessageRequest {
  templateKey: string;
  /** Required for customer-targeted messages; optional when overrideRecipientPhone is set (unmatched paybill). */
  customerId?: string;
  policyId?: string | null;
  /**
   * Flat render context for placeholder substitution.
   * Keys must match ^[a-z0-9_]+$ and placeholders are referenced as {key}.
   */
  placeholderValues: Record<string, string | number | boolean | Date>;
  /**
   * Optional requested language code (e.g. "en", "sw"). If not provided,
   * the customer's default language is used.
   */
  requestedLanguage?: string;
  correlationId?: string;
  /**
   * Optional dynamic attachment specs. Worker will generate PDFs from templates and attach to email.
   * Only applies when email channel is enabled.
   */
  dynamicAttachmentSpecs?: DynamicAttachmentSpec[];
  /**
   * Optional SMS recipient for phone-only enqueue (no customerId), e.g. unmatched paybill SMS.
   * Customer-linked non-prod redirect is handled centrally in MessagingService.
   */
  overrideRecipientPhone?: string | null;
}

export interface ResendDeliveryRequest {
  deliveryId: string;
  correlationId?: string;
}

export interface MessagingSettingsSnapshot {
  defaultMessagingLanguage: string;
  smsMaxAttempts: number;
  emailMaxAttempts: number;
  baseRetryDelaySeconds: number;
  maxRetryDelaySeconds: number;
  workerPollIntervalSeconds: number;
  workerBatchSize: number;
  workerMaxConcurrency: number;
  systemSettingsCacheRefreshSeconds: number;
  /** Attachment retention in months. 0 or negative = never expires. */
  messagingAttachmentRetentionMonths: number;
  /** Rendered email/SMS content retention in months. 0 or negative = never expires. */
  messagingContentRetentionMonths: number;
  /** Currency label prepended to SMS amounts (e.g. "Kes"). */
  defaultSystemCurrency: string;
  general_support_number: string;
  medical_support_number: string;
  /** Typed campaign-name confirmation when sendableCount >= this. */
  campaignConfirmThreshold: number;
  /** Delay before SMS campaign dispatch (seconds). */
  campaignSmsDelaySeconds: number;
  /** Delay before email campaign dispatch (seconds). */
  campaignEmailDelaySeconds: number;
  /** Duplicate name+body+audience Send guard window (minutes). */
  campaignIdempotencyWindowMinutes: number;
}

