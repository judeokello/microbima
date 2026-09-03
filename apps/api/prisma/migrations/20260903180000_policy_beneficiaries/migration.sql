-- CreateTable
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

ALTER TABLE "policy_beneficiaries" ADD CONSTRAINT "policy_beneficiaries_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "policy_beneficiaries" ADD CONSTRAINT "policy_beneficiaries_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "beneficiaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: each policy in a customer's supersession-aware set gets one join
-- to the earliest remaining beneficiary (prefer percentage = 100).
INSERT INTO "policy_beneficiaries" ("id", "policyId", "beneficiaryId", "percentage", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  p.id,
  b.id,
  COALESCE(b.percentage, 100),
  NOW(),
  NOW()
FROM "policies" p
INNER JOIN LATERAL (
  SELECT b2.id, b2.percentage
  FROM "beneficiaries" b2
  WHERE b2."customerId" = p."customerId"
    AND b2."deletedAt" IS NULL
  ORDER BY
    CASE WHEN b2.percentage = 100 THEN 0 ELSE 1 END,
    b2."createdAt" ASC
  LIMIT 1
) b ON TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM "policy_beneficiaries" pb WHERE pb."policyId" = p.id
);
