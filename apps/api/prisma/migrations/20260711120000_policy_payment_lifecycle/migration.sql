-- Policy payment lifecycle: INACTIVE status, grace/suspension clocks, notification ledger

ALTER TYPE "PolicyStatus" ADD VALUE IF NOT EXISTS 'INACTIVE';

ALTER TABLE "policies" ADD COLUMN IF NOT EXISTS "inGracePeriod" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "policies" ADD COLUMN IF NOT EXISTS "graceEnteredAt" TIMESTAMP(3);
ALTER TABLE "policies" ADD COLUMN IF NOT EXISTS "overdueAnchorDueDate" TIMESTAMP(3);
ALTER TABLE "policies" ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3);
ALTER TABLE "policies" ADD COLUMN IF NOT EXISTS "inactivatedAt" TIMESTAMP(3);
ALTER TABLE "policies" ADD COLUMN IF NOT EXISTS "expiredAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "policy_lifecycle_notifications" (
    "id" UUID NOT NULL,
    "policyId" UUID NOT NULL,
    "scheduleKey" VARCHAR(80) NOT NULL,
    "templateKey" VARCHAR(120) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "policy_lifecycle_notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "policy_lifecycle_notifications_policyId_scheduleKey_key"
  ON "policy_lifecycle_notifications"("policyId", "scheduleKey");

CREATE INDEX IF NOT EXISTS "policy_lifecycle_notifications_policyId_idx"
  ON "policy_lifecycle_notifications"("policyId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'policy_lifecycle_notifications_policyId_fkey'
  ) THEN
    ALTER TABLE "policy_lifecycle_notifications"
      ADD CONSTRAINT "policy_lifecycle_notifications_policyId_fkey"
      FOREIGN KEY ("policyId") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Partial unique index remains ACTIVE|PENDING_ACTIVATION|SUSPENDED only (INACTIVE not included)
