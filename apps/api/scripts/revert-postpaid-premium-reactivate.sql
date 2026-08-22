-- =============================================================================
-- Revert postpaid premium accrual + reactivate false SYSTEM suspends
-- =============================================================================
--
-- Context (Aug 2026): after populating policies.premium / annualPremium for
-- Titanic (2), Waiyaki (8), ALTO (9), lifecycle started accruing like prepaid
-- and mass-suspended members. Pre-patch, premium = 0 skipped the job.
--
-- This script restores that safe model for live policies on those schemes:
--   1) Set premium = 0 and annualPremium = 0
--   2) Move SUSPENDED → ACTIVE (clear suspend/grace flags)
--   3) Set customer status SUSPENDED → ACTIVE when they now have an ACTIVE policy
--
-- Does NOT change: packagePlanId, productName, frequency, paymentCadence,
-- expectedInstallmentCount, scheme frequency/cadence, startDate / endDate.
--
-- Does NOT touch: DEACTIVATED / superseded policies, PENDING_ACTIVATION,
-- INACTIVE (those need a separate decision).
--
-- LCT / SMS / entity_status_changes:
--   Raw SQL does NOT call EntityStatusChangeService or LctSyncService, so this
--   will NOT push a reactivation to LCT and will NOT enqueue policy_reactivated
--   SMS. That is intentional for this ops undo (members were not LCT-pushed
--   for the false suspend either in the intended sense for this fix).
--
-- HOW TO RUN:
--   1. Run STEP 1 preview — confirm counts / sample rows.
--   2. Uncomment STEP 2, run once inside the transaction.
--   3. Run STEP 3 verification.
--
--   psql $DATABASE_URL -f apps/api/scripts/revert-postpaid-premium-reactivate.sql
-- =============================================================================


-- ── CONFIGURATION ───────────────────────────────────────────────────────────

-- scheme_ids: Titanic=2, OOD Waiyaki=8, ALTO=9


-- ── STEP 1: Preview ─────────────────────────────────────────────────────────

WITH config AS (
  SELECT ARRAY[2, 8, 9]::int[] AS scheme_ids
),
targets AS (
  SELECT
    s.id AS scheme_id,
    s."schemeName",
    c.id AS customer_id,
    c."firstName",
    c."lastName",
    c."idNumber",
    c.status AS customer_status,
    p.id AS policy_id,
    p."policyNumber",
    p.status AS policy_status,
    p.premium AS current_premium,
    p."annualPremium" AS current_annual_premium,
    p."suspendedAt",
    p."packagePlanId",
    p.frequency,
    p."paymentCadence"
  FROM config cfg
  INNER JOIN schemes s ON s.id = ANY (cfg.scheme_ids)
  INNER JOIN package_schemes ps ON ps."schemeId" = s.id
  INNER JOIN package_scheme_customers psc ON psc."packageSchemeId" = ps.id
  INNER JOIN customers c ON c.id = psc."customerId"
  INNER JOIN policies p ON p."customerId" = c.id
    AND p."packageId" = ps."packageId"
    AND p.status <> 'DEACTIVATED'
    AND p."supersededByPolicyId" IS NULL
)
SELECT
  scheme_id,
  "schemeName",
  policy_status,
  COUNT(*) AS policies,
  COUNT(*) FILTER (WHERE current_premium > 0 OR current_annual_premium > 0)
    AS with_nonzero_premium_or_annual,
  COUNT(*) FILTER (WHERE policy_status = 'SUSPENDED') AS suspended_to_reactivate,
  COUNT(*) FILTER (WHERE policy_status = 'ACTIVE') AS already_active,
  COUNT(*) FILTER (WHERE policy_status = 'PENDING_ACTIVATION') AS pending_left_alone,
  COUNT(*) FILTER (WHERE policy_status = 'INACTIVE') AS inactive_left_alone
FROM targets
GROUP BY scheme_id, "schemeName", policy_status
ORDER BY scheme_id, policy_status;

-- Sample rows that will get premium zeroed (and reactivated if SUSPENDED)
WITH config AS (
  SELECT ARRAY[2, 8, 9]::int[] AS scheme_ids
),
targets AS (
  SELECT
    s.id AS scheme_id,
    s."schemeName",
    c."firstName",
    c."lastName",
    c."idNumber",
    c.status AS customer_status,
    p.id AS policy_id,
    p."policyNumber",
    p.status AS policy_status,
    p.premium AS current_premium,
    p."annualPremium" AS current_annual_premium
  FROM config cfg
  INNER JOIN schemes s ON s.id = ANY (cfg.scheme_ids)
  INNER JOIN package_schemes ps ON ps."schemeId" = s.id
  INNER JOIN package_scheme_customers psc ON psc."packageSchemeId" = ps.id
  INNER JOIN customers c ON c.id = psc."customerId"
  INNER JOIN policies p ON p."customerId" = c.id
    AND p."packageId" = ps."packageId"
    AND p.status <> 'DEACTIVATED'
    AND p."supersededByPolicyId" IS NULL
  WHERE p.status IN ('ACTIVE', 'SUSPENDED')
)
SELECT *
FROM targets
ORDER BY scheme_id, policy_status, "lastName", "firstName";


-- ── STEP 2: Apply (uncomment after preview) ─────────────────────────────────
-- NOTE: Must be ONE update on policies (Postgres cannot update the same row
-- twice in one statement — that was why a first run zeroed premiums but left
-- policies_reactivated = 0).

