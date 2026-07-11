# Implementation Plan: Policy Lifecycle & Status Rules

**Branch**: `003-policy-lifecycle` | **Date**: 2026-07-11 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/003-policy-lifecycle/spec.md`

## Summary

Automate **payment-driven and daily** policy status transitions (Pending Activation → Active → Grace overlay → Suspended → Inactive / Expired), **expiry renewal** as a new superseded policy, **admin Terminate** (starter “blacklist”), and **lifecycle SMS** — building on the admin foundation in `002-modify-product-policy` (`PolicyLifecycleService`, `EntityStatusChange`, supersession fields). Waiting periods and claims-based post–end-date routing stay out of scope.

## Technical Context

**Language/Version**: TypeScript 5.3.x, Node.js >= 18  
**Primary Dependencies**: NestJS 11.x, Prisma 6.x, `@nestjs/schedule`, existing messaging outbox, Next.js agent-registration (admin UI)  
**Storage**: PostgreSQL via Prisma migrations (no `db push`)  
**Testing**: Jest unit + integration tests under `apps/api`  
**Target Platform**: Fly.io-hosted NestJS API + agent-registration admin  
**Project Type**: Monorepo web (API + Next.js admin)  
**Performance Goals**: Daily batch completes before next business day (SC-008); payment-driven transitions synchronous with confirmed payment path  
**Constraints**: UTC date math; `ValidationException` + `ErrorCodes`; RBAC `registration_admin` for Terminate; no Active after `endDate`; Suspended frozen after end date for analytics  
**Scale/Scope**: Production policy book overnight evaluation; idempotent notification schedule points

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| I. API-First | Pass | Terminate + optional job trigger via Internal REST; payment hooks in existing payment services |
| II. Prisma migrations / UTC | Pass | Migration for `INACTIVE`, grace fields, notification ledger; all day counts UTC |
| III. Error handling | Pass | ValidationException for Activate-after-end, Terminate reason, insufficient restore amount |
| IV. Code quality | Pass | Strict TS; `pnpm lint` after changes |
| V. Workflow | Pass | Feature branch → PR to staging |
| VI. Stack | Pass | NestJS / Prisma / pnpm |
| VII. Security | Pass | Authentik admin RBAC on Terminate; no public partner terminate |
| VIII. Observability | Pass | EntityStatusChange + Sentry on job failures; correlation IDs on admin calls |

**Post-design re-check**: Pass — design uses migrations, UTC, existing messaging/outbox, admin RBAC; no constitution violations requiring Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/003-policy-lifecycle/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── openapi.yaml
├── checklists/
│   └── requirements.md
└── tasks.md              # /speckit.tasks (not this command)
```

### Source Code (repository root)

```text
apps/api/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/YYYYMMDDHHMMSS_policy_payment_lifecycle/
│   └── seed-messaging.sql          # lifecycle SMS templates
├── src/
│   ├── services/
│   │   ├── policy-lifecycle.service.ts   # extend: terminate, renew, payment apply, daily eval helpers
│   │   ├── policy-lifecycle-job.service.ts  # NEW @Cron daily
│   │   ├── policy-lifecycle-messaging.service.ts  # NEW enqueue lifecycle SMS
│   │   ├── policy.service.ts             # activation dates; block activate after end
│   │   ├── entity-status-change.service.ts
│   │   └── mpesa-*.service.ts            # hook payment-driven transitions
│   ├── utils/
│   │   ├── policy-dates.util.ts          # keep existing same-time-of-day end date
│   │   ├── premium-statement-math.ts     # arrears / 2-week / 1-month amounts
│   │   └── policy-due-date.util.ts       # NEW next unpaid expected due date
│   ├── controllers/internal/
│   │   └── policy-lifecycle.controller.ts  # + terminate; optional job run
│   └── dto/policy-lifecycle/
apps/agent-registration/
└── src/app/(main)/customer/[customerId]/_components/
    ├── products-tab.tsx                  # Terminate menu item
    └── policy-reason-dialog.tsx          # reuse for Terminate
```

