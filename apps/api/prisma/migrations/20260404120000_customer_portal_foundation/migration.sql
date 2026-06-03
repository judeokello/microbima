-- Customer self-service: PIN completion timestamp; messaging enqueue placeholder passthrough.

ALTER TABLE "customers" ADD COLUMN "portalPinSetupCompletedAt" TIMESTAMP(3);

ALTER TABLE "messaging_deliveries" ADD COLUMN "enqueuePlaceholderContext" JSONB;