/*
BEGIN;

WITH config AS (
  SELECT ARRAY[2, 8, 9]::int[] AS scheme_ids
),
live_policies AS (
  SELECT p.id AS policy_id, p."customerId", p.status AS prior_status
  FROM config cfg
  INNER JOIN schemes s ON s.id = ANY (cfg.scheme_ids)
  INNER JOIN package_schemes ps ON ps."schemeId" = s.id
  INNER JOIN package_scheme_customers psc ON psc."packageSchemeId" = ps.id
  INNER JOIN policies p ON p."customerId" = psc."customerId"
    AND p."packageId" = ps."packageId"
    AND p.status <> 'DEACTIVATED'
    AND p."supersededByPolicyId" IS NULL
    AND p.status IN ('ACTIVE', 'SUSPENDED')
),
policies_updated AS (
  UPDATE policies pol
  SET
    premium = 0,
    "annualPremium" = 0,
    status = CASE WHEN t.prior_status = 'SUSPENDED' THEN 'ACTIVE'::"PolicyStatus" ELSE pol.status END,
    "suspendedAt" = CASE WHEN t.prior_status = 'SUSPENDED' THEN NULL ELSE pol."suspendedAt" END,
    "inactivatedAt" = CASE WHEN t.prior_status = 'SUSPENDED' THEN NULL ELSE pol."inactivatedAt" END,
    "inGracePeriod" = CASE WHEN t.prior_status = 'SUSPENDED' THEN false ELSE pol."inGracePeriod" END,
    "graceEnteredAt" = CASE WHEN t.prior_status = 'SUSPENDED' THEN NULL ELSE pol."graceEnteredAt" END,
    "overdueAnchorDueDate" = CASE
      WHEN t.prior_status = 'SUSPENDED' THEN NULL
      ELSE pol."overdueAnchorDueDate"
    END,
    "deactivatedAt" = CASE WHEN t.prior_status = 'SUSPENDED' THEN NULL ELSE pol."deactivatedAt" END,
    "updatedAt" = NOW()
  FROM live_policies t
  WHERE pol.id = t.policy_id
  RETURNING
    pol.id,
    pol."customerId",
    t.prior_status,
    pol.status AS new_status
),
customers_updated AS (
  UPDATE customers c
  SET
    status = 'ACTIVE',
    "deactivatedAt" = NULL,
    "updatedAt" = NOW()
  WHERE c.status = 'SUSPENDED'
    AND c.id IN (
      SELECT DISTINCT pu."customerId"
      FROM policies_updated pu
      WHERE pu.prior_status = 'SUSPENDED'
        AND pu.new_status = 'ACTIVE'
    )
  RETURNING c.id
)
SELECT
  (SELECT COUNT(*) FROM policies_updated) AS policies_touched,
  (SELECT COUNT(*) FROM policies_updated WHERE prior_status = 'SUSPENDED')
    AS policies_reactivated,
  (SELECT COUNT(*) FROM customers_updated) AS customers_set_active;

COMMIT;
*/


-- ── STEP 2b: Finish reactivation if STEP 2 already zeroed premiums only ─────
-- Run this when verification still shows SUSPENDED with premium = 0.

/*
BEGIN;

WITH config AS (
  SELECT ARRAY[2, 8, 9]::int[] AS scheme_ids
),
suspended_live AS (
  SELECT p.id AS policy_id, p."customerId"
  FROM config cfg
  INNER JOIN schemes s ON s.id = ANY (cfg.scheme_ids)
  INNER JOIN package_schemes ps ON ps."schemeId" = s.id
  INNER JOIN package_scheme_customers psc ON psc."packageSchemeId" = ps.id
  INNER JOIN policies p ON p."customerId" = psc."customerId"
    AND p."packageId" = ps."packageId"
    AND p.status = 'SUSPENDED'
    AND p."supersededByPolicyId" IS NULL
),
reactivated AS (
  UPDATE policies pol
  SET
    status = 'ACTIVE',
    "suspendedAt" = NULL,
    "inactivatedAt" = NULL,
    "inGracePeriod" = false,
    "graceEnteredAt" = NULL,
    "overdueAnchorDueDate" = NULL,
    "deactivatedAt" = NULL,
    "updatedAt" = NOW()
  FROM suspended_live t
  WHERE pol.id = t.policy_id
  RETURNING pol.id, pol."customerId"
),
customers_updated AS (
  UPDATE customers c
  SET
    status = 'ACTIVE',
    "deactivatedAt" = NULL,
    "updatedAt" = NOW()
  WHERE c.status = 'SUSPENDED'
    AND c.id IN (SELECT DISTINCT r."customerId" FROM reactivated r)
  RETURNING c.id
)
SELECT
  (SELECT COUNT(*) FROM reactivated) AS policies_reactivated,
  (SELECT COUNT(*) FROM customers_updated) AS customers_set_active;

COMMIT;
*/


-- ── STEP 3: Verification ────────────────────────────────────────────────────

WITH config AS (
  SELECT ARRAY[2, 8, 9]::int[] AS scheme_ids
)
SELECT
  s.id AS scheme_id,
  s."schemeName",
  p.status AS policy_status,
  COUNT(*) AS policies,
  COUNT(*) FILTER (WHERE p.premium <> 0 OR p."annualPremium" <> 0)
    AS still_nonzero_premium_or_annual,
  ROUND(AVG(p.premium)::numeric, 2) AS avg_premium
FROM config cfg
INNER JOIN schemes s ON s.id = ANY (cfg.scheme_ids)
INNER JOIN package_schemes ps ON ps."schemeId" = s.id
INNER JOIN package_scheme_customers psc ON psc."packageSchemeId" = ps.id
INNER JOIN policies p ON p."customerId" = psc."customerId"
  AND p."packageId" = ps."packageId"
  AND p.status <> 'DEACTIVATED'
  AND p."supersededByPolicyId" IS NULL
GROUP BY s.id, s."schemeName", p.status
ORDER BY s.id, p.status;
