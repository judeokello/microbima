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

-- ---------- Route: portal_legacy_announcement (SMS only) ----------
-- Pre-notification for legacy cohort before OTP welcome (T042 step 1).
INSERT INTO messaging_routes ("templateKey", "smsEnabled", "emailEnabled", "isActive", "createdAt", "updatedAt")
VALUES ('portal_legacy_announcement', true, false, true, NOW(), NOW())
ON CONFLICT ("templateKey") DO UPDATE
SET "smsEnabled"   = EXCLUDED."smsEnabled",
    "emailEnabled" = EXCLUDED."emailEnabled",
    "isActive"     = EXCLUDED."isActive",
    "updatedAt"    = NOW();

-- ---------- Template: portal_legacy_announcement, SMS, en ----------
-- Legacy migration step 1: alert members about the new portal before OTP/login SMS.
-- Placeholders: {first_name}, {last_name}
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
  'portal_legacy_announcement',
  'SMS',
  'en',
  NULL,
  'Dear {first_name} {last_name}, MaishaPoa now has a website that you can use to view your account details like payments made, pending payments and your hospital access cards. You will receive a message shortly with login details. We appreciate working with you.',
  NULL,
  ARRAY['first_name', 'last_name'],
  true,
  NOW(),
  NOW()
)
ON CONFLICT ("templateKey", "channel", "language") DO UPDATE
SET "body"         = EXCLUDED."body",
    "placeholders" = EXCLUDED."placeholders",
    "isActive"     = EXCLUDED."isActive",
    "updatedAt"    = NOW();

-- ---------- Payment received SMS templates ----------

INSERT INTO messaging_routes ("templateKey", "smsEnabled", "emailEnabled", "isActive", "createdAt", "updatedAt")
VALUES ('payment_received_activation', true, false, true, NOW(), NOW())
ON CONFLICT ("templateKey") DO UPDATE
SET "smsEnabled" = EXCLUDED."smsEnabled", "emailEnabled" = EXCLUDED."emailEnabled", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

INSERT INTO messaging_templates (id, "templateKey", "channel", "language", "subject", "body", "textBody", "placeholders", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(), 'payment_received_activation', 'SMS', 'en', NULL,
  'Dear {first_name}, we have received your payment of {amount} and {payment_type} reference number {payment_reference}. Your {product_name} policy number is {policy_number} and it is now active. Your {scheme_waiting_period} day waiting period starts today and you can access treatment from {waiting_period_end_date}. Thank you',
  NULL,
  ARRAY['first_name', 'amount', 'payment_type', 'payment_reference', 'product_name', 'policy_number', 'scheme_waiting_period', 'waiting_period_end_date'],
  true, NOW(), NOW()
)
ON CONFLICT ("templateKey", "channel", "language") DO UPDATE
SET "body" = EXCLUDED."body", "placeholders" = EXCLUDED."placeholders", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

INSERT INTO messaging_routes ("templateKey", "smsEnabled", "emailEnabled", "isActive", "createdAt", "updatedAt")
VALUES ('payment_received_activation_pending_receipt', true, false, true, NOW(), NOW())
ON CONFLICT ("templateKey") DO UPDATE
SET "smsEnabled" = EXCLUDED."smsEnabled", "emailEnabled" = EXCLUDED."emailEnabled", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

INSERT INTO messaging_templates (id, "templateKey", "channel", "language", "subject", "body", "textBody", "placeholders", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(), 'payment_received_activation_pending_receipt', 'SMS', 'en', NULL,
  'Dear {first_name}, we have received your {payment_type} payment of {amount}. Your {product_name} policy number is {policy_number} and it is now active. Your {scheme_waiting_period} day waiting period starts today and you can access treatment from {waiting_period_end_date}. Thank you',
  NULL,
  ARRAY['first_name', 'amount', 'payment_type', 'product_name', 'policy_number', 'scheme_waiting_period', 'waiting_period_end_date'],
  true, NOW(), NOW()
)
ON CONFLICT ("templateKey", "channel", "language") DO UPDATE
SET "body" = EXCLUDED."body", "placeholders" = EXCLUDED."placeholders", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

