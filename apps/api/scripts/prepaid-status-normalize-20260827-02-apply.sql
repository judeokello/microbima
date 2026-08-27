-- =============================================================================
-- Prepaid status normalize — STEP 2: apply (2026-08-27)
-- =============================================================================
--
-- Prerequisites:
--   - Ran prepaid-status-normalize-20260827-01-snapshot.sql
--   - Table prepaid_status_fix_20260827 has 31 rows, applied_at IS NULL
--   - Customer Care reviewed the snapshot SELECT
--
-- Updates policies + customers for the 31 mismatch rows, writes
-- entity_status_changes, sets applied_at. No LCT / SMS.
--
-- Guards: only updates rows still at old_policy_status / old_customer_status
-- and not yet applied.
--
-- HOW TO RUN:
--   psql $DATABASE_URL -f apps/api/scripts/prepaid-status-normalize-20260827-02-apply.sql
--
-- If something looks wrong after COMMIT, run:
--   prepaid-status-normalize-20260827-03-rollback.sql
-- =============================================================================

BEGIN;

-- Preview (optional): rows about to change
SELECT policy_number, mismatch_class, old_policy_status, new_policy_status,
       old_customer_status, new_customer_status
FROM prepaid_status_fix_20260827
WHERE applied_at IS NULL
ORDER BY mismatch_class, policy_number;

UPDATE policies p
SET
  status = CASE
    WHEN s.new_policy_status IN ('ACTIVE', 'ACTIVE_GRACE') THEN 'ACTIVE'::"PolicyStatus"
    WHEN s.new_policy_status = 'SUSPENDED' THEN 'SUSPENDED'::"PolicyStatus"
    WHEN s.new_policy_status = 'INACTIVE' THEN 'INACTIVE'::"PolicyStatus"
  END,
  "inGracePeriod" = (s.new_policy_status = 'ACTIVE_GRACE'),
  "graceEnteredAt" = CASE WHEN s.new_policy_status = 'ACTIVE_GRACE' THEN NOW() ELSE NULL END,
  "overdueAnchorDueDate" = CASE
    WHEN s.new_policy_status = 'ACTIVE_GRACE' THEN s.next_due_date::timestamptz
    ELSE NULL
  END,
  "suspendedAt" = CASE
    WHEN s.new_policy_status = 'SUSPENDED' THEN (s.next_due_date + 15)::timestamptz
    ELSE NULL
  END,
  "inactivatedAt" = CASE
    WHEN s.new_policy_status = 'INACTIVE' THEN NOW()
    ELSE NULL
  END,
  "premiumCompleted" = CASE WHEN s.premium_complete THEN true ELSE p."premiumCompleted" END,
  "premiumCompletedAt" = CASE
    WHEN s.premium_complete AND p."premiumCompletedAt" IS NULL THEN NOW()
    ELSE p."premiumCompletedAt"
  END,
  "updatedAt" = NOW()
FROM prepaid_status_fix_20260827 s
WHERE p.id = s.policy_id
  AND p.status::text = s.old_policy_status
  AND s.applied_at IS NULL;

UPDATE customers c
SET
  status = s.new_customer_status::"CustomerStatus",
  "deactivatedAt" = CASE
    WHEN s.new_customer_status = 'DEACTIVATED' THEN NOW()
    ELSE NULL
  END,
  "updatedAt" = NOW()
FROM prepaid_status_fix_20260827 s
WHERE c.id = s.customer_id
  AND c.status::text = s.old_customer_status
  AND s.applied_at IS NULL;

INSERT INTO entity_status_changes (
  id, "entityType", "customerId", "policyId",
  "fromStatus", "toStatus", reason, trigger, "changedBy", "correlationId", metadata, "createdAt"
)
SELECT
  gen_random_uuid(),
  'POLICY',
  s.customer_id,
  s.policy_id,
  s.old_policy_status,
  CASE WHEN s.new_policy_status = 'ACTIVE_GRACE' THEN 'ACTIVE' ELSE s.new_policy_status END,
  'Prepaid status normalize batch 20260827: ' || s.mismatch_class,
  'MANUAL_ADMIN',
  '00000000-0000-0000-0000-000000000001',
  'prepaid-status-normalize-20260827',
  jsonb_build_object(
    'mismatchClass', s.mismatch_class,
    'paid', s.paid,
    'moneyTarget', s.money_target,
    'arrears', s.arrears,
    'overdueDays', s.overdue_days,
    'batch', 'prepaid_status_fix_20260827'
  ),
  NOW()
FROM prepaid_status_fix_20260827 s
WHERE s.applied_at IS NULL
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
  s.old_customer_status,
  s.new_customer_status,
  'Prepaid status normalize batch 20260827 (customer sync)',
  'MANUAL_ADMIN',
  '00000000-0000-0000-0000-000000000001',
  'prepaid-status-normalize-20260827',
  jsonb_build_object(
    'policyNumber', s.policy_number,
    'batch', 'prepaid_status_fix_20260827'
  ),
  NOW()
FROM prepaid_status_fix_20260827 s
WHERE s.applied_at IS NULL
  AND s.old_customer_status IS DISTINCT FROM s.new_customer_status;

UPDATE prepaid_status_fix_20260827
SET applied_at = NOW()
WHERE applied_at IS NULL;

-- Verify actual vs intended
SELECT
  s.policy_number,
  s.mismatch_class,
  s.new_policy_status AS intended_policy,
  p.status::text AS actual_policy,
  p."inGracePeriod",
  s.new_customer_status AS intended_customer,
  c.status::text AS actual_customer,
  s.applied_at
FROM prepaid_status_fix_20260827 s
JOIN policies p ON p.id = s.policy_id
JOIN customers c ON c.id = s.customer_id
ORDER BY s.mismatch_class, s.policy_number;

COMMIT;
