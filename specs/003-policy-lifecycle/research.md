# Research: Policy Lifecycle & Status Rules

**Feature**: `003-policy-lifecycle`  
**Date**: 2026-07-11

## R1 — Grace representation

**Decision**: Keep member-facing `PolicyStatus.ACTIVE` during grace; store overlay on Policy (`inGracePeriod`, `graceEnteredAt`, `overdueAnchorDueDate`).

**Rationale**: Spec FR-004; avoids enum churn and partner confusion; dashboard can filter `inGracePeriod = true`.

**Alternatives considered**: Separate `GRACE` status (rejected — contradicts clarifications); compute grace only at read time (rejected — harder for SMS schedule and audits).

---

## R2 — `INACTIVE` status

**Decision**: Add `PolicyStatus.INACTIVE` via Prisma migration. Treat like terminal for partial unique index (not in `ACTIVE|PENDING_ACTIVATION|SUSPENDED` set). Customer sync treats `INACTIVE` like `EXPIRED`/`DEACTIVATED` (does not keep customer “open”).

**Rationale**: Spec distinguishes mid-term non-payment stop from `EXPIRED` (finished cycle / Inactive past end).

**Alternatives considered**: Reuse `EXPIRED` for both (rejected — breaks analytics and reactivation rules); reuse `DEACTIVATED` (rejected — admin/business closure from 002).

---

## R3 — Next unpaid expected premium due date

**Decision**: Compute from policy `startDate` + `paymentCadence` days and completed/outstanding payment coverage using existing premium-statement / installment-slot math (`premium-statement-math.ts`, `installment-backfill.util.ts`). “Next unpaid due” = earliest expected installment slot date ≤ today that is not covered by confirmed paid amount (or earliest future uncovered slot if current). Overdue days = UTC calendar days from that anchor when unpaid.

**Rationale**: Spec Option B; no separate schedule table in codebase today; math already used for missed amounts.

**Alternatives considered**: Fixed monthly due day (rejected); days-since-last-payment only (rejected); mandatory always-materialized `OUTSTANDING` rows for every slot (optional enhancement later — job may backfill missing placeholders for Active policies to keep Products tab aligned).

---

## R4 — Daily job mechanism

**Decision**: NestJS `@Cron` service (UTC), same stack as attachment retention cleanup — not Bull. Optional internal `POST` to run once for staging/tests.

**Rationale**: Already in monorepo; simple idempotent daily pass; messaging outbox already drains every 5s.

**Alternatives considered**: BullMQ (rejected — not in API today); external cron hitting HTTP only (keep as supplement, not sole mechanism).

---

## R5 — Policy end time-of-day

**Decision**: Keep existing `policyEndDateFromStart`: end = start + 1 calendar year − 1 day at the **same time of day** as start (e.g. 10:15 → 10:15). Do **not** force 23:59:59.999 UTC.

**Rationale**: Stakeholder accepted current util behavior (A1 remediation).

**Alternatives considered**: Force 23:59:59.999 UTC on end day (rejected).

---

## R7 — Post–end-date surplus renewal from Suspended

**Decision**: Allocate payment to old policy debt first. When Suspended-past-end **debt reaches zero** → set prior to **EXPIRED** (never Active). Surplus above debt creates new Active renewal policy (new policy number; reuse `paymentAcNumber` + member numbers; supersession). If debt never fully paid → stay **Suspended** forever.

**Rationale**: Clarification remediation 2026-07-11 — analytics retain Suspended while owing; finished premiums close the term as Expired.

**Alternatives considered**: Leave Suspended forever even after debt cleared (rejected by stakeholder); force Expired at term end while still owing (rejected — obscures unpaid suspended book).

---

## R6 — Restore / renew payment amounts

**Decision**:
- Arrears = outstanding premium due from statement math.
- **2 weeks upfront** = `ceil(14 / paymentCadenceDays) × installmentAmount`.
- **One month** = `ceil(31 / paymentCadenceDays) × installmentAmount`.

**Rationale**: Spec remediation U1; integer installment products.

**Alternatives considered**: Hardcoded KES; pure calendar pro-rate without ceil (rejected for cadence products).

---

## R8 — Admin Activate after end date

**Decision**: `activatePolicy` and any payment restore path call shared `assertPolicyMayBecomeActive` — throws `ValidationException` if `endDate` passed or status is Terminated/Deactivated/Expired (Expired uses renew path only).

**Rationale**: FR-012a.

---

## R9 — Lifecycle SMS

**Decision**: Add `message_templates` rows (seed SQL) + enqueue via existing messaging outbox. Idempotency via `policy_lifecycle_notifications` unique `(policyId, scheduleKey)`. Prefer template keys over new `system_settings` unless branding toggles needed (then follow MessagingSettingsSnapshot sync rule).

**Rationale**: Matches customer-messaging architecture; FR-024.

**Alternatives considered**: Inline SMS send in job (rejected — bypasses outbox/retries).

---

## R10 — Terminate vs 002 Activate

**Decision**: New `terminatePolicy`; UI beside Reset Start Date using reason dialog. Customer Terminated only if no remaining Active/Pending Activation/Suspended. Do not auto-terminate other policies.

**Rationale**: Spec FR-019–020 Option C.

---

## R11 — Partial unique index

**Decision**: Keep index predicate `status IN ('ACTIVE','PENDING_ACTIVATION','SUSPENDED')`. `INACTIVE` / `EXPIRED` / `TERMINATED` / `DEACTIVATED` unrestricted for history + renew.

**Rationale**: Same as 002; renew needs new Active while old terminal/suspended rows remain.

---

## Open items deferred to implementation tasks (not blocking plan)

- Exact cron hour (default 01:00 UTC) — config flag OK.
- Whether to eagerly materialize `OUTSTANDING` rows each night — start with compute-only; add backfill if Products missed counts drift.
- Portal TERMINATED gate (002 FR-040) — still separate if not done.