INSERT INTO messaging_routes ("templateKey", "smsEnabled", "emailEnabled", "isActive", "createdAt", "updatedAt")
VALUES ('payment_received', true, false, true, NOW(), NOW())
ON CONFLICT ("templateKey") DO UPDATE
SET "smsEnabled" = EXCLUDED."smsEnabled", "emailEnabled" = EXCLUDED."emailEnabled", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

INSERT INTO messaging_templates (id, "templateKey", "channel", "language", "subject", "body", "textBody", "placeholders", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(), 'payment_received', 'SMS', 'en', NULL,
  'Dear {first_name}, we have received your {product_name} payment of {amount} and {payment_type} reference number is {payment_reference}. Thank you',
  NULL,
  ARRAY['first_name', 'product_name', 'amount', 'payment_type', 'payment_reference'],
  true, NOW(), NOW()
)
ON CONFLICT ("templateKey", "channel", "language") DO UPDATE
SET "body" = EXCLUDED."body", "placeholders" = EXCLUDED."placeholders", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

INSERT INTO messaging_routes ("templateKey", "smsEnabled", "emailEnabled", "isActive", "createdAt", "updatedAt")
VALUES ('payment_received_pending_receipt', true, false, true, NOW(), NOW())
ON CONFLICT ("templateKey") DO UPDATE
SET "smsEnabled" = EXCLUDED."smsEnabled", "emailEnabled" = EXCLUDED."emailEnabled", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

INSERT INTO messaging_templates (id, "templateKey", "channel", "language", "subject", "body", "textBody", "placeholders", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(), 'payment_received_pending_receipt', 'SMS', 'en', NULL,
  'Dear {first_name}, we have received payment for your {product_name} insurance package from {payment_type}. Payment amount is {amount}. Thank you',
  NULL,
  ARRAY['first_name', 'product_name', 'payment_type', 'amount'],
  true, NOW(), NOW()
)
ON CONFLICT ("templateKey", "channel", "language") DO UPDATE
SET "body" = EXCLUDED."body", "placeholders" = EXCLUDED."placeholders", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

INSERT INTO messaging_routes ("templateKey", "smsEnabled", "emailEnabled", "isActive", "createdAt", "updatedAt")
VALUES ('payment_received_unmatched', true, false, true, NOW(), NOW())
ON CONFLICT ("templateKey") DO UPDATE
SET "smsEnabled" = EXCLUDED."smsEnabled", "emailEnabled" = EXCLUDED."emailEnabled", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

INSERT INTO messaging_templates (id, "templateKey", "channel", "language", "subject", "body", "textBody", "placeholders", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(), 'payment_received_unmatched', 'SMS', 'en', NULL,
  'Dear {first_name} {last_name}, MaishaPoa has received your payment. The {amount} {payment_type} reference is {payment_reference}. Please call {general_support_number} to ensure receipting of your payment',
  NULL,
  ARRAY['first_name', 'last_name', 'amount', 'payment_type', 'payment_reference', 'general_support_number'],
  true, NOW(), NOW()
)
ON CONFLICT ("templateKey", "channel", "language") DO UPDATE
SET "body" = EXCLUDED."body", "placeholders" = EXCLUDED."placeholders", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

INSERT INTO messaging_routes ("templateKey", "smsEnabled", "emailEnabled", "isActive", "createdAt", "updatedAt")
VALUES ('payment_remapped', true, false, true, NOW(), NOW())
ON CONFLICT ("templateKey") DO UPDATE
SET "smsEnabled" = EXCLUDED."smsEnabled", "emailEnabled" = EXCLUDED."emailEnabled", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

INSERT INTO messaging_templates (id, "templateKey", "channel", "language", "subject", "body", "textBody", "placeholders", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(), 'payment_remapped', 'SMS', 'en', NULL,
  'Dear {first_name}, your M-Pesa payment(s) totaling {amount} have been applied to your policy {policy_number}. For support call {general_support_number}. Thank you',
  NULL,
  ARRAY['first_name', 'amount', 'policy_number', 'general_support_number'],
  true, NOW(), NOW()
)
ON CONFLICT ("templateKey", "channel", "language") DO UPDATE
SET "body" = EXCLUDED."body", "placeholders" = EXCLUDED."placeholders", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

