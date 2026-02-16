-- CreateEnum
CREATE TYPE "public"."MessagingChannel" AS ENUM ('SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "public"."MessagingDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'WAITING_FOR_ATTACHMENTS', 'RETRY_WAIT', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."MessagingProvider" AS ENUM ('AFRICAS_TALKING', 'SENDGRID');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN "defaultMessagingLanguage" VARCHAR(5) NOT NULL DEFAULT 'en';

-- CreateTable
CREATE TABLE "public"."messaging_templates" (
    "id" UUID NOT NULL,
    "templateKey" VARCHAR(100) NOT NULL,
    "channel" "public"."MessagingChannel" NOT NULL,
    "language" VARCHAR(5) NOT NULL,
    "subject" VARCHAR(200),
    "body" TEXT NOT NULL,
    "textBody" TEXT,
    "placeholders" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "messaging_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."messaging_routes" (
    "id" SERIAL NOT NULL,
    "templateKey" VARCHAR(100) NOT NULL,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "messaging_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."messaging_deliveries" (
    "id" UUID NOT NULL,
    "templateKey" VARCHAR(100) NOT NULL,
    "channel" "public"."MessagingChannel" NOT NULL,
    "customerId" UUID,
    "policyId" UUID,
    "recipientPhone" VARCHAR(20),
    "recipientEmail" VARCHAR(200),
    "requestedLanguage" VARCHAR(5) NOT NULL,
    "usedLanguage" VARCHAR(5),
    "renderedSubject" VARCHAR(500),
    "renderedBody" TEXT NOT NULL,
    "renderedTextBody" TEXT,
    "errorMessage" VARCHAR(500),
    "missingPlaceholderKeys" TEXT[],
    "renderError" TEXT,
    "lastError" TEXT,
    "status" "public"."MessagingDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL,
    "nextAttemptAt" TIMESTAMPTZ,
    "lastAttemptAt" TIMESTAMPTZ,
    "providerMessageId" VARCHAR(200),
    "correlationId" VARCHAR(100),
    "originalDeliveryId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "messaging_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."messaging_attachments" (
    "id" UUID NOT NULL,
    "deliveryId" UUID NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "storageBucket" VARCHAR(100) NOT NULL,
    "storagePath" VARCHAR(500) NOT NULL,
    "sizeBytes" INTEGER,
    "checksum" VARCHAR(200),
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messaging_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."messaging_provider_events" (
    "id" UUID NOT NULL,
    "provider" "public"."MessagingProvider" NOT NULL,
    "deliveryId" UUID,
    "providerEventId" VARCHAR(200),
    "providerMessageId" VARCHAR(200),
    "eventType" VARCHAR(100) NOT NULL,
    "occurredAt" TIMESTAMPTZ,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messaging_provider_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."system_settings" (
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "public"."system_settings_meta" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_meta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unique_template_key_channel_language" ON "public"."messaging_templates"("templateKey", "channel", "language");

-- CreateIndex
CREATE INDEX "idx_messaging_template_key" ON "public"."messaging_templates"("templateKey");

-- CreateIndex
CREATE UNIQUE INDEX "messaging_routes_templateKey_key" ON "public"."messaging_routes"("templateKey");

-- CreateIndex
CREATE INDEX "idx_messaging_delivery_status_next_attempt" ON "public"."messaging_deliveries"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "idx_messaging_delivery_customer_created" ON "public"."messaging_deliveries"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_messaging_delivery_policy_created" ON "public"."messaging_deliveries"("policyId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_messaging_delivery_provider_message_id" ON "public"."messaging_deliveries"("providerMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "unique_delivery_filename" ON "public"."messaging_attachments"("deliveryId", "fileName");

-- CreateIndex
CREATE INDEX "idx_messaging_attachment_delivery" ON "public"."messaging_attachments"("deliveryId");

-- CreateIndex
CREATE UNIQUE INDEX "unique_provider_event_id" ON "public"."messaging_provider_events"("provider", "providerEventId");

-- CreateIndex
CREATE INDEX "idx_provider_event_delivery_created" ON "public"."messaging_provider_events"("deliveryId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_provider_event_provider_message_id" ON "public"."messaging_provider_events"("providerMessageId");

-- AddForeignKey
ALTER TABLE "public"."messaging_deliveries" ADD CONSTRAINT "messaging_deliveries_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messaging_deliveries" ADD CONSTRAINT "messaging_deliveries_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "public"."policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messaging_deliveries" ADD CONSTRAINT "messaging_deliveries_originalDeliveryId_fkey" FOREIGN KEY ("originalDeliveryId") REFERENCES "public"."messaging_deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messaging_attachments" ADD CONSTRAINT "messaging_attachments_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "public"."messaging_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messaging_provider_events" ADD CONSTRAINT "messaging_provider_events_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "public"."messaging_deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

