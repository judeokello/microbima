-- Idempotent patch: package slugs + payment frequencies for MfanisiGo, Mfanisi, Mzalendo.
-- Does NOT create MfanisiBoda (create via admin UI).
-- Safe to re-run.

-- Slugs
UPDATE "packages" SET "slug" = 'mfanisi-go', "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'MfanisiGo';

UPDATE "packages" SET "slug" = 'mfanisi', "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'Mfanisi';

UPDATE "packages" SET "slug" = 'mzalendo', "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'Mzalendo';

-- Frequency rows: DAILY 276, WEEKLY 39, MONTHLY 9
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

-- Keep packages id sequence ahead of MAX(id) after explicit-id seeds
SELECT setval(
  pg_get_serial_sequence('packages', 'id'),
  (SELECT COALESCE(MAX(id), 1) FROM packages)
);

-- Verification
SELECT p.id, p.name, p.slug, ppf.frequency, ppf."installmentCount"
FROM "packages" p
LEFT JOIN "package_payment_frequencies" ppf ON ppf."packageId" = p.id
WHERE p.name IN ('MfanisiGo', 'Mfanisi', 'Mzalendo')
ORDER BY p.id, ppf.frequency;