-- ---------- Pending activation reminders (D3 / D7 only; day-0 = customer_created) ----------

INSERT INTO messaging_routes ("templateKey", "smsEnabled", "emailEnabled", "isActive", "createdAt", "updatedAt")
VALUES ('pending_activation_d3', true, false, true, NOW(), NOW())
ON CONFLICT ("templateKey") DO UPDATE
SET "smsEnabled" = EXCLUDED."smsEnabled", "emailEnabled" = EXCLUDED."emailEnabled", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

INSERT INTO messaging_templates (id, "templateKey", "channel", "language", "subject", "body", "textBody", "placeholders", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(), 'pending_activation_d3', 'SMS', 'en', NULL,
  'Dear {first_name}, your {product_name} cover is still pending activation. Please complete your first premium payment to activate your policy. For help call {general_support_number}.',
  NULL,
  ARRAY['first_name', 'product_name', 'general_support_number'],
  true, NOW(), NOW()
)
ON CONFLICT ("templateKey", "channel", "language") DO UPDATE
SET "body" = EXCLUDED."body", "placeholders" = EXCLUDED."placeholders", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

INSERT INTO messaging_routes ("templateKey", "smsEnabled", "emailEnabled", "isActive", "createdAt", "updatedAt")
VALUES ('pending_activation_d7', true, false, true, NOW(), NOW())
ON CONFLICT ("templateKey") DO UPDATE
SET "smsEnabled" = EXCLUDED."smsEnabled", "emailEnabled" = EXCLUDED."emailEnabled", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

INSERT INTO messaging_templates (id, "templateKey", "channel", "language", "subject", "body", "textBody", "placeholders", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(), 'pending_activation_d7', 'SMS', 'en', NULL,
  'Dear {first_name}, this is a final reminder that your {product_name} cover is still pending activation. Pay your first premium to activate. For help call {general_support_number}.',
  NULL,
  ARRAY['first_name', 'product_name', 'general_support_number'],
  true, NOW(), NOW()
)
ON CONFLICT ("templateKey", "channel", "language") DO UPDATE
SET "body" = EXCLUDED."body", "placeholders" = EXCLUDED."placeholders", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

-- ---------- Grace period reminders ----------

INSERT INTO messaging_routes ("templateKey", "smsEnabled", "emailEnabled", "isActive", "createdAt", "updatedAt")
VALUES ('grace_due', true, false, true, NOW(), NOW())
ON CONFLICT ("templateKey") DO UPDATE
SET "smsEnabled" = EXCLUDED."smsEnabled", "emailEnabled" = EXCLUDED."emailEnabled", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

INSERT INTO messaging_templates (id, "templateKey", "channel", "language", "subject", "body", "textBody", "placeholders", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(), 'grace_due', 'SMS', 'en', NULL,
  'Dear {first_name}, your {product_name} premium of {amount_due} was due on {due_date}. Please pay to stay covered. Call {general_support_number} for help.',
  NULL,
  ARRAY['first_name', 'product_name', 'amount_due', 'due_date', 'general_support_number'],
  true, NOW(), NOW()
)
ON CONFLICT ("templateKey", "channel", "language") DO UPDATE
SET "body" = EXCLUDED."body", "placeholders" = EXCLUDED."placeholders", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

INSERT INTO messaging_routes ("templateKey", "smsEnabled", "emailEnabled", "isActive", "createdAt", "updatedAt")
VALUES ('grace_d7', true, false, true, NOW(), NOW())
ON CONFLICT ("templateKey") DO UPDATE
SET "smsEnabled" = EXCLUDED."smsEnabled", "emailEnabled" = EXCLUDED."emailEnabled", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

