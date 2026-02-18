export type MessagingChannel = 'SMS' | 'EMAIL';

/** One dynamic attachment to generate from a template (path-based). */
export interface DynamicAttachmentSpec {
  attachmentTemplateId: string;
  params: Record<string, string>;
}

export interface EnqueueMessageRequest {
  templateKey: string;
  customerId: string;
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
   * Optional recipient override. When provided (e.g. in dev/staging for testing), SMS/email are sent
   * to these addresses instead of the customer's. Use only when NODE_ENV is development or staging.
   */
  overrideRecipientPhone?: string | null;
  overrideRecipientEmail?: string | null;
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
}

