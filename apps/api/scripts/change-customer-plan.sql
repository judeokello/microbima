-- =============================================================================
-- Change customer plan: MfanisiGo Gold → Silver
-- =============================================================================
--
-- One-off data fix for a single customer. Updates denormalized fields on the
-- policies row:
--   packagePlanId  — FK from Gold plan row to Silver plan row
--   productName    — denormalized label for Products tab (e.g. 'MfanisiGo Silver')
--   premium        — Silver premium amount (set NEW_PREMIUM below)
--
-- NOT updated (computed at read time — no separate DB change needed):
--   Payments dropdown displayText — built as `${package.name} - ${plan.name}`
--   API planName and premium statement headers — from package_plans join
--
-- HOW TO RUN:
--   1. Set CUSTOMER_ID_NUMBER and NEW_PREMIUM in the configuration block below
--   2. Run STEP 1 preview — confirm one customer, one policy, currently Gold
--   3. Run STEP 2 — confirm count = 1
--   4. Uncomment STEP 3 UPDATE, run once
--   5. Run STEP 4 verification — expect Silver plan and updated premium
--
--   psql $DATABASE_URL -f apps/api/scripts/change-customer-plan.sql
-- =============================================================================


-- ── CONFIGURATION — edit before running ─────────────────────────────────────
--
-- CUSTOMER_ID_NUMBER : national ID (customers.idNumber)
-- NEW_PREMIUM        : Silver premium, e.g. 45.00
-- PACKAGE_NAME       : default 'MfanisiGo'
-- FROM_PLAN          : 'Gold'
-- TO_PLAN            : 'Silver'


-- ── STEP 1: Preview ─────────────────────────────────────────────────────────

WITH config AS (
  SELECT
    'REPLACE_WITH_ID_NUMBER'::text AS customer_id_number,
    45.00::numeric(10, 2) AS new_premium,
    'MfanisiGo'::text AS package_name,
    'Gold'::text AS from_plan,
    'Silver'::text AS to_plan
),
preview AS (
  SELECT
    c.id AS customer_id,
    c."firstName",
    c."lastName",
    c."idNumber",
    p.id AS policy_id,
    p."policyNumber",
    p.status,
    p."packagePlanId" AS current_package_plan_id,
    current_plan.name AS current_plan_name,
    p."productName" AS current_product_name,
    p.premium AS current_premium,
    silver_plan.id AS new_package_plan_id,
    pkg.name || ' ' || silver_plan.name AS new_product_name,
    cfg.new_premium AS new_premium,
    cfg.from_plan,
    cfg.to_plan,
    cfg.package_name
  FROM config cfg
  LEFT JOIN customers c ON c."idNumber" = cfg.customer_id_number
  LEFT JOIN policies p ON p."customerId" = c.id
  LEFT JOIN packages pkg ON pkg.id = p."packageId" AND pkg.name = cfg.package_name
  LEFT JOIN package_plans current_plan ON current_plan.id = p."packagePlanId"
    AND current_plan."packageId" = pkg.id
  LEFT JOIN package_plans silver_plan ON silver_plan."packageId" = pkg.id
    AND silver_plan.name = cfg.to_plan
)
SELECT
  customer_id,
  "firstName",
  "lastName",
  "idNumber",
  policy_id,
  "policyNumber",
  status,
  current_package_plan_id,
  current_plan_name,
  current_product_name,
  current_premium,
  new_package_plan_id,
  new_product_name,
  new_premium,
  CASE
    WHEN customer_id IS NULL THEN 'ABORT: customer not found for idNumber'
    WHEN policy_id IS NULL THEN 'ABORT: no ' || package_name || ' policy for customer'
    WHEN current_plan_name IS NULL THEN 'ABORT: current plan is not ' || from_plan || ' (or packagePlanId is null)'
    WHEN current_plan_name IS DISTINCT FROM from_plan THEN 'ABORT: current plan is ' || current_plan_name || ', expected ' || from_plan
    WHEN new_package_plan_id IS NULL THEN 'ABORT: ' || to_plan || ' plan row missing for ' || package_name
    ELSE 'OK: ready to update'
  END AS validation_status
FROM preview;


-- ── STEP 2: Safety count (must be exactly 1) ────────────────────────────────

WITH config AS (
  SELECT
    'REPLACE_WITH_ID_NUMBER'::text AS customer_id_number,
    45.00::numeric(10, 2) AS new_premium,
    'MfanisiGo'::text AS package_name,
    'Gold'::text AS from_plan,
    'Silver'::text AS to_plan
)
SELECT COUNT(*) AS policies_to_update
FROM config cfg
INNER JOIN customers c ON c."idNumber" = cfg.customer_id_number
INNER JOIN policies p ON p."customerId" = c.id
INNER JOIN packages pkg ON pkg.id = p."packageId" AND pkg.name = cfg.package_name
INNER JOIN package_plans gold_plan ON gold_plan.id = p."packagePlanId"
  AND gold_plan.name = cfg.from_plan
  AND gold_plan."packageId" = pkg.id