INSERT INTO messaging_templates (id, "templateKey", "channel", "language", "subject", "body", "textBody", "placeholders", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(), 'grace_d7', 'SMS', 'en', NULL,
  'Dear {first_name}, your {product_name} premium of {amount_due} is overdue (due {due_date}). Please pay soon to avoid suspension. Call {general_support_number}.',
  NULL,
  ARRAY['first_name', 'product_name', 'amount_due', 'due_date', 'general_support_number'],
  true, NOW(), NOW()
)
ON CONFLICT ("templateKey", "channel", "language") DO UPDATE
SET "body" = EXCLUDED."body", "placeholders" = EXCLUDED."placeholders", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

INSERT INTO messaging_routes ("templateKey", "smsEnabled", "emailEnabled", "isActive", "createdAt", "updatedAt")
VALUES ('grace_d10', true, false, true, NOW(), NOW())
ON CONFLICT ("templateKey") DO UPDATE
SET "smsEnabled" = EXCLUDED."smsEnabled", "emailEnabled" = EXCLUDED."emailEnabled", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

INSERT INTO messaging_templates (id, "templateKey", "channel", "language", "subject", "body", "textBody", "placeholders", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(), 'grace_d10', 'SMS', 'en', NULL,
  'Dear {first_name}, urgent: your {product_name} premium of {amount_due} (due {due_date}) is still unpaid. Pay now to keep cover. Call {general_support_number}.',
  NULL,
  ARRAY['first_name', 'product_name', 'amount_due', 'due_date', 'general_support_number'],
  true, NOW(), NOW()
)
ON CONFLICT ("templateKey", "channel", "language") DO UPDATE
SET "body" = EXCLUDED."body", "placeholders" = EXCLUDED."placeholders", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

INSERT INTO messaging_routes ("templateKey", "smsEnabled", "emailEnabled", "isActive", "createdAt", "updatedAt")
VALUES ('grace_d13', true, false, true, NOW(), NOW())
ON CONFLICT ("templateKey") DO UPDATE
SET "smsEnabled" = EXCLUDED."smsEnabled", "emailEnabled" = EXCLUDED."emailEnabled", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

INSERT INTO messaging_templates (id, "templateKey", "channel", "language", "subject", "body", "textBody", "placeholders", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(), 'grace_d13', 'SMS', 'en', NULL,
  'Dear {first_name}, final notice before suspension: pay {amount_due} for {product_name} (due {due_date}) today. Call {general_support_number}.',
  NULL,
  ARRAY['first_name', 'product_name', 'amount_due', 'due_date', 'general_support_number'],
  true, NOW(), NOW()
)
ON CONFLICT ("templateKey", "channel", "language") DO UPDATE
SET "body" = EXCLUDED."body", "placeholders" = EXCLUDED."placeholders", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

-- ---------- Suspension / reactivation SMS ----------

INSERT INTO messaging_routes ("templateKey", "smsEnabled", "emailEnabled", "isActive", "createdAt", "updatedAt")
VALUES ('policy_suspended', true, false, true, NOW(), NOW())
ON CONFLICT ("templateKey") DO UPDATE
SET "smsEnabled" = EXCLUDED."smsEnabled", "emailEnabled" = EXCLUDED."emailEnabled", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

INSERT INTO messaging_templates (id, "templateKey", "channel", "language", "subject", "body", "textBody", "placeholders", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(), 'policy_suspended', 'SMS', 'en', NULL,
  'Dear {first_name}, your {product_name} policy has been suspended due to unpaid premium of {amount_due}. Pay arrears plus 2 weeks to restore cover. Call {general_support_number}.',
  NULL,
  ARRAY['first_name', 'product_name', 'amount_due', 'general_support_number'],
  true, NOW(), NOW()
)
ON CONFLICT ("templateKey", "channel", "language") DO UPDATE
SET "body" = EXCLUDED."body", "placeholders" = EXCLUDED."placeholders", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

