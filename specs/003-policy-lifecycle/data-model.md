# Data Model: Policy Lifecycle & Status Rules

**Feature**: `003-policy-lifecycle`  
**Date**: 2026-07-11  
**Depends on**: `002-modify-product-policy` foundation (`EntityStatusChange`, supersession, `DEACTIVATED`, `OUTSTANDING`)

## Overview

Add mid-term **INACTIVE** status, grace overlay fields, suspension clock, notification idempotency ledger, and document state transitions for daily + payment-driven lifecycle. Waiting periods are out of scope (no eligibility tables).

---

## Enum changes

### PolicyStatus

```prisma
enum PolicyStatus {
  PENDING_ACTIVATION
  ACTIVE
  SUSPENDED
  INACTIVE      // NEW — mid-term non-payment stop (before end date only entry)
  DEACTIVATED
  TERMINATED
  EXPIRED
}
```

### CustomerStatus

No new values. When syncing after policy changes:
- Open policies: `ACTIVE` | `PENDING_ACTIVATION` | `SUSPENDED`
- Non-open: `INACTIVE` | `EXPIRED` | `DEACTIVATED` | `TERMINATED` (do not keep customer “open”)
- Terminate path may set customer `TERMINATED` when no open policies remain; otherwise reuse existing `syncCustomerStatusAfterPolicyChange` extended for `INACTIVE`

### StatusChangeTrigger

Reuse existing:

```prisma
enum StatusChangeTrigger {
  MANUAL_ADMIN
  MODIFY_PRODUCT
  PAYMENT_LIFECYCLE   // payment-driven grace/suspend/restore/renew/expire
  SYSTEM              // daily job / customer sync
}
```

---

## Policy model additions

```prisma
model Policy {
  // ... existing ...

  /// Grace overlay (status remains ACTIVE when true)
  inGracePeriod          Boolean   @default(false)
  graceEnteredAt         DateTime?
  /// Anchor: next unpaid expected due date that opened this overdue episode
  overdueAnchorDueDate   DateTime?
  /// When status became SUSPENDED (for >30 day → INACTIVE clock; before end only)
  suspendedAt            DateTime?
  /// When status became INACTIVE
  inactivatedAt          DateTime?
  /// When status became EXPIRED
  expiredAt              DateTime?

  lifecycleNotifications PolicyLifecycleNotification[]
}
```

**Partial unique index** (unchanged predicate):

```sql
-- ACTIVE | PENDING_ACTIVATION | SUSPENDED only
-- INACTIVE not included
```

---

## PolicyLifecycleNotification (new)

Idempotent scheduled/event notification ledger.

```prisma
model PolicyLifecycleNotification {
  id          String   @id @default(uuid()) @db.Uuid
  policyId    String   @db.Uuid
  scheduleKey String   // e.g. PENDING_D3, GRACE_D7, RENEWAL_BEFORE_30, SUSPEND_D1
  templateKey String
  sentAt      DateTime @default(now())
  metadata    Json?

  policy Policy @relation(fields: [policyId], references: [id])

  @@unique([policyId, scheduleKey])
  @@index([policyId])
  @@map("policy_lifecycle_notifications")
}
```

### Schedule keys (normative)

| scheduleKey | When |
|-------------|------|
| `PENDING_D3` / `PENDING_D7` | Day 3 / Day 7 still pending (day-0 welcome = existing `customer_created`, not a new key) |
| `GRACE_DUE` | Due date / enter grace |
| `GRACE_D7` / `GRACE_D10` / `GRACE_D13` | Overdue day markers |
| `SUSPEND_D1` / `SUSPEND_D7` / `SUSPEND_D13` | Suspended reminders |
| `INACTIVE_NOTICE` | Entered Inactive |
| `REACTIVATE` | Restored to Active before end |
| `RENEWAL_BEFORE_30` … `RENEWAL_AFTER_30` | Expiry schedule points |
| `TERMINATE` | Admin terminate |

---

## EntityStatusChange usage

Every transition writes `EntityStatusChange` with:

| Transition | trigger |
|------------|---------|
| Daily grace/suspend/inactive/expire | `SYSTEM` |
| Payment activate/restore/renew | `PAYMENT_LIFECYCLE` |
| Admin Terminate / Activate / Deactivate | `MANUAL_ADMIN` |

Metadata examples: `{ overdueDays, anchorDueDate, arrears, surplus, newPolicyId, scheduleKey }`.

---

## State machine (policy)

```text
PENDING_ACTIVATION --first payment--> ACTIVE
ACTIVE --overdue 1-14d--> ACTIVE + inGracePeriod
ACTIVE+grace --overdue >14d--> SUSPENDED (clear grace; set suspendedAt)
SUSPENDED --arrears+2w before end--> ACTIVE
SUSPENDED --≥30d suspended AND before end--> INACTIVE
SUSPENDED --end date passed--> SUSPENDED (frozen)
INACTIVE --restore rules before end--> ACTIVE
INACTIVE --end date passed--> EXPIRED
ACTIVE/grace --end date passed--> EXPIRED
EXPIRED --renewal payment / surplus--> new ACTIVE (+ supersession); old stays EXPIRED
SUSPENDED past end --surplus after debt--> new ACTIVE; old stays SUSPENDED
* --admin Terminate--> TERMINATED
DEACTIVATED / TERMINATED --payment lifecycle--> ignored
```

**Invariant**: Never set `ACTIVE` if `endDate` has passed (calendar UTC).

---

## Renewal / supersession

On new policy create (expiry renew or post–end surplus):

| Field | Rule |
|-------|------|
| `policyNumber` | Generate new |
| `paymentAcNumber` | Copy from prior (null prior first if unique constraint requires, same as modify) |
| Member numbers | Copy principal/dependant member numbers onto new policy members |
| `startDate` | Within 30d of expiry: day after old `endDate`; else payment date |
| `endDate` | `policyEndDateFromStart(startDate)` (same time of day as start) |
| `supersedesPolicyId` / `supersededByPolicyId` | Link pair |
| Package/plan/scheme/cadence | Copy from prior unless product rules say otherwise |

Surplus payment row(s) attach to **new** `policyId`; debt portion stays on old.

---

## Due date & amounts (logical)

Not stored as a schedule table in v1; computed:

- `nextUnpaidExpectedDueDate(policy, asOf)`
- `daysOverdue(policy, asOf)`
- `outstandingArrears(policy, asOf)`
- `twoWeekUpfrontAmount(policy)`
- `oneMonthPremiumAmount(policy)`
- `amountRequiredToRestore(policy)` — Suspended: arrears + 2 weeks; Inactive &lt;30d: same; Inactive ≥30d: one month (before end only)

---

## Validation rules

1. Terminate: non-empty `reason` / description required.
2. Activate: status must be `SUSPENDED`, `endDate` not passed.
3. Restore via payment: paid amount ≥ required; `endDate` not passed.
4. Daily job: skip `DEACTIVATED`, `TERMINATED`; Suspended past end: no Inactive/Expired auto-change.
5. Notification insert: ignore unique violation (already sent).

---

## Migration notes

- `npx prisma migrate dev --name policy_payment_lifecycle` (never `db push`).
- Add enum value `INACTIVE` with PostgreSQL `ALTER TYPE ... ADD VALUE`.
- Backfill: `suspendedAt` null OK; job sets on next suspend.
- Seed messaging templates in `seed-messaging.sql` (idempotent `ON CONFLICT`).
