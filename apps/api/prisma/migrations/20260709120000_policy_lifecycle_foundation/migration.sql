-- Policy lifecycle: DEACTIVATED status, EntityStatusChange audit, supersession, partial unique index, OUTSTANDING payments

-- Enums
ALTER TYPE "PolicyStatus" ADD VALUE IF NOT EXISTS 'DEACTIVATED';
ALTER TYPE "CustomerStatus" ADD VALUE IF NOT EXISTS 'DEACTIVATED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'OUTSTANDING';

CREATE TYPE "StatusChangeEntityType" AS ENUM ('POLICY', 'CUSTOMER');
CREATE TYPE "StatusChangeTrigger" AS ENUM ('MANUAL_ADMIN', 'MODIFY_PRODUCT', 'PAYMENT_LIFECYCLE', 'SYSTEM');

-- Policy lineage + deactivatedAt
ALTER TABLE "policies" ADD COLUMN IF NOT EXISTS "deactivatedAt" TIMESTAMP(3);
ALTER TABLE "policies" ADD COLUMN IF NOT EXISTS "supersedesPolicyId" UUID;
ALTER TABLE "policies" ADD COLUMN IF NOT EXISTS "supersededByPolicyId" UUID;

ALTER TABLE "policies" ADD CONSTRAINT "policies_supersedesPolicyId_fkey"
  FOREIGN KEY ("supersedesPolicyId") REFERENCES "policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "policies" ADD CONSTRAINT "policies_supersededByPolicyId_fkey"
  FOREIGN KEY ("supersededByPolicyId") REFERENCES "policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Customer deactivatedAt
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "deactivatedAt" TIMESTAMP(3);

-- Entity status change audit
CREATE TABLE "entity_status_changes" (
    "id" UUID NOT NULL,
    "entityType" "StatusChangeEntityType" NOT NULL,
    "customerId" UUID NOT NULL,
    "policyId" UUID,
    "fromStatus" VARCHAR(50) NOT NULL,
    "toStatus" VARCHAR(50) NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "trigger" "StatusChangeTrigger" NOT NULL,
    "changedBy" UUID NOT NULL,
    "correlationId" VARCHAR(100),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_status_changes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "entity_status_changes_customerId_createdAt_idx" ON "entity_status_changes"("customerId", "createdAt");
CREATE INDEX "entity_status_changes_policyId_createdAt_idx" ON "entity_status_changes"("policyId", "createdAt");

ALTER TABLE "entity_status_changes" ADD CONSTRAINT "entity_status_changes_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "entity_status_changes" ADD CONSTRAINT "entity_status_changes_policyId_fkey"
  FOREIGN KEY ("policyId") REFERENCES "policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Replace full unique (customerId, packageId) with partial unique for non-terminal policies
DROP INDEX IF EXISTS "policies_customer_id_package_id_key";
CREATE INDEX IF NOT EXISTS "policies_customerId_packageId_idx" ON "policies"("customerId", "packageId");

CREATE UNIQUE INDEX "policies_customer_package_active_unique"
  ON "policies"("customerId", "packageId")
  WHERE status IN ('ACTIVE', 'PENDING_ACTIVATION', 'SUSPENDED');