INSERT INTO messaging_routes ("templateKey", "smsEnabled", "emailEnabled", "isActive", "createdAt", "updatedAt")
VALUES ('policy_reactivated', true, false, true, NOW(), NOW())
ON CONFLICT ("templateKey") DO UPDATE
SET "smsEnabled" = EXCLUDED."smsEnabled", "emailEnabled" = EXCLUDED."emailEnabled", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

INSERT INTO messaging_templates (id, "templateKey", "channel", "language", "subject", "body", "textBody", "placeholders", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(), 'policy_reactivated', 'SMS', 'en', NULL,
  'Dear {first_name}, your {product_name} policy is active again. Thank you for your payment. Call {general_support_number} for help.',
  NULL,
  ARRAY['first_name', 'product_name', 'general_support_number'],
  true, NOW(), NOW()
)
ON CONFLICT ("templateKey", "channel", "language") DO UPDATE
SET "body" = EXCLUDED."body", "placeholders" = EXCLUDED."placeholders", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

INSERT INTO messaging_routes ("templateKey", "smsEnabled", "emailEnabled", "isActive", "createdAt", "updatedAt")
VALUES ('suspend_d1', true, false, true, NOW(), NOW())
ON CONFLICT ("templateKey") DO UPDATE
SET "smsEnabled" = EXCLUDED."smsEnabled", "emailEnabled" = EXCLUDED."emailEnabled", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

INSERT INTO messaging_templates (id, "templateKey", "channel", "language", "subject", "body", "textBody", "placeholders", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(), 'suspend_d1', 'SMS', 'en', NULL,
  'Dear {first_name}, your {product_name} policy remains suspended. Outstanding amount is {amount_due}. Call {general_support_number}.',
  NULL,
  ARRAY['first_name', 'product_name', 'amount_due', 'general_support_number'],
  true, NOW(), NOW()
)
ON CONFLICT ("templateKey", "channel", "language") DO UPDATE
SET "body" = EXCLUDED."body", "placeholders" = EXCLUDED."placeholders", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

INSERT INTO messaging_routes ("templateKey", "smsEnabled", "emailEnabled", "isActive", "createdAt", "updatedAt")
VALUES ('suspend_d7', true, false, true, NOW(), NOW())
ON CONFLICT ("templateKey") DO UPDATE
SET "smsEnabled" = EXCLUDED."smsEnabled", "emailEnabled" = EXCLUDED."emailEnabled", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

INSERT INTO messaging_templates (id, "templateKey", "channel", "language", "subject", "body", "textBody", "placeholders", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(), 'suspend_d7', 'SMS', 'en', NULL,
  'Dear {first_name}, reminder: {product_name} is suspended. Pay {amount_due} (arrears + 2 weeks) to restore. Call {general_support_number}.',
  NULL,
  ARRAY['first_name', 'product_name', 'amount_due', 'general_support_number'],
  true, NOW(), NOW()
)
ON CONFLICT ("templateKey", "channel", "language") DO UPDATE
SET "body" = EXCLUDED."body", "placeholders" = EXCLUDED."placeholders", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

INSERT INTO messaging_routes ("templateKey", "smsEnabled", "emailEnabled", "isActive", "createdAt", "updatedAt")
VALUES ('suspend_d13', true, false, true, NOW(), NOW())
ON CONFLICT ("templateKey") DO UPDATE
SET "smsEnabled" = EXCLUDED."smsEnabled", "emailEnabled" = EXCLUDED."emailEnabled", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

INSERT INTO messaging_templates (id, "templateKey", "channel", "language", "subject", "body", "textBody", "placeholders", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(), 'suspend_d13', 'SMS', 'en', NULL,
  'Dear {first_name}, final notice: {product_name} may become inactive soon. Pay {amount_due} to restore. Call {general_support_number}.',
  NULL,
  ARRAY['first_name', 'product_name', 'amount_due', 'general_support_number'],
  true, NOW(), NOW()
)
ON CONFLICT ("templateKey", "channel", "language") DO UPDATE
SET "body" = EXCLUDED."body", "placeholders" = EXCLUDED."placeholders", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

-- ---------- Inactive / renewal SMS ----------

