-- =============================================================================
-- Prepaid status normalize — STEP 3: rollback (2026-08-27) — EMERGENCY ONLY
-- =============================================================================
--
-- Restores policy + customer columns to the BEFORE values stored in
-- prepaid_status_fix_20260827 (from STEP 1 snapshot).
--
-- Only touches rows where applied_at IS NOT NULL AND rolled_back_at IS NULL.
-- Does NOT undo premiumCompleted flips beyond restoring status/grace/suspend
-- clocks (premiumCompleted left as-is after apply — usually fine).
--
-- Do NOT run unless the apply batch caused a problem. Normal ops leave STEP 2
-- committed and skip this file.
--
-- HOW TO RUN:
--   psql $DATABASE_URL -f apps/api/scripts/prepaid-status-normalize-20260827-03-rollback.sql
-- =============================================================================

BEGIN;

SELECT policy_number, mismatch_class, old_policy_status, new_policy_status,
       old_customer_status, new_customer_status, applied_at, rolled_back_at
FROM prepaid_status_fix_20260827
WHERE applied_at IS NOT NULL
  AND rolled_back_at IS NULL
ORDER BY mismatch_class, policy_number;

UPDATE policies p
SET
  status = s.old_policy_status::"PolicyStatus",
  "inGracePeriod" = s.old_in_grace,
  "graceEnteredAt" = s.old_grace_entered_at,
  "overdueAnchorDueDate" = s.old_overdue_anchor,
  "suspendedAt" = s.old_suspended_at,
  "inactivatedAt" = s.old_inactivated_at,
  "updatedAt" = NOW()
FROM prepaid_status_fix_20260827 s
WHERE p.id = s.policy_id
  AND s.applied_at IS NOT NULL
  AND s.rolled_back_at IS NULL;

UPDATE customers c
SET
  status = s.old_customer_status::"CustomerStatus",
  "deactivatedAt" = s.old_customer_deactivated_at,
  "updatedAt" = NOW()
FROM prepaid_status_fix_20260827 s
WHERE c.id = s.customer_id
  AND s.applied_at IS NOT NULL
  AND s.rolled_back_at IS NULL;

INSERT INTO entity_status_changes (
  id, "entityType", "customerId", "policyId",
  "fromStatus", "toStatus", reason, trigger, "changedBy", "correlationId", metadata, "createdAt"
)
SELECT
  gen_random_uuid(),
  'POLICY',
  s.customer_id,
  s.policy_id,
  CASE WHEN s.new_policy_status = 'ACTIVE_GRACE' THEN 'ACTIVE' ELSE s.new_policy_status END,
  s.old_policy_status,
  'ROLLBACK prepaid status normalize batch 20260827',
  'MANUAL_ADMIN',
  '00000000-0000-0000-0000-000000000001',
  'prepaid-status-normalize-20260827-rollback',
  jsonb_build_object('batch', 'prepaid_status_fix_20260827'),
  NOW()
FROM prepaid_status_fix_20260827 s
WHERE s.applied_at IS NOT NULL
  AND s.rolled_back_at IS NULL
  AND s.old_policy_status IS DISTINCT FROM
      CASE WHEN s.new_policy_status = 'ACTIVE_GRACE' THEN 'ACTIVE' ELSE s.new_policy_status END;

INSERT INTO entity_status_changes (
  id, "entityType", "customerId", "policyId",
  "fromStatus", "toStatus", reason, trigger, "changedBy", "correlationId", metadata, "createdAt"
)
SELECT
  gen_random_uuid(),
  'CUSTOMER',
  s.customer_id,
  NULL,
  s.new_customer_status,
  s.old_customer_status,
  'ROLLBACK prepaid status normalize batch 20260827 (customer)',
  'MANUAL_ADMIN',
  '00000000-0000-0000-0000-000000000001',
  'prepaid-status-normalize-20260827-rollback',
  jsonb_build_object('policyNumber', s.policy_number),
  NOW()
FROM prepaid_status_fix_20260827 s
WHERE s.applied_at IS NOT NULL
  AND s.rolled_back_at IS NULL
  AND s.old_customer_status IS DISTINCT FROM s.new_customer_status;

UPDATE prepaid_status_fix_20260827
SET rolled_back_at = NOW()
WHERE applied_at IS NOT NULL
  AND rolled_back_at IS NULL;

-- Verify restored
SELECT
  s.policy_number,
  s.old_policy_status AS intended_restore_policy,
  p.status::text AS actual_policy,
  s.old_customer_status AS intended_restore_customer,
  c.status::text AS actual_customer,
  s.rolled_back_at
FROM prepaid_status_fix_20260827 s
JOIN policies p ON p.id = s.policy_id
JOIN customers c ON c.id = s.customer_id
ORDER BY s.policy_number;

COMMIT;
