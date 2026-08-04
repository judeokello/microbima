-- =============================================================================
-- Update plan for a single customer policy
-- =============================================================================
--
-- Sets packagePlanId (+ productName, optional premium / annualPremium /
-- expectedInstallmentCount) for one customer's active (non-deactivated) policy.
--
-- HOW TO RUN:
--   1. Edit CONFIGURATION (customer_id UUID, package_plan_id, optional amounts).
--   2. Run STEP 1 preview.
--   3. Uncomment STEP 2 UPDATE and run.
--   4. Run STEP 3 verification.
--
--   psql $DATABASE_URL -f apps/api/scripts/update-customer-policy-plan.sql
-- =============================================================================


-- ── CONFIGURATION — edit before running ─────────────────────────────────────

-- customer_id               : customers.id (UUID)
-- package_plan_id           : package_plans.id
-- package_id                : optional filter when customer has multiple packages
--                             (NULL = update all non-deactivated policies)
-- new_premium / new_annual_premium / new_expected_installment_count :
--                             NULL keeps existing values


-- ── STEP 1: Preview ─────────────────────────────────────────────────────────

WITH config AS (
  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS customer_id, -- REPLACE
    0::int AS package_plan_id,                                   -- REPLACE
    NULL::int AS package_id,                                      -- optional filter
    NULL::numeric(10, 2) AS new_premium,
    NULL::numeric(10, 2) AS new_annual_premium,
    NULL::int AS new_expected_installment_count
),
targets AS (
  SELECT
    c.id AS customer_id,
    c."firstName",
    c."lastName",
    c."idNumber",
    p.id AS policy_id,
    p."policyNumber",
    p.status,
    p."packageId",
    pkg.name AS package_name,
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
  INNER JOIN customers c ON c.id = cfg.customer_id
  INNER JOIN policies p ON p."customerId" = c.id
    AND p.status <> 'DEACTIVATED'
    AND p."supersededByPolicyId" IS NULL
    AND (cfg.package_id IS NULL OR p."packageId" = cfg.package_id)
  INNER JOIN packages pkg ON pkg.id = p."packageId"
  LEFT JOIN package_plans current_plan ON current_plan.id = p."packagePlanId"
  INNER JOIN package_plans new_plan
    ON new_plan.id = cfg.package_plan_id
    AND new_plan."packageId" = pkg.id
)
SELECT
  *,
  CASE
    WHEN customer_id IS NULL THEN 'ABORT: customer not found'
    WHEN policy_id IS NULL THEN 'ABORT: no matching policy'
    WHEN new_plan_id IS NULL THEN 'ABORT: plan not on this package'
    ELSE 'OK'
  END AS validation_status
FROM targets;


-- ── STEP 2: Apply (uncomment after preview) ─────────────────────────────────

/*
BEGIN;

WITH config AS (
  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS customer_id, -- REPLACE
    0::int AS package_plan_id,                                   -- REPLACE
    NULL::int AS package_id,
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
  INNER JOIN customers c ON c.id = cfg.customer_id
  INNER JOIN policies p ON p."customerId" = c.id
    AND p.status <> 'DEACTIVATED'
    AND p."supersededByPolicyId" IS NULL
    AND (cfg.package_id IS NULL OR p."packageId" = cfg.package_id)
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


-- ── STEP 3: Verification ────────────────────────────────────────────────────

WITH config AS (
  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS customer_id, -- REPLACE
    0::int AS package_plan_id                                    -- REPLACE
)
SELECT
  p.id AS policy_id,
  p."policyNumber",
  p.status,
  p."packagePlanId",
  pp.name AS plan_name,
  p."productName",
  p.premium,
  p."annualPremium",
  p."expectedInstallmentCount",
  CASE
    WHEN p."packagePlanId" = cfg.package_plan_id THEN 'OK'
    ELSE 'FAIL: plan not updated'
  END AS verification_status
FROM config cfg
INNER JOIN policies p ON p."customerId" = cfg.customer_id
  AND p.status <> 'DEACTIVATED'
  AND p."supersededByPolicyId" IS NULL
LEFT JOIN package_plans pp ON pp.id = p."packagePlanId";
