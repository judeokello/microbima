-- Customer self-service: support numbers in system_settings (FR-016).
-- Values stored as JSON scalar strings. Idempotent upserts.
-- Run via prisma/seed.ts after seed-messaging.sql.

INSERT INTO system_settings (key, value, "updatedAt", "updatedBy")
VALUES (
  'general_support_number',
  to_jsonb('0746907934'::text),
  NOW(),
  NULL
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    "updatedAt" = NOW();

INSERT INTO system_settings (key, value, "updatedAt", "updatedBy")
VALUES (
  'medical_support_number',
  to_jsonb('0113569606'::text),
  NOW(),
  NULL
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    "updatedAt" = NOW();

-- Bump meta so SystemSettingsService cache refreshes when these rows change.
UPDATE system_settings_meta SET "updatedAt" = NOW() WHERE id = 1;
