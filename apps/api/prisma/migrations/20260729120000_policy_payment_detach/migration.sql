-- Soft-detach support for policy_payments (admin detach misapplied payments)

ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'DETACHED';

ALTER TABLE "policy_payments" ADD COLUMN IF NOT EXISTS "detachedAt" TIMESTAMPTZ;
ALTER TABLE "policy_payments" ADD COLUMN IF NOT EXISTS "detachedBy" UUID;

CREATE INDEX IF NOT EXISTS "idx_policy_payments_detached_at" ON "policy_payments"("detachedAt");
