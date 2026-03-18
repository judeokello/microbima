-- ============================================
-- MESSAGING ROUTES & TEMPLATES SEED
-- ============================================
-- Single source for all messaging routes and templates.
-- Run during: deploy (staging/production) and local db seed (seed.ts).
--
-- To add more messaging:
--   - Append new route/template blocks below.
--   - Use INSERT ... ON CONFLICT DO UPDATE so the script is idempotent:
--     if the row does not exist it is created; if it exists it is updated.
--   - Routes: ON CONFLICT ("templateKey")
--   - Templates: ON CONFLICT ("templateKey", "channel", "language")
-- ============================================

-- ---------- Route: customer_created (SMS only) ----------
INSERT INTO messaging_routes ("templateKey", "smsEnabled", "emailEnabled", "isActive", "createdAt", "updatedAt")
VALUES ('customer_created', true, false, true, NOW(), NOW())
ON CONFLICT ("templateKey") DO UPDATE
SET "smsEnabled"   = EXCLUDED."smsEnabled",
    "emailEnabled" = EXCLUDED."emailEnabled",
    "isActive"     = EXCLUDED."isActive",
    "updatedAt"    = NOW();

-- ---------- Template: customer_created, SMS, en ----------
INSERT INTO messaging_templates (
  id,
  "templateKey",
  "channel",
  "language",
  "subject",
  "body",
  "textBody",
  "placeholders",
  "isActive",
  "createdAt",
  "updatedAt"
)
VALUES (
  gen_random_uuid(),
  'customer_created',
  'SMS',
  'en',
  NULL,
  'Hi {first_name} {last_name}, welcome. Your MaishaPoa insurance policy has been activated. We will contact you at {email} if needed.',
  NULL,
  ARRAY['first_name', 'last_name', 'email'],
  true,
  NOW(),
  NOW()
)
ON CONFLICT ("templateKey", "channel", "language") DO UPDATE
SET "body"         = EXCLUDED."body",
    "placeholders" = EXCLUDED."placeholders",
    "isActive"     = EXCLUDED."isActive",
    "updatedAt"    = NOW();

-- ---------- Add more routes and templates below (same pattern) ----------
