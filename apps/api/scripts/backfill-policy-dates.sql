-- =============================================================================
-- Backfill policy startDate / endDate
-- =============================================================================
--
-- PREPAID:
--   new_start = earliest completed payment on the policy
--   new_end   = new_start + 1 year - 1 day
--
-- POSTPAID:
--   Bulk scheme payments may predate enrollment or exclude a member entirely.
--   Only payments from CSV uploads where THIS member had a row count.
--   new_start = earliest actualPaymentDate on policy_payments that have a
--               postpaid_scheme_payment_item (first bulk upload they contributed to)
--   new_end   = new_start + 1 year - 1 day
--
-- HOW TO RUN: STEP 1 preview → STEP 2 counts → STEP 3 update (uncomment)
-- =============================================================================


-- ── STEP 1: Preview ─────────────────────────────────────────────────────────

WITH prepaid_first AS (
  SELECT pp."policyId", MIN(pp."actualPaymentDate") AS first_payment
  FROM policy_payments pp
  WHERE pp."actualPaymentDate" IS NOT NULL
  GROUP BY pp."policyId"
),
postpaid_first AS (
  SELECT pp."policyId", MIN(pp."actualPaymentDate") AS first_payment
  FROM policy_payments pp
  INNER JOIN postpaid_scheme_payment_items pspi ON pspi."policyPaymentId" = pp.id
  WHERE pp."actualPaymentDate" IS NOT NULL
  GROUP BY pp."policyId"
),
postpaid_policies AS (
  SELECT DISTINCT p.id AS policy_id
  FROM policies p
  INNER JOIN package_scheme_customers psc ON psc."customerId" = p."customerId"
  INNER JOIN package_schemes ps ON ps.id = psc."packageSchemeId" AND ps."packageId" = p."packageId"
  INNER JOIN schemes s ON s.id = ps."schemeId" AND s."isPostpaid" = TRUE
),
computed AS (
  SELECT
    p.id,
    p."policyNumber",
    p.status,
    p."createdAt" AS policy_created_at,
    (pp.policy_id IS NOT NULL) AS is_postpaid,
    p."startDate" AS current_start,
    p."endDate" AS current_end,
    CASE
      WHEN pp.policy_id IS NOT NULL THEN pf.first_payment
      ELSE pr.first_payment
    END AS first_contributing_payment,
    CASE
      WHEN pp.policy_id IS NOT NULL THEN pf.first_payment
      ELSE pr.first_payment
    END AS new_start,
    CASE
      WHEN pp.policy_id IS NOT NULL THEN pf.first_payment + INTERVAL '1 year' - INTERVAL '1 day'
      ELSE pr.first_payment + INTERVAL '1 year' - INTERVAL '1 day'
    END AS new_end
  FROM policies p
  LEFT JOIN postpaid_policies pp ON pp.policy_id = p.id
  LEFT JOIN prepaid_first pr ON pr."policyId" = p.id AND pp.policy_id IS NULL
  LEFT JOIN postpaid_first pf ON pf."policyId" = p.id AND pp.policy_id IS NOT NULL
  WHERE (pp.policy_id IS NULL AND pr.first_payment IS NOT NULL)
     OR (pp.policy_id IS NOT NULL AND pf.first_payment IS NOT NULL)
)
SELECT
  id,
  "policyNumber",
  status,
  is_postpaid,
  policy_created_at,
  first_contributing_payment,
  current_start,
  new_start,
  current_end,
  new_end,
  CASE
    WHEN current_start IS NULL AND current_end IS NULL THEN 'missing both dates'
    WHEN current_start IS NULL THEN 'missing startDate'
    WHEN current_end IS NULL THEN 'missing endDate'
    WHEN is_postpaid THEN 'postpaid: first bulk-upload contribution'
    WHEN current_start IS DISTINCT FROM new_start
     AND current_end IS DISTINCT FROM new_end THEN 'wrong start and end'
    WHEN current_start IS DISTINCT FROM new_start THEN 'wrong startDate'
    ELSE 'wrong endDate'
  END AS change_reason