INSERT INTO messaging_routes ("templateKey", "smsEnabled", "emailEnabled", "isActive", "createdAt", "updatedAt")
VALUES ('policy_inactive', true, false, true, NOW(), NOW())
ON CONFLICT ("templateKey") DO UPDATE
SET "smsEnabled" = EXCLUDED."smsEnabled", "emailEnabled" = EXCLUDED."emailEnabled", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

INSERT INTO messaging_templates (id, "templateKey", "channel", "language", "subject", "body", "textBody", "placeholders", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(), 'policy_inactive', 'SMS', 'en', NULL,
  'Dear {first_name}, your {product_name} policy is now inactive due to prolonged non-payment. Pay to restore cover. Call {general_support_number}.',
  NULL,
  ARRAY['first_name', 'product_name', 'general_support_number'],
  true, NOW(), NOW()
)
ON CONFLICT ("templateKey", "channel", "language") DO UPDATE
SET "body" = EXCLUDED."body", "placeholders" = EXCLUDED."placeholders", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

INSERT INTO messaging_routes ("templateKey", "smsEnabled", "emailEnabled", "isActive", "createdAt", "updatedAt")
VALUES ('policy_renewed', true, false, true, NOW(), NOW())
ON CONFLICT ("templateKey") DO UPDATE
SET "smsEnabled" = EXCLUDED."smsEnabled", "emailEnabled" = EXCLUDED."emailEnabled", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

INSERT INTO messaging_templates (id, "templateKey", "channel", "language", "subject", "body", "textBody", "placeholders", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(), 'policy_renewed', 'SMS', 'en', NULL,
  'Dear {first_name}, your {product_name} cover has been renewed. Thank you. Call {general_support_number} for help.',
  NULL,
  ARRAY['first_name', 'product_name', 'general_support_number'],
  true, NOW(), NOW()
)
ON CONFLICT ("templateKey", "channel", "language") DO UPDATE
SET "body" = EXCLUDED."body", "placeholders" = EXCLUDED."placeholders", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

-- ---------- Terminate SMS ----------

INSERT INTO messaging_routes ("templateKey", "smsEnabled", "emailEnabled", "isActive", "createdAt", "updatedAt")
VALUES ('policy_terminated', true, false, true, NOW(), NOW())
ON CONFLICT ("templateKey") DO UPDATE
SET "smsEnabled" = EXCLUDED."smsEnabled", "emailEnabled" = EXCLUDED."emailEnabled", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

INSERT INTO messaging_templates (id, "templateKey", "channel", "language", "subject", "body", "textBody", "placeholders", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(), 'policy_terminated', 'SMS', 'en', NULL,
  'Dear {first_name}, your {product_name} policy has been terminated. Call {general_support_number} if you have questions.',
  NULL,
  ARRAY['first_name', 'product_name', 'general_support_number'],
  true, NOW(), NOW()
)
ON CONFLICT ("templateKey", "channel", "language") DO UPDATE
SET "body" = EXCLUDED."body", "placeholders" = EXCLUDED."placeholders", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

-- ---------- Renewal reminder schedule templates ----------

INSERT INTO messaging_routes ("templateKey", "smsEnabled", "emailEnabled", "isActive", "createdAt", "updatedAt")
VALUES ('renewal_reminder', true, false, true, NOW(), NOW())
ON CONFLICT ("templateKey") DO UPDATE
SET "smsEnabled" = EXCLUDED."smsEnabled", "emailEnabled" = EXCLUDED."emailEnabled", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();

INSERT INTO messaging_templates (id, "templateKey", "channel", "language", "subject", "body", "textBody", "placeholders", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(), 'renewal_reminder', 'SMS', 'en', NULL,
  'Dear {first_name}, your {product_name} cover {renewal_message}. Call {general_support_number} to renew.',
  NULL,
  ARRAY['first_name', 'product_name', 'renewal_message', 'general_support_number'],
  true, NOW(), NOW()
)
ON CONFLICT ("templateKey", "channel", "language") DO UPDATE
SET "body" = EXCLUDED."body", "placeholders" = EXCLUDED."placeholders", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW();
