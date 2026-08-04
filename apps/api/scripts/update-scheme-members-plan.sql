-- =============================================================================
-- Update plan for ALL members in a postpaid scheme
-- =============================================================================
--
-- Sets packagePlanId (+ productName, optional premium / annualPremium /
-- expectedInstallmentCount) on every non-deactivated policy linked to customers
-- enrolled in the given scheme.
--
-- HOW TO RUN:
--   1. Edit the CONFIGURATION block (scheme_id, package_plan_id, and optional
--      premium / annual_premium / expected_installment_count).
--   2. Run STEP 1 preview — review the rows that will change.
--   3. Uncomment STEP 2 UPDATE, run once inside a transaction.
--   4. Run STEP 3 verification.
--
--   psql $DATABASE_URL -f apps/api/scripts/update-scheme-members-plan.sql
--
-- Notes:
--   - Leave new_premium / new_annual_premium / new_expected_installment_count
--     as NULL to leave those columns unchanged.
--   - Skips DEACTIVATED policies and policies already superseded.
-- =============================================================================


-- ── CONFIGURATION — edit before running ─────────────────────────────────────

-- scheme_id                 : schemes.id (e.g. 3)
-- package_plan_id           : package_plans.id for the target plan
-- new_premium               : installment amount, or NULL to keep existing
-- new_annual_premium        : annual premium, or NULL to keep existing
-- new_expected_installment_count : e.g. 39 for WEEKLY, or NULL to keep existing


-- ── STEP 1: Preview ─────────────────────────────────────────────────────────

WITH config AS (
  SELECT
    0::int AS scheme_id,                          -- REPLACE
    0::int AS package_plan_id,                    -- REPLACE
    NULL::numeric(10, 2) AS new_premium,           -- optional
    NULL::numeric(10, 2) AS new_annual_premium,    -- optional
    NULL::int AS new_expected_installment_count    -- optional
),
targets AS (
  SELECT
    c.id AS customer_id,
    c."firstName",
    c."lastName",
    c."idNumber",
    s.id AS scheme_id,
    s."schemeName",
    p.id AS policy_id,
    p."policyNumber",
    p.status,
    p."packagePlanId" AS current_plan_id,
    current_plan.name AS current_plan_name,
    p.premium AS current_premium,
    p."annualPremium" AS current_annual_premium,
    p."expectedInstallmentCount" AS current_expected_installment_count,
    p."productName" AS current_product_name,
    cfg.package_plan_id AS new_plan_id,
    new_plan.name AS new_plan_name,
    pkg.name || ' ' || new_plan.name AS new_product_name,
    COALESCE(cfg.new_premium, p.premium) AS new_premium,
    COALESCE(cfg.new_annual_premium, p."annualPremium") AS new_annual_premium,
    COALESCE(cfg.new_expected_installment_count, p."expectedInstallmentCount")
      AS new_expected_installment_count
  FROM config cfg
  INNER JOIN schemes s ON s.id = cfg.scheme_id
  INNER JOIN package_schemes ps ON ps."schemeId" = s.id
  INNER JOIN package_scheme_customers psc ON psc."packageSchemeId" = ps.id
  INNER JOIN customers c ON c.id = psc."customerId"
  INNER JOIN policies p ON p."customerId" = c.id
    AND p."packageId" = ps."packageId"
    AND p.status <> 'DEACTIVATED'
    AND p."supersededByPolicyId" IS NULL
  INNER JOIN packages pkg ON pkg.id = p."packageId"
  LEFT JOIN package_plans current_plan ON current_plan.id = p."packagePlanId"
  INNER JOIN package_plans new_plan
    ON new_plan.id = cfg.package_plan_id
    AND new_plan."packageId" = pkg.id
)
SELECT
  customer_id,
  "firstName",
  "lastName",
  "idNumber",
  scheme_id,
  "schemeName",
  policy_id,
  "policyNumber",
  status,
  current_plan_id,
  current_plan_name,
  current_premium,
  current_annual_premium,
  current_expected_installment_count,
  current_product_name,
  new_plan_id,
  new_plan_name,
  new_product_name,
  new_premium,
  new_annual_premium,
  new_expected_installment_count,
  CASE
    WHEN new_plan_id IS NULL THEN 'ABORT: plan not found for package'
    ELSE 'OK'
  END AS validation_status
FROM targets
ORDER BY "lastName", "firstName";


-- ── STEP 2: Apply (uncomment after preview) ─────────────────────────────────

/*
BEGIN;

WITH config AS (
  SELECT
    0::int AS scheme_id,                          -- REPLACE (same as STEP 1)
    0::int AS package_plan_id,                    -- REPLACE
    NULL::numeric(10, 2) AS new_premium,
    NULL::numeric(10, 2) AS new_annual_premium,
    NULL::int AS new_expected_installment_count
),
targets AS (
  SELECT
    p.id AS policy_id,
    cfg.package_plan_id AS new_plan_id,
    pkg.name || ' ' || new_plan.name AS new_product_name,
    cfg.new_premium,
    cfg.new_annual_premium,
    cfg.new_expected_installment_count
  FROM config cfg
  INNER JOIN schemes s ON s.id = cfg.scheme_id
  INNER JOIN package_schemes ps ON ps."schemeId" = s.id
  INNER JOIN package_scheme_customers psc ON psc."packageSchemeId" = ps.id
  INNER JOIN policies p ON p."customerId" = psc."customerId"
    AND p."packageId" = ps."packageId"
    AND p.status <> 'DEACTIVATED'
    AND p."supersededByPolicyId" IS NULL
  INNER JOIN packages pkg ON pkg.id = p."packageId"
  INNER JOIN package_plans new_plan
    ON new_plan.id = cfg.package_plan_id
    AND new_plan."packageId" = pkg.id
)
UPDATE policies pol
SET
  "packagePlanId" = t.new_plan_id,
  "productName" = t.new_product_name,
  premium = COALESCE(t.new_premium, pol.premium),
  "annualPremium" = COALESCE(t.new_annual_premium, pol."annualPremium"),
  "expectedInstallmentCount" = COALESCE(
    t.new_expected_installment_count,
    pol."expectedInstallmentCount"
  ),
  "updatedAt" = NOW()
FROM targets t
WHERE pol.id = t.policy_id
RETURNING
  pol.id,
  pol."customerId",
  pol."packagePlanId",
  pol."productName",
  pol.premium,
  pol."annualPremium",
  pol."expectedInstallmentCount";

COMMIT;
*/


-- ── STEP 3: Verification (count by plan after update) ───────────────────────

WITH config AS (
  SELECT
    0::int AS scheme_id,       -- REPLACE
    0::int AS package_plan_id  -- REPLACE
)
SELECT
  p."packagePlanId",
  pp.name AS plan_name,
  COUNT(*) AS policy_count
FROM config cfg
INNER JOIN package_schemes ps ON ps."schemeId" = cfg.scheme_id
INNER JOIN package_scheme_customers psc ON psc."packageSchemeId" = ps.id
INNER JOIN policies p ON p."customerId" = psc."customerId"
  AND p."packageId" = ps."packageId"
  AND p.status <> 'DEACTIVATED'
  AND p."supersededByPolicyId" IS NULL
LEFT JOIN package_plans pp ON pp.id = p."packagePlanId"
GROUP BY p."packagePlanId", pp.name
ORDER BY plan_name;
