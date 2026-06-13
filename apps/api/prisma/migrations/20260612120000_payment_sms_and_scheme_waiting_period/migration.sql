-- Payment SMS idempotency, scheme waiting period, default currency setting

ALTER TABLE "package_schemes"
ADD COLUMN IF NOT EXISTS "generalSchemeWaitingPeriod" INTEGER;

ALTER TABLE "package_schemes"
DROP CONSTRAINT IF EXISTS "package_schemes_generalSchemeWaitingPeriod_check";

ALTER TABLE "package_schemes"
ADD CONSTRAINT "package_schemes_generalSchemeWaitingPeriod_check"
CHECK (
  "generalSchemeWaitingPeriod" IS NULL
  OR ("generalSchemeWaitingPeriod" >= 0 AND "generalSchemeWaitingPeriod" <= 9999)
);

ALTER TABLE "policy_payments"
ADD COLUMN IF NOT EXISTS "paymentSmsEnqueuedAt" TIMESTAMPTZ;

INSERT INTO system_settings (key, value, "updatedAt", "updatedBy")
VALUES (
  'defaultSystemCurrency',
  to_jsonb('Kes'::text),
  NOW(),
  NULL
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    "updatedAt" = NOW();

UPDATE system_settings_meta SET "updatedAt" = NOW() WHERE id = 1;