FROM computed
WHERE current_start IS DISTINCT FROM new_start
   OR current_end IS DISTINCT FROM new_end
ORDER BY is_postpaid DESC, "policyNumber";


-- ── STEP 1b: Postpaid diagnostic — where bulk-only rule differs from all-payments MIN
-- Run this to confirm postpaid logic has effect. Zero rows = every postpaid policy's
-- earliest payment is already from a bulk CSV row (same result as old single-MIN script).

WITH postpaid_policies AS (
  SELECT DISTINCT p.id AS policy_id, p."policyNumber"
  FROM policies p
  INNER JOIN package_scheme_customers psc ON psc."customerId" = p."customerId"
  INNER JOIN package_schemes ps ON ps.id = psc."packageSchemeId" AND ps."packageId" = p."packageId"
  INNER JOIN schemes s ON s.id = ps."schemeId" AND s."isPostpaid" = TRUE
),
all_payments_min AS (
  SELECT pp."policyId", MIN(pp."actualPaymentDate") AS first_payment
  FROM policy_payments pp
  WHERE pp."actualPaymentDate" IS NOT NULL
  GROUP BY pp."policyId"
),
bulk_only_min AS (
  SELECT pp."policyId", MIN(pp."actualPaymentDate") AS first_payment
  FROM policy_payments pp
  INNER JOIN postpaid_scheme_payment_items pspi ON pspi."policyPaymentId" = pp.id
  WHERE pp."actualPaymentDate" IS NOT NULL
  GROUP BY pp."policyId"
),
non_bulk_payments AS (
  SELECT pp."policyId", COUNT(*) AS non_bulk_count
  FROM policy_payments pp
  LEFT JOIN postpaid_scheme_payment_items pspi ON pspi."policyPaymentId" = pp.id
  WHERE pp."actualPaymentDate" IS NOT NULL AND pspi.id IS NULL
  GROUP BY pp."policyId"
)
SELECT
  pp."policyNumber",
  pp.policy_id,
  ap.first_payment AS old_rule_min_all_payments,
  bo.first_payment AS new_rule_min_bulk_only,
  nb.non_bulk_count AS payments_without_bulk_link
FROM postpaid_policies pp
LEFT JOIN all_payments_min ap ON ap."policyId" = pp.policy_id
LEFT JOIN bulk_only_min bo ON bo."policyId" = pp.policy_id
LEFT JOIN non_bulk_payments nb ON nb."policyId" = pp.policy_id
WHERE ap.first_payment IS DISTINCT FROM bo.first_payment
   OR bo.first_payment IS NULL
ORDER BY pp."policyNumber";


-- ── STEP 2: Summary counts ──────────────────────────────────────────────────

