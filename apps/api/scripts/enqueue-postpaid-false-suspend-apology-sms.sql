-- =============================================================================
-- Enqueue apology SMS for false postpaid suspensions (exclude Sharon)
-- =============================================================================
--
-- Message (Draft B):
--   Dear {first_name}, we apologise for the mistaken suspension message.
--   Your benefits were available then and remain available now.
--   For help call {general_support_number}.
--
-- Audience: ACTIVE live policies on schemes 2 / 8 / 9, excluding Sharon
--   (idNumber 36783633). Expected ~30 rows.
--
-- How it works:
--   1) Ensures messaging template + SMS route exist
--   2) Inserts messaging_deliveries status=PENDING (empty renderedBody)
--   3) Worker renders {first_name} from customer + support number from
--      enqueuePlaceholderContext, then sends
--
-- HOW TO RUN:
--   1. Run STEP 0 (template/route) once — safe to re-run
--   2. Run STEP 1 preview — confirm 30 people, phones look right
--   3. Uncomment STEP 2 and run once
--   4. Run STEP 3 verification (PENDING / SENT counts)
--
--   psql $DATABASE_URL -f apps/api/scripts/enqueue-postpaid-false-suspend-apology-sms.sql
-- =============================================================================

-- Template key for this one-off / reusable ops message
-- (do not reuse policy_reactivated — that thanks them for a payment)


-- ── STEP 0: Ensure template + route ─────────────────────────────────────────

INSERT INTO messaging_routes ("templateKey", "smsEnabled", "emailEnabled", "isActive", "createdAt", "updatedAt")
VALUES ('postpaid_false_suspend_apology', true, false, true, NOW(), NOW())
ON CONFLICT ("templateKey") DO UPDATE
SET
  "smsEnabled" = true,
  "emailEnabled" = false,
  "isActive" = true,
  "updatedAt" = NOW();

INSERT INTO messaging_templates (
  id, "templateKey", channel, language, subject, body, "textBody",
  placeholders, "isActive", "createdAt", "updatedAt"
)
VALUES (
  gen_random_uuid(),
  'postpaid_false_suspend_apology',
  'SMS',
  'en',
  NULL,
  'Dear {first_name}, we apologise for the mistaken suspension message. Your benefits were available then and remain available now. For help call {general_support_number}.',
  NULL,
  ARRAY['first_name', 'general_support_number'],
  true,
  NOW(),
  NOW()
)
ON CONFLICT ("templateKey", channel, language) DO UPDATE
SET
  body = EXCLUDED.body,
  placeholders = EXCLUDED.placeholders,
  "isActive" = true,
  "updatedAt" = NOW();


-- ── STEP 1: Preview audience ────────────────────────────────────────────────

WITH config AS (
  SELECT
    ARRAY[2, 8, 9]::int[] AS scheme_ids,
    '36783633'::text AS exclude_id_number, -- Sharon Ng'etich
    COALESCE(
      (
        SELECT NULLIF(TRIM(BOTH '"' FROM value::text), '')
        FROM system_settings
        WHERE key = 'general_support_number'
      ),
      '0746907934'
    ) AS support_number
),
audience AS (
  SELECT
    s.id AS scheme_id,
    s."schemeName",
    c.id AS customer_id,
    TRIM(c."firstName") AS first_name,
    c."lastName",
    c."idNumber",
    c."phoneNumber",
    p.id AS policy_id,
    p."policyNumber",
    p.status AS policy_status,
    cfg.support_number,
    'Dear ' || TRIM(c."firstName") ||
      ', we apologise for the mistaken suspension message. Your benefits were available then and remain available now. For help call ' ||
      cfg.support_number || '.' AS sample_rendered_body
  FROM config cfg
  INNER JOIN schemes s ON s.id = ANY (cfg.scheme_ids)
  INNER JOIN package_schemes ps ON ps."schemeId" = s.id
  INNER JOIN package_scheme_customers psc ON psc."packageSchemeId" = ps.id
  INNER JOIN customers c ON c.id = psc."customerId"
  INNER JOIN policies p ON p."customerId" = c.id
    AND p."packageId" = ps."packageId"
    AND p.status = 'ACTIVE'
    AND p."supersededByPolicyId" IS NULL
  WHERE c."idNumber" <> cfg.exclude_id_number
)
SELECT
  scheme_id,
  "schemeName",
  first_name,
  "lastName",
  "idNumber",
  "phoneNumber",
  policy_id,
  "policyNumber",
  CASE
    WHEN "phoneNumber" IS NULL OR TRIM("phoneNumber") = '' THEN 'MISSING_PHONE'
    ELSE 'OK'
  END AS phone_status,
  sample_rendered_body,
  LENGTH(sample_rendered_body) AS sms_char_count
FROM audience
ORDER BY scheme_id, "lastName", first_name;

-- Summary
WITH config AS (
  SELECT
    ARRAY[2, 8, 9]::int[] AS scheme_ids,
    '36783633'::text AS exclude_id_number
)
SELECT
  COUNT(*) AS audience_count,
  COUNT(*) FILTER (
    WHERE c."phoneNumber" IS NULL OR TRIM(c."phoneNumber") = ''
  ) AS missing_phone_count
