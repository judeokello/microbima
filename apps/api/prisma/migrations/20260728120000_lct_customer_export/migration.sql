-- LCT Customer Export MVP: policyId on member tables, staffNumber, recipient configs, LCT tables

-- ---------- Policy.staffNumber ----------
ALTER TABLE "policies" ADD COLUMN IF NOT EXISTS "staffNumber" VARCHAR(50);

-- ---------- policy_member_principals.policyId ----------
ALTER TABLE "policy_member_principals" ADD COLUMN IF NOT EXISTS "policyId" UUID;

-- ---------- policy_member_dependants.policyId ----------
ALTER TABLE "policy_member_dependants" ADD COLUMN IF NOT EXISTS "policyId" UUID;

-- Best-effort backfill: prefer policy whose policyNumber is contained in memberNumber,
-- else ACTIVE policy for customer, else most recently updated policy.
-- Deduplicate so at most one principal per policyId (unique constraint).
UPDATE "policy_member_principals" pmp
SET "policyId" = matched."policyId"
FROM (
  SELECT DISTINCT ON (c.policy_id)
    c.principal_id,
    c.policy_id AS "policyId"
  FROM (
    SELECT DISTINCT ON (pmp2.id)
      pmp2.id AS principal_id,
      p.id AS policy_id
    FROM "policy_member_principals" pmp2
    INNER JOIN "policies" p ON p."customerId" = pmp2."customerId"
    WHERE pmp2."policyId" IS NULL
    ORDER BY
      pmp2.id,
      CASE
        WHEN p."policyNumber" IS NOT NULL AND pmp2."memberNumber" LIKE '%' || p."policyNumber" || '%' THEN 0
        WHEN p.status = 'ACTIVE' THEN 1
        ELSE 2
      END,
      p."updatedAt" DESC
  ) c
  ORDER BY c.policy_id, c.principal_id
) matched
WHERE pmp.id = matched.principal_id
  AND pmp."policyId" IS NULL;

UPDATE "policy_member_dependants" pmd
SET "policyId" = matched."policyId"
FROM (
  SELECT DISTINCT ON (c.policy_id, c.dependant_id)
    c.dependant_member_id,
    c.policy_id AS "policyId"
  FROM (
    SELECT DISTINCT ON (pmd2.id)
      pmd2.id AS dependant_member_id,
      pmd2."dependantId" AS dependant_id,
      p.id AS policy_id
    FROM "policy_member_dependants" pmd2
    INNER JOIN "dependants" d ON d.id = pmd2."dependantId"
    INNER JOIN "policies" p ON p."customerId" = d."customerId"
    WHERE pmd2."policyId" IS NULL
    ORDER BY
      pmd2.id,
      CASE
        WHEN p."policyNumber" IS NOT NULL AND pmd2."memberNumber" LIKE '%' || p."policyNumber" || '%' THEN 0
        WHEN p.status = 'ACTIVE' THEN 1
        ELSE 2
      END,
      p."updatedAt" DESC
  ) c
  ORDER BY c.policy_id, c.dependant_id, c.dependant_member_id
) matched
WHERE pmd.id = matched.dependant_member_id
  AND pmd."policyId" IS NULL;

-- FKs for policyId
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'policy_member_principals_policyId_fkey'
  ) THEN
    ALTER TABLE "policy_member_principals"
      ADD CONSTRAINT "policy_member_principals_policyId_fkey"
      FOREIGN KEY ("policyId") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'policy_member_dependants_policyId_fkey'
  ) THEN
    ALTER TABLE "policy_member_dependants"
      ADD CONSTRAINT "policy_member_dependants_policyId_fkey"
      FOREIGN KEY ("policyId") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Unique / indexes (Postgres UNIQUE allows multiple NULL policyId rows)
CREATE UNIQUE INDEX IF NOT EXISTS "policy_member_principals_policyId_key"
  ON "policy_member_principals"("policyId");

CREATE INDEX IF NOT EXISTS "policy_member_principals_memberNumber_idx"
  ON "policy_member_principals"("memberNumber");

CREATE INDEX IF NOT EXISTS "policy_member_principals_customerId_idx"
  ON "policy_member_principals"("customerId");

CREATE UNIQUE INDEX IF NOT EXISTS "policy_member_dependants_policyId_dependantId_key"
  ON "policy_member_dependants"("policyId", "dependantId");

CREATE INDEX IF NOT EXISTS "policy_member_dependants_memberNumber_idx"
  ON "policy_member_dependants"("memberNumber");

CREATE INDEX IF NOT EXISTS "policy_member_dependants_dependantId_idx"
  ON "policy_member_dependants"("dependantId");