WITH prepaid_first AS (
  SELECT pp."policyId", MIN(pp."actualPaymentDate") AS first_payment
  FROM policy_payments pp
  WHERE pp."actualPaymentDate" IS NOT NULL
  GROUP BY pp."policyId"
),
postpaid_first AS (
  SELECT pp."policyId", MIN(pp."actualPaymentDate") AS first_payment
  FROM policy_payments pp
  INNER JOIN postpaid_scheme_payment_items pspi ON pspi."policyPaymentId" = pp.id
  WHERE pp."actualPaymentDate" IS NOT NULL
  GROUP BY pp."policyId"
),
postpaid_policies AS (
  SELECT DISTINCT p.id AS policy_id
  FROM policies p
  INNER JOIN package_scheme_customers psc ON psc."customerId" = p."customerId"
  INNER JOIN package_schemes ps ON ps.id = psc."packageSchemeId" AND ps."packageId" = p."packageId"
  INNER JOIN schemes s ON s.id = ps."schemeId" AND s."isPostpaid" = TRUE
),
computed AS (
  SELECT
    p.id,
    (pp.policy_id IS NOT NULL) AS is_postpaid,
    p."startDate" AS current_start,
    p."endDate" AS current_end,
    CASE WHEN pp.policy_id IS NOT NULL THEN pf.first_payment ELSE pr.first_payment END AS new_start,
    CASE
      WHEN pp.policy_id IS NOT NULL THEN pf.first_payment + INTERVAL '1 year' - INTERVAL '1 day'
      ELSE pr.first_payment + INTERVAL '1 year' - INTERVAL '1 day'
    END AS new_end
  FROM policies p
  LEFT JOIN postpaid_policies pp ON pp.policy_id = p.id
  LEFT JOIN prepaid_first pr ON pr."policyId" = p.id AND pp.policy_id IS NULL
  LEFT JOIN postpaid_first pf ON pf."policyId" = p.id AND pp.policy_id IS NOT NULL
  WHERE (pp.policy_id IS NULL AND pr.first_payment IS NOT NULL)
     OR (pp.policy_id IS NOT NULL AND pf.first_payment IS NOT NULL)
)
SELECT
  COUNT(*) AS policies_in_scope,
  COUNT(*) FILTER (WHERE is_postpaid) AS postpaid_in_scope,
  COUNT(*) FILTER (
    WHERE current_start IS DISTINCT FROM new_start OR current_end IS DISTINCT FROM new_end
  ) AS policies_needing_update
FROM computed;


-- ── STEP 3: Apply (uncomment after preview) ─────────────────────────────────

/*
BEGIN;

WITH prepaid_first AS (
  SELECT pp."policyId", MIN(pp."actualPaymentDate") AS first_payment
  FROM policy_payments pp
  WHERE pp."actualPaymentDate" IS NOT NULL
  GROUP BY pp."policyId"
),
postpaid_first AS (
  SELECT pp."policyId", MIN(pp."actualPaymentDate") AS first_payment
  FROM policy_payments pp
  INNER JOIN postpaid_scheme_payment_items pspi ON pspi."policyPaymentId" = pp.id
  WHERE pp."actualPaymentDate" IS NOT NULL
  GROUP BY pp."policyId"
),
postpaid_policies AS (
  SELECT DISTINCT p.id AS policy_id
  FROM policies p
  INNER JOIN package_scheme_customers psc ON psc."customerId" = p."customerId"
  INNER JOIN package_schemes ps ON ps.id = psc."packageSchemeId" AND ps."packageId" = p."packageId"
  INNER JOIN schemes s ON s.id = ps."schemeId" AND s."isPostpaid" = TRUE
),
computed AS (
  SELECT
    p.id,
    CASE WHEN pp.policy_id IS NOT NULL THEN pf.first_payment ELSE pr.first_payment END AS new_start,
    CASE
      WHEN pp.policy_id IS NOT NULL THEN pf.first_payment + INTERVAL '1 year' - INTERVAL '1 day'
      ELSE pr.first_payment + INTERVAL '1 year' - INTERVAL '1 day'
    END AS new_end
  FROM policies p
  LEFT JOIN postpaid_policies pp ON pp.policy_id = p.id
  LEFT JOIN prepaid_first pr ON pr."policyId" = p.id AND pp.policy_id IS NULL
  LEFT JOIN postpaid_first pf ON pf."policyId" = p.id AND pp.policy_id IS NOT NULL
  WHERE (pp.policy_id IS NULL AND pr.first_payment IS NOT NULL)
     OR (pp.policy_id IS NOT NULL AND pf.first_payment IS NOT NULL)
)
UPDATE policies p
SET
  "startDate" = c.new_start,
  "endDate"   = c.new_end,
  "updatedAt" = NOW()
FROM computed c
WHERE p.id = c.id
  AND (p."startDate" IS DISTINCT FROM c.new_start OR p."endDate" IS DISTINCT FROM c.new_end)
RETURNING p.id, p."policyNumber", p."startDate", p."endDate";

COMMIT;
*/