**Structure Decision**: Extend existing NestJS API + admin Products tab; no new apps. Daily job via `@nestjs/schedule` (same pattern as attachment retention cleanup).

## Implementation Phases

### Phase A — Schema & due-date primitives

1. Migration: `PolicyStatus.INACTIVE`; Policy grace/suspension clock fields; `PolicyLifecycleNotification` (idempotency); ensure partial unique index still only `ACTIVE|PENDING_ACTIVATION|SUSPENDED`.
2. `policy-due-date.util.ts`: next unpaid expected due date from cadence + paid coverage (reuse premium-statement math / installment slots).
3. Confirm `policyEndDateFromStart` keeps start time-of-day (no 23:59:59 change per FR-001 clarification).

### Phase B — Daily evaluation job

1. `PolicyLifecycleJobService` `@Cron('0 1 * * *')` UTC (configurable): grace enter/exit flags; Active→Suspended; Suspended→Inactive (before end only); Active/Grace→Expired; Inactive→Expired; skip Suspended/Terminated/Deactivated term mutations per spec.
2. Queue scheduled SMS (pending activation D3/D7, grace reminders, suspension, inactive, renewal schedule) with ledger dedupe.
3. Admin/dev `POST .../lifecycle/run-daily` (guarded) for testability.

### Phase C — Payment-driven transitions

1. Central `applyPaymentToPolicyLifecycle(payment)` called from IPN/STK/completed payment paths:
   - First payment → activate (existing) + clear pending reminders
   - Before end: Suspended restore if arrears+2 weeks; Inactive restore rules
   - On/after end: debt first; Suspended debt cleared → Expired; surplus → `renewPolicyFromExpiredOrPostEnd` (new policy #, reuse `paymentAcNumber` + member numbers, supersession)
2. Block admin `activatePolicy` when `endDate` passed (FR-012a).
3. Audit all with `StatusChangeTrigger.PAYMENT_LIFECYCLE` or `SYSTEM`.

### Phase D — Admin Terminate + messaging seed

1. `terminatePolicy` + UI menu next to Reset Start Date (mandatory description).
2. Customer coupling: Terminated only if no remaining Active/Pending/Suspended (Inactive/Expired/Deactivated do not keep customer open); extend sync helper for `INACTIVE`.
3. Seed lifecycle message templates + `PolicyLifecycleMessagingService` (update `MessagingSettingsSnapshot` only if new system_settings keys are required — prefer message_templates only).

### Phase E — Tests & verification

1. Unit: due-date, day boundaries, restore amounts, renew start dates, Suspended-after-end freeze, Terminate multi-policy.
2. Integration: daily job idempotency; payment surplus split; notification ledger unique constraint.

## Risk & mitigations

| Risk | Mitigation |
|------|------------|
| No forward schedule table today | Derive next due from cadence + paid windows; optionally ensure `OUTSTANDING` placeholders for Active policies in job |
| Partial unique + renew | New Active row + old Expired/Suspended; index allows multiple terminal rows |
| Double SMS | Unique `(policyId, scheduleKey)` ledger |
| Surplus split accounting | Single transaction: allocate debt to old `policyId`, create new policy, attach surplus payment row to new |
| Admin Activate vs automation | Shared `assertCanBecomeActive(policy)` gate |

## Out of scope (this branch)

- Waiting periods / service-access evaluation
- Claims-based post–end-date payment routing
- Auto-terminate from utilization + default
- Separate Blacklisted status
- Status history admin UI page (API audit writes only)
- New payment rails

## Complexity Tracking

> None — no constitution violations.

## Verification

- [ ] First payment activates + dates; pending reminders stop
- [ ] Overdue 1–14 → grace; >14 → Suspended; >30 Suspended before end → Inactive
- [ ] Active past end → Expired; Suspended past end stays Suspended; Inactive past end → Expired
- [ ] No Active after end (admin + payment)
- [ ] Surplus after debt creates new policy with new number, reused pay acct + members, supersession
- [ ] Terminate selected policy; customer Terminated only when no open policies
- [ ] Notification schedule points not duplicated
- [ ] `pnpm lint` clean
