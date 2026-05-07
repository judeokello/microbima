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
-- FR-005a: single bundled welcome — OTP + personal portal link + both support numbers.
-- Placeholders: {first_name}, {last_name}, {otp}, {customer_specific_weblogin},
--               {general_support_number}, {medical_support_number}
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
  'Welcome to MaishaPoa, {first_name}! Your one-time PIN is {otp}. Sign in at {customer_specific_weblogin}. General support: {general_support_number}. Medical support: {medical_support_number}.',
  NULL,
  ARRAY['first_name', 'last_name', 'otp', 'customer_specific_weblogin', 'general_support_number', 'medical_support_number'],
  true,
  NOW(),
  NOW()
)
ON CONFLICT ("templateKey", "channel", "language") DO UPDATE
SET "body"         = EXCLUDED."body",
    "placeholders" = EXCLUDED."placeholders",
    "isActive"     = EXCLUDED."isActive",
    "updatedAt"    = NOW();

-- ---------- Route: portal_pin_setup_complete (SMS only) ----------
INSERT INTO messaging_routes ("templateKey", "smsEnabled", "emailEnabled", "isActive", "createdAt", "updatedAt")
VALUES ('portal_pin_setup_complete', true, false, true, NOW(), NOW())
ON CONFLICT ("templateKey") DO UPDATE
SET "smsEnabled"   = EXCLUDED."smsEnabled",
    "emailEnabled" = EXCLUDED."emailEnabled",
    "isActive"     = EXCLUDED."isActive",
    "updatedAt"    = NOW();

-- ---------- Template: portal_pin_setup_complete, SMS, en ----------
-- FR-018 / US3-AC5: follow-up after PIN setup — personal link only, no OTP.
-- Placeholders: {first_name}, {customer_specific_weblogin}
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
  'portal_pin_setup_complete',
  'SMS',
  'en',
  NULL,
  'Hi {first_name}, your MaishaPoa portal PIN has been set. Sign in anytime at {customer_specific_weblogin}.',
  NULL,
  ARRAY['first_name', 'customer_specific_weblogin'],
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