FROM config cfg
INNER JOIN schemes s ON s.id = ANY (cfg.scheme_ids)
INNER JOIN package_schemes ps ON ps."schemeId" = s.id
INNER JOIN package_scheme_customers psc ON psc."packageSchemeId" = ps.id
INNER JOIN customers c ON c.id = psc."customerId"
INNER JOIN policies p ON p."customerId" = c.id
  AND p."packageId" = ps."packageId"
  AND p.status = 'ACTIVE'
  AND p."supersededByPolicyId" IS NULL
WHERE c."idNumber" <> cfg.exclude_id_number;


-- ── STEP 2: Enqueue PENDING deliveries (uncomment after preview) ────────────
-- Idempotent for this correlationId: skips if already inserted.

/*
BEGIN;

WITH config AS (
  SELECT
    ARRAY[2, 8, 9]::int[] AS scheme_ids,
    '36783633'::text AS exclude_id_number,
    'ops-postpaid-false-suspend-apology-2026-08-18'::varchar(100) AS correlation_id,
    COALESCE(
      (
        SELECT NULLIF(TRIM(BOTH '"' FROM value::text), '')
        FROM system_settings
        WHERE key = 'general_support_number'
      ),
      '0746907934'
    ) AS support_number,
    COALESCE(
      (
        SELECT NULLIF(TRIM(BOTH '"' FROM value::text), '')::int
        FROM system_settings
        WHERE key = 'smsMaxAttempts'
      ),
      2
    ) AS max_attempts
),
audience AS (
  SELECT
    c.id AS customer_id,
    p.id AS policy_id,
    NULLIF(TRIM(c."phoneNumber"), '') AS phone,
    cfg.support_number,
    cfg.correlation_id,
    cfg.max_attempts
  FROM config cfg
  INNER JOIN schemes s ON s.id = ANY (cfg.scheme_ids)
  INNER JOIN package_schemes ps ON ps."schemeId" = s.id
  INNER JOIN package_scheme_customers psc ON psc."packageSchemeId" = ps.id
  INNER JOIN customers c ON c.id = psc."customerId"
  INNER JOIN policies p ON p."customerId" = c.id
    AND p."packageId" = ps."packageId"
    AND p.status = 'ACTIVE'
    AND p."supersededByPolicyId" IS NULL
  WHERE c."idNumber" <> cfg.exclude_id_number
),
inserted AS (
  INSERT INTO messaging_deliveries (
    id,
    "templateKey",
    channel,
    "customerId",
    "policyId",
    "recipientPhone",
    "recipientEmail",
    "requestedLanguage",
    "renderedBody",
    status,
    "attemptCount",
    "maxAttempts",
    "correlationId",
    "enqueuePlaceholderContext",
    "createdAt",
    "updatedAt",
    "createdBy"
  )
  SELECT
    gen_random_uuid(),
    'postpaid_false_suspend_apology',
    'SMS',
    a.customer_id,
    a.policy_id,
    a.phone,
    NULL,
    'en',
    '', -- worker renders from template + customer first_name + context
    CASE
      WHEN a.phone IS NULL THEN 'FAILED'::"MessagingDeliveryStatus"
      ELSE 'PENDING'::"MessagingDeliveryStatus"
    END,
    0,
    a.max_attempts,
    a.correlation_id,
    jsonb_build_object('general_support_number', a.support_number),
    NOW(),
    NOW(),
    'ops-sql-false-suspend-apology'
  FROM audience a
  WHERE NOT EXISTS (
    SELECT 1
    FROM messaging_deliveries d
    WHERE d."correlationId" = a.correlation_id
      AND d."customerId" = a.customer_id
      AND d."policyId" = a.policy_id
      AND d."templateKey" = 'postpaid_false_suspend_apology'
  )
  RETURNING id, status, "customerId", "recipientPhone"
)
SELECT
  COUNT(*) AS rows_inserted,
  COUNT(*) FILTER (WHERE status = 'PENDING') AS pending_to_send,
  COUNT(*) FILTER (WHERE status = 'FAILED') AS failed_missing_phone
FROM inserted;

COMMIT;
*/


-- ── STEP 3: Verification ────────────────────────────────────────────────────

SELECT
  status,
  COUNT(*) AS n
FROM messaging_deliveries
WHERE "correlationId" = 'ops-postpaid-false-suspend-apology-2026-08-18'
  AND "templateKey" = 'postpaid_false_suspend_apology'
GROUP BY status
ORDER BY status;

SELECT
  d.status,
  c."firstName",
  c."lastName",
  c."idNumber",
  d."recipientPhone",
  d."renderedBody",
  d."lastError",
  d."createdAt"
FROM messaging_deliveries d
LEFT JOIN customers c ON c.id = d."customerId"
WHERE d."correlationId" = 'ops-postpaid-false-suspend-apology-2026-08-18'
ORDER BY d.status, c."lastName", c."firstName";