-- ---------- messaging_email_recipient_configs ----------
CREATE TABLE IF NOT EXISTS "messaging_email_recipient_configs" (
  "id" UUID NOT NULL,
  "templateKey" VARCHAR(100) NOT NULL,
  "toEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "ccEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "bccEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  CONSTRAINT "messaging_email_recipient_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "messaging_email_recipient_configs_templateKey_key"
  ON "messaging_email_recipient_configs"("templateKey");

-- ---------- LCT enums ----------
DO $$ BEGIN
  CREATE TYPE "LctSubjectType" AS ENUM ('PRINCIPAL', 'DEPENDANT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LctPendingAction" AS ENUM ('ACTIVATE', 'DEACTIVATE', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LctExportBatchStatus" AS ENUM ('EXPORTED', 'SENT', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------- lct_export_batches (created before targets due to openBatchId FK) ----------
CREATE TABLE IF NOT EXISTS "lct_export_batches" (
  "id" UUID NOT NULL,
  "status" "LctExportBatchStatus" NOT NULL DEFAULT 'EXPORTED',
  "exportedBy" TEXT NOT NULL,
  "exportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "filename" VARCHAR(255) NOT NULL,
  "storageBucket" VARCHAR(100) NOT NULL,
  "storagePath" VARCHAR(500) NOT NULL,
  "rowCount" INTEGER NOT NULL,
  "toEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "ccEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "bccEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "subject" VARCHAR(500),
  "bodyHtml" TEXT,
  "bodyText" TEXT,
  "sentAt" TIMESTAMP(3),
  "sentBy" TEXT,
  "smtpMessageId" VARCHAR(200),
  "lastSendError" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancelledBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "lct_export_batches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "lct_export_batches_status_exportedAt_idx"
  ON "lct_export_batches"("status", "exportedAt");

CREATE INDEX IF NOT EXISTS "lct_export_batches_exportedAt_idx"
  ON "lct_export_batches"("exportedAt");

-- At most one EXPORTED batch at a time
CREATE UNIQUE INDEX IF NOT EXISTS "lct_export_batches_one_exported"
  ON "lct_export_batches"("status")
  WHERE "status" = 'EXPORTED';

-- ---------- lct_member_sync_targets ----------
CREATE TABLE IF NOT EXISTS "lct_member_sync_targets" (
  "id" UUID NOT NULL,
  "policyId" UUID NOT NULL,
  "memberNumber" VARCHAR(50) NOT NULL,
  "subjectType" "LctSubjectType" NOT NULL,
  "customerId" UUID NOT NULL,
  "dependantId" UUID,
  "pendingAction" "LctPendingAction",
  "pendingReasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "pendingSince" TIMESTAMP(3),
  "lastSentAt" TIMESTAMP(3),
  "lastSentAction" "LctPendingAction",
  "lastSentProfileFingerprint" VARCHAR(128),
  "errorCode" VARCHAR(64),
  "openBatchId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "lct_member_sync_targets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "lct_member_sync_targets_memberNumber_key"
  ON "lct_member_sync_targets"("memberNumber");

CREATE INDEX IF NOT EXISTS "lct_member_sync_targets_policyId_idx"
  ON "lct_member_sync_targets"("policyId");

CREATE INDEX IF NOT EXISTS "lct_member_sync_targets_customerId_idx"
  ON "lct_member_sync_targets"("customerId");

CREATE INDEX IF NOT EXISTS "lct_member_sync_targets_pendingAction_idx"
  ON "lct_member_sync_targets"("pendingAction");

CREATE INDEX IF NOT EXISTS "lct_member_sync_targets_errorCode_idx"
  ON "lct_member_sync_targets"("errorCode");

CREATE INDEX IF NOT EXISTS "lct_member_sync_targets_openBatchId_idx"
  ON "lct_member_sync_targets"("openBatchId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lct_member_sync_targets_policyId_fkey'
  ) THEN
    ALTER TABLE "lct_member_sync_targets"
      ADD CONSTRAINT "lct_member_sync_targets_policyId_fkey"
      FOREIGN KEY ("policyId") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lct_member_sync_targets_customerId_fkey'
  ) THEN
    ALTER TABLE "lct_member_sync_targets"
      ADD CONSTRAINT "lct_member_sync_targets_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lct_member_sync_targets_openBatchId_fkey'
  ) THEN
    ALTER TABLE "lct_member_sync_targets"
      ADD CONSTRAINT "lct_member_sync_targets_openBatchId_fkey"
      FOREIGN KEY ("openBatchId") REFERENCES "lct_export_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ---------- lct_export_batch_rows ----------
CREATE TABLE IF NOT EXISTS "lct_export_batch_rows" (
  "id" UUID NOT NULL,
  "batchId" UUID NOT NULL,
  "syncTargetId" UUID,
  "memberNumber" VARCHAR(50) NOT NULL,
  "action" "LctPendingAction" NOT NULL,
  "reasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "csvSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lct_export_batch_rows_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "lct_export_batch_rows_batchId_idx"
  ON "lct_export_batch_rows"("batchId");

CREATE INDEX IF NOT EXISTS "lct_export_batch_rows_memberNumber_idx"
  ON "lct_export_batch_rows"("memberNumber");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lct_export_batch_rows_batchId_fkey'
  ) THEN
    ALTER TABLE "lct_export_batch_rows"
      ADD CONSTRAINT "lct_export_batch_rows_batchId_fkey"
      FOREIGN KEY ("batchId") REFERENCES "lct_export_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
