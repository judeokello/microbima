-- Package slug, payment frequencies, policy installment snapshots; drop productDurationDays

-- 1. Package.slug
ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "slug" VARCHAR(100);

-- 2. Package payment frequencies
CREATE TABLE IF NOT EXISTS "package_payment_frequencies" (
    "id" SERIAL NOT NULL,
    "packageId" INTEGER NOT NULL,
    "frequency" "PaymentFrequency" NOT NULL,
    "installmentCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_payment_frequencies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "package_payment_frequencies_packageId_frequency_key"
  ON "package_payment_frequencies"("packageId", "frequency");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'package_payment_frequencies_packageId_fkey'
  ) THEN
    ALTER TABLE "package_payment_frequencies"
      ADD CONSTRAINT "package_payment_frequencies_packageId_fkey"
      FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 3. Policy snapshot columns
ALTER TABLE "policies" ADD COLUMN IF NOT EXISTS "expectedInstallmentCount" INTEGER;
ALTER TABLE "policies" ADD COLUMN IF NOT EXISTS "nominalPaymentPeriodEndDate" TIMESTAMP(3);

-- 4. Backfill package slugs by name
UPDATE "packages" SET "slug" = 'mfanisi-go' WHERE "name" = 'MfanisiGo' AND ("slug" IS NULL OR "slug" = '');
UPDATE "packages" SET "slug" = 'mfanisi' WHERE "name" = 'Mfanisi' AND ("slug" IS NULL OR "slug" = '');
UPDATE "packages" SET "slug" = 'mzalendo' WHERE "name" = 'Mzalendo' AND ("slug" IS NULL OR "slug" = '');

-- 5. Seed frequency rows for known packages (DAILY 276, WEEKLY 39, MONTHLY 9)
INSERT INTO "package_payment_frequencies" ("packageId", "frequency", "installmentCount", "updatedAt")
SELECT p.id, f.frequency::"PaymentFrequency", f.installment_count, CURRENT_TIMESTAMP
FROM "packages" p
CROSS JOIN (
  VALUES
    ('DAILY', 276),
    ('WEEKLY', 39),
    ('MONTHLY', 9)
) AS f(frequency, installment_count)
WHERE p.name IN ('MfanisiGo', 'Mfanisi', 'Mzalendo')
ON CONFLICT ("packageId", "frequency") DO UPDATE
SET "installmentCount" = EXCLUDED."installmentCount",
    "updatedAt" = CURRENT_TIMESTAMP;

-- 6. Backfill expectedInstallmentCount from productDurationDays + frequency/cadence
UPDATE "policies" pol
SET "expectedInstallmentCount" = CASE
  WHEN pol."frequency" = 'DAILY' THEN COALESCE(pkg."productDurationDays", 276)
  WHEN pol."paymentCadence" IS NULL OR pol."paymentCadence" <= 0 THEN NULL
  ELSE ROUND(COALESCE(pkg."productDurationDays", 276)::numeric / pol."paymentCadence")::integer
END
FROM "packages" pkg
WHERE pol."packageId" = pkg.id
  AND pol."expectedInstallmentCount" IS NULL;

-- 7. Backfill nominalPaymentPeriodEndDate for activated policies
UPDATE "policies"
SET "nominalPaymentPeriodEndDate" = LEAST(
  ("startDate" + (("expectedInstallmentCount" - 1) * "paymentCadence") * INTERVAL '1 day'),
  "endDate"
)
WHERE "startDate" IS NOT NULL
  AND "expectedInstallmentCount" IS NOT NULL
  AND "expectedInstallmentCount" > 0
  AND "paymentCadence" IS NOT NULL
  AND "paymentCadence" > 0
  AND "nominalPaymentPeriodEndDate" IS NULL;

-- 8. Unique slug index (nullable unique allows multiple NULLs in Postgres)
CREATE UNIQUE INDEX IF NOT EXISTS "packages_slug_key" ON "packages"("slug");

-- 9. Drop deprecated productDurationDays
ALTER TABLE "packages" DROP COLUMN IF EXISTS "productDurationDays";
