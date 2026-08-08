-- Admin messaging campaigns: campaign tables, delivery cancel/progress fields, settings

-- AlterEnum: MessagingDeliveryStatus += CANCELLED
ALTER TYPE "MessagingDeliveryStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "MessagingCampaignStatus" AS ENUM (
    'DELAYED',
    'DISPATCHING',
    'COMPLETED',
    'COMPLETED_WITH_FAILURES',
    'CANCELLED',
    'FAILED_PREFLIGHT'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "messaging_campaigns" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "requestedName" VARCHAR(200) NOT NULL,
    "channel" "MessagingChannel" NOT NULL,
    "templateKey" VARCHAR(100) NOT NULL,
    "status" "MessagingCampaignStatus" NOT NULL,
    "bodyWithPlaceholders" TEXT NOT NULL,
    "subjectWithPlaceholders" VARCHAR(500),
    "audienceSnapshot" JSONB NOT NULL,
    "contentHash" VARCHAR(64) NOT NULL,
    "audienceHash" VARCHAR(64) NOT NULL,
    "targetedCount" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" VARCHAR(100),
    "dispatchStartsAt" TIMESTAMPTZ,
    "dispatchStartedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "cancelledAt" TIMESTAMPTZ,
    "cancelledBy" TEXT,
    "createdBy" TEXT NOT NULL,
    "correlationId" VARCHAR(100),
    "preflightErrors" JSONB,
    "preflightSkips" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messaging_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "messaging_campaign_audit_events" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "eventType" VARCHAR(50) NOT NULL,
    "actorUserId" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messaging_campaign_audit_events_pkey" PRIMARY KEY ("id")
);

-- AlterTable messaging_deliveries
ALTER TABLE "messaging_deliveries"
  ADD COLUMN IF NOT EXISTS "campaignId" UUID,
  ADD COLUMN IF NOT EXISTS "handedOffAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "receiptConfirmedAt" TIMESTAMPTZ;

-- Indexes / uniques
CREATE UNIQUE INDEX IF NOT EXISTS "messaging_campaigns_idempotencyKey_key"
  ON "messaging_campaigns"("idempotencyKey");

CREATE UNIQUE INDEX IF NOT EXISTS "unique_messaging_campaign_name"
  ON "messaging_campaigns"("name");

CREATE UNIQUE INDEX IF NOT EXISTS "unique_messaging_campaign_name_lower"
  ON "messaging_campaigns"(LOWER("name"));

CREATE INDEX IF NOT EXISTS "idx_messaging_campaign_status_dispatch"
  ON "messaging_campaigns"("status", "dispatchStartsAt");

CREATE INDEX IF NOT EXISTS "idx_messaging_campaign_created"
  ON "messaging_campaigns"("createdAt" DESC);

CREATE INDEX IF NOT EXISTS "idx_messaging_campaign_idempotency_window"
  ON "messaging_campaigns"("contentHash", "audienceHash", "createdAt");

CREATE INDEX IF NOT EXISTS "idx_messaging_campaign_audit_campaign_created"
  ON "messaging_campaign_audit_events"("campaignId", "createdAt");

CREATE INDEX IF NOT EXISTS "idx_messaging_delivery_campaign_status"
  ON "messaging_deliveries"("campaignId", "status");

CREATE INDEX IF NOT EXISTS "idx_messaging_delivery_campaign_created"
  ON "messaging_deliveries"("campaignId", "createdAt");

-- FKs
DO $$ BEGIN
  ALTER TABLE "messaging_campaign_audit_events"
    ADD CONSTRAINT "messaging_campaign_audit_events_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "messaging_campaigns"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "messaging_deliveries"
    ADD CONSTRAINT "messaging_deliveries_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "messaging_campaigns"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Campaign settings + meta bump
INSERT INTO system_settings (key, value, "updatedAt", "updatedBy")
VALUES
  ('campaignConfirmThreshold', '20'::jsonb, NOW(), NULL),
  ('campaignSmsDelaySeconds', '120'::jsonb, NOW(), NULL),
  ('campaignEmailDelaySeconds', '180'::jsonb, NOW(), NULL),
  ('campaignIdempotencyWindowMinutes', '10'::jsonb, NOW(), NULL)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    "updatedAt" = NOW();

UPDATE system_settings_meta SET "updatedAt" = NOW() WHERE id = 1;
