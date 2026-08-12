-- Display order for package plans (Pricing table columns left-to-right)
ALTER TABLE "package_plans" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Backfill: preserve current alphabetical order within each package
UPDATE "package_plans" AS p
SET "sortOrder" = sub.rn - 1
FROM (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY "packageId" ORDER BY name ASC, id ASC) AS rn
  FROM "package_plans"
) AS sub
WHERE p.id = sub.id;

CREATE INDEX IF NOT EXISTS "package_plans_packageId_sortOrder_idx"
  ON "package_plans"("packageId", "sortOrder");
