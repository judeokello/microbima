-- CreateTable
CREATE TABLE "policy_member_parents" (
    "id" SERIAL NOT NULL,
    "customerParentId" UUID NOT NULL,
    "policyId" UUID,
    "memberNumber" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "policy_member_parents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "policy_member_parents_policyId_customerParentId_key" ON "policy_member_parents"("policyId", "customerParentId");
CREATE INDEX "policy_member_parents_memberNumber_idx" ON "policy_member_parents"("memberNumber");
CREATE INDEX "policy_member_parents_customerParentId_idx" ON "policy_member_parents"("customerParentId");

ALTER TABLE "policy_member_parents" ADD CONSTRAINT "policy_member_parents_customerParentId_fkey" FOREIGN KEY ("customerParentId") REFERENCES "customer_parents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "policy_member_parents" ADD CONSTRAINT "policy_member_parents_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "packages_policyNumberFormat_key" ON "packages"("policyNumberFormat");

-- Attach existing live parents to occupying policies on packages/schemes that support parents.
-- Member numbers stay PENDING-* until activatePolicy assigns the real sequence.
INSERT INTO "policy_member_parents" ("customerParentId", "policyId", "memberNumber", "createdAt")
SELECT
  cp.id,
  p.id,
  'PENDING-' || LEFT(REPLACE(cp.id::text, '-', ''), 8),
  NOW()
FROM "customer_parents" cp
JOIN "policies" p ON p."customerId" = cp."customerId"
JOIN "packages" pkg ON pkg.id = p."packageId" AND pkg."parentsSupported" = true
JOIN "package_scheme_customers" psc ON psc."customerId" = cp."customerId"
JOIN "package_schemes" ps ON ps.id = psc."packageSchemeId" AND ps."packageId" = p."packageId"
JOIN "schemes" s ON s.id = ps."schemeId" AND s."parentsSupported" = true
WHERE cp."deletedAt" IS NULL
  AND p.status IN ('PENDING_ACTIVATION', 'ACTIVE', 'SUSPENDED')
  AND NOT EXISTS (
    SELECT 1
    FROM "policy_member_parents" existing
    WHERE existing."policyId" = p.id
      AND existing."customerParentId" = cp.id
  );
