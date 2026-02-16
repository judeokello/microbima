export type MessagingChannel = 'SMS' | 'EMAIL';

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
}

