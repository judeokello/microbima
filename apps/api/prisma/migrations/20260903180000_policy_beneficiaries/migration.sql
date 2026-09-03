-- Policy next-of-kin share join (one beneficiary per policy).
-- RLS is auto-enabled on public tables via ensure_rls_on_public_tables.

CREATE TABLE "policy_beneficiaries" (
    "id" UUID NOT NULL,
    "policyId" UUID NOT NULL,
    "beneficiaryId" UUID NOT NULL,
    "percentage" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_beneficiaries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "policy_beneficiaries_policyId_key" ON "policy_beneficiaries"("policyId");
CREATE INDEX "policy_beneficiaries_beneficiaryId_idx" ON "policy_beneficiaries"("beneficiaryId");

ALTER TABLE "policy_beneficiaries"
  ADD CONSTRAINT "policy_beneficiaries_policyId_fkey"
  FOREIGN KEY ("policyId") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "policy_beneficiaries"
  ADD CONSTRAINT "policy_beneficiaries_beneficiaryId_fkey"
  FOREIGN KEY ("beneficiaryId") REFERENCES "beneficiaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: for each customer, walk supersession chains (root = no supersedesPolicyId).
-- Assign the earliest remaining beneficiary (prefer percentage=100) to every policy in the chain.
-- Extra historical people stay on beneficiaries for later picking.
WITH RECURSIVE chain_members AS (
  SELECT
    p.id,
    p."customerId",
    p.id AS "rootId",
    p."createdAt" AS "rootCreatedAt"
  FROM "policies" p
  WHERE p."supersedesPolicyId" IS NULL

  UNION ALL

  SELECT
    child.id,
    child."customerId",
    cm."rootId",
    cm."rootCreatedAt"
  FROM "policies" child
  JOIN chain_members cm ON child."supersedesPolicyId" = cm.id
),
ranked_chains AS (
  SELECT
    "customerId",
    "rootId",
    MIN("rootCreatedAt") AS "chainCreatedAt",
    ROW_NUMBER() OVER (
      PARTITION BY "customerId"
      ORDER BY MIN("rootCreatedAt") ASC, "rootId" ASC
    ) AS "chainRn"
  FROM chain_members
  GROUP BY "customerId", "rootId"
),
ranked_beneficiaries AS (
  SELECT
    b.id AS "beneficiaryId",
    b."customerId",
    b.percentage,
    ROW_NUMBER() OVER (
      PARTITION BY b."customerId"
      ORDER BY
        CASE WHEN b.percentage = 100 THEN 0 ELSE 1 END,
        b."createdAt" ASC,
        b.id ASC
    ) AS "beneficiaryRn"
  FROM "beneficiaries" b
  WHERE b."deletedAt" IS NULL
)
INSERT INTO "policy_beneficiaries" ("id", "policyId", "beneficiaryId", "percentage", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  cm.id,
  rb."beneficiaryId",
  COALESCE(rb.percentage, 100),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM ranked_chains rc
JOIN ranked_beneficiaries rb
  ON rb."customerId" = rc."customerId"
 AND rb."beneficiaryRn" = rc."chainRn"
JOIN chain_members cm
  ON cm."rootId" = rc."rootId";