INNER JOIN package_plans silver_plan ON silver_plan."packageId" = pkg.id
  AND silver_plan.name = cfg.to_plan;


-- ── STEP 3: Apply (uncomment after preview) ─────────────────────────────────

/*
BEGIN;

WITH config AS (
  SELECT
    'REPLACE_WITH_ID_NUMBER'::text AS customer_id_number,
    45.00::numeric(10, 2) AS new_premium,
    'MfanisiGo'::text AS package_name,
    'Gold'::text AS from_plan,
    'Silver'::text AS to_plan
),
target AS (
  SELECT
    p.id AS policy_id,
    silver_plan.id AS new_plan_id,
    pkg.name || ' ' || silver_plan.name AS new_product_name,
    cfg.new_premium AS new_premium
  FROM config cfg
  INNER JOIN customers c ON c."idNumber" = cfg.customer_id_number
  INNER JOIN policies p ON p."customerId" = c.id
  INNER JOIN packages pkg ON pkg.id = p."packageId" AND pkg.name = cfg.package_name
  INNER JOIN package_plans gold_plan ON gold_plan.id = p."packagePlanId"
    AND gold_plan.name = cfg.from_plan
    AND gold_plan."packageId" = pkg.id
  INNER JOIN package_plans silver_plan ON silver_plan."packageId" = pkg.id
    AND silver_plan.name = cfg.to_plan
)
UPDATE policies pol
SET
  "packagePlanId" = t.new_plan_id,
  "productName"   = t.new_product_name,
  premium         = t.new_premium,
  "updatedAt"     = NOW()
FROM target t
WHERE pol.id = t.policy_id
RETURNING
  pol.id,
  pol."policyNumber",
  pol."packagePlanId",
  pol."productName",
  pol.premium,
  pol."updatedAt";

COMMIT;
*/


-- ── STEP 4: Post-update verification ────────────────────────────────────────

WITH config AS (
  SELECT
    'REPLACE_WITH_ID_NUMBER'::text AS customer_id_number,
    45.00::numeric(10, 2) AS new_premium,
    'MfanisiGo'::text AS package_name,
    'Gold'::text AS from_plan,
    'Silver'::text AS to_plan
),
preview AS (
  SELECT
    c.id AS customer_id,
    c."firstName",
    c."lastName",
    c."idNumber",
    p.id AS policy_id,
    p."policyNumber",
    p.status,
    p."packagePlanId" AS current_package_plan_id,
    current_plan.name AS current_plan_name,
    p."productName" AS current_product_name,
    p.premium AS current_premium,
    silver_plan.id AS expected_plan_id,
    cfg.package_name || ' ' || cfg.to_plan AS expected_product_name,
    cfg.new_premium AS expected_premium,
    cfg.to_plan
  FROM config cfg
  LEFT JOIN customers c ON c."idNumber" = cfg.customer_id_number
  LEFT JOIN policies p ON p."customerId" = c.id
  LEFT JOIN packages pkg ON pkg.id = p."packageId" AND pkg.name = cfg.package_name
  LEFT JOIN package_plans current_plan ON current_plan.id = p."packagePlanId"
    AND current_plan."packageId" = pkg.id
  LEFT JOIN package_plans silver_plan ON silver_plan."packageId" = pkg.id
    AND silver_plan.name = cfg.to_plan
)
SELECT
  customer_id,
  "firstName",
  "lastName",
  "idNumber",
  policy_id,
  "policyNumber",
  status,
  current_package_plan_id,
  current_plan_name,
  current_product_name,
  current_premium,
  expected_plan_id,
  expected_product_name,
  expected_premium,
  CASE
    WHEN customer_id IS NULL THEN 'FAIL: customer not found'
    WHEN policy_id IS NULL THEN 'FAIL: no policy found'
    WHEN current_plan_name IS DISTINCT FROM to_plan THEN 'FAIL: plan is ' || COALESCE(current_plan_name, 'NULL') || ', expected ' || to_plan
    WHEN current_product_name IS DISTINCT FROM expected_product_name THEN 'FAIL: productName is ' || current_product_name || ', expected ' || expected_product_name
    WHEN current_premium IS DISTINCT FROM expected_premium THEN 'FAIL: premium is ' || current_premium || ', expected ' || expected_premium
    ELSE 'OK: plan change verified'
  END AS verification_status
FROM preview;
