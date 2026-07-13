# Tasks: Policy Lifecycle & Status Rules

**Input**: Design documents from `/specs/003-policy-lifecycle/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Not required by spec (no TDD mandate). Polish phase includes quickstart validation and selective unit coverage for due-date / restore math per plan Phase E.

**Organization**: Tasks grouped by user story (US1–US6) for independent delivery.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete dependencies)
- **[Story]**: US1–US6 maps to spec user stories
- Paths are absolute from repo root under `apps/api` and `apps/agent-registration`

---

## Phase 1: Setup

**Purpose**: Align branch workspace with design docs (no greenfield project)

- [x] T001 Review `specs/003-policy-lifecycle/plan.md`, `data-model.md`, and `contracts/openapi.yaml` against current `apps/api/src/services/policy-lifecycle.service.ts`
- [x] T002 [P] Confirm Nest `ScheduleModule` is registered in `apps/api/src/app.module.ts` (reuse existing pattern from messaging attachment cleanup)

---

## Phase 2: Foundational (Blocking)

**Purpose**: Schema, due-date primitives, shared gates — MUST complete before user stories

**⚠️ CRITICAL**: No user story work until this phase is done

- [x] T003 Add `INACTIVE` to `PolicyStatus` and Policy grace/suspension/expiry clock fields (`inGracePeriod`, `graceEnteredAt`, `overdueAnchorDueDate`, `suspendedAt`, `inactivatedAt`, `expiredAt`) in `apps/api/prisma/schema.prisma`
- [x] T004 Add `PolicyLifecycleNotification` model with `@@unique([policyId, scheduleKey])` in `apps/api/prisma/schema.prisma`
- [x] T005 Create Prisma migration (never `db push`) via `cd apps/api && npx prisma migrate dev --name policy_payment_lifecycle` ensuring partial unique index still only `ACTIVE|PENDING_ACTIVATION|SUSPENDED`
- [x] T006 [P] Confirm `policyEndDateFromStart` in `apps/api/src/utils/policy-dates.util.ts` keeps start time-of-day on end date (no 23:59:59 change); use as-is for activation/renewal
- [x] T007 [P] Implement next unpaid expected due date + overdue days + restore amount helpers in `apps/api/src/utils/policy-due-date.util.ts` (reuse `premium-statement-math.ts` / installment slot logic). **Formula:** 2-week upfront = `ceil(14 / paymentCadenceDays) × installmentAmount`; one month = `ceil(31 / paymentCadenceDays) × installmentAmount`
- [x] T008 Extend `syncCustomerStatusAfterPolicyChange` in `apps/api/src/services/policy-lifecycle.service.ts` so `INACTIVE` is non-open (like `EXPIRED`/`DEACTIVATED`)
- [x] T009 Add shared `assertPolicyMayBecomeActive` (reject after `endDate`, Terminated/Deactivated/Expired) in `apps/api/src/services/policy-lifecycle.service.ts` and call from existing `activatePolicy`
- [x] T009a Add empty `PolicyLifecycleJobService` stub (injectable, no-op or TODO `runDaily`) in `apps/api/src/services/policy-lifecycle-job.service.ts` and register in `apps/api/src/app.module.ts` so US1 can depend on the module without full cron logic
- [x] T009b Document/enforce: every status change and grace enter/exit MUST write `EntityStatusChange` (correct trigger) — implement helper used by all lifecycle methods in `apps/api/src/services/policy-lifecycle.service.ts` / `entity-status-change.service.ts`

**Checkpoint**: Schema applied; due-date util + Active gate + job stub + audit helper ready

**Note (FR-007):** Creating policies as `PENDING_ACTIVATION` on registration already exists in onboarding — this feature does not re-implement create-customer policy insert.

---

## Phase 3: User Story 1 — Activate on first payment (P1) 🎯 MVP

**Goal**: First qualifying premium activates policy with 12-month dates; pending-activation reminders D0/D3/D7 when still unpaid

**Independent Test**: Create pending policy → first payment → Active + dates; without payment, D3/D7 reminders enqueue once

### Implementation

- [x] T010 [US1] Ensure first-payment activation continues to use `policyDatesFromPayment` / `policyEndDateFromStart` in `apps/api/src/services/policy.service.ts` / payment completion paths (`mpesa-ipn.service.ts`, `mpesa-stk-push.service.ts`)
- [x] T011 [P] [US1] Add pending-activation reminder templates for **D3 and D7 only** in `apps/api/prisma/seed-messaging.sql` (do **not** add a new welcome template; day-0 uses existing `customer_created`)
- [x] T012 [US1] Create `PolicyLifecycleMessagingService` in `apps/api/src/modules/messaging/policy-lifecycle-messaging.service.ts` with ledger insert into `policy_lifecycle_notifications` before enqueue
- [x] T013 [US1] Wire pending-activation D3/D7 reminder scheduling via `PolicyLifecycleMessagingService` + daily eval helpers callable from the job stub (do **not** put full cron logic in US1) in `apps/api/src/services/policy-lifecycle.service.ts` / messaging service
- [x] T014 [US1] Skip remaining pending reminders when first payment activates (mark schedule keys or cancel) from payment completion hook in `apps/api/src/services/policy-lifecycle.service.ts`

**Checkpoint**: US1 independently testable per quickstart activation + reminder dedupe

---

## Phase 4: User Story 2 — Grace period (P1)

**Goal**: Overdue 1–14 days vs next unpaid expected due date → Active + grace overlay + grace SMS schedule

**Independent Test**: Set overdue 1–14 days → run daily → `inGracePeriod=true`, status Active; pay before day 15 → grace cleared

### Implementation

- [x] T015 [US2] Implement grace enter/update/clear logic (set `inGracePeriod`, `graceEnteredAt`, `overdueAnchorDueDate`) in `apps/api/src/services/policy-lifecycle.service.ts`
- [x] T016 [P] [US2] Add grace reminder templates (`GRACE_DUE`, `GRACE_D7`, `GRACE_D10`, `GRACE_D13`) in `apps/api/prisma/seed-messaging.sql`
- [x] T017 [US2] Enqueue grace schedule-point messages via `apps/api/src/modules/messaging/policy-lifecycle-messaging.service.ts` with unique `scheduleKey`s
- [x] T018 [US2] Invoke grace evaluation from daily job for Active policies in `apps/api/src/services/policy-lifecycle-job.service.ts`

**Checkpoint**: US2 works with daily run; member-facing status remains Active

---

## Phase 5: User Story 3 — Suspend & restore (P1)

**Goal**: Overdue &gt;14 days → Suspended; before end date, arrears + 2 weeks → Active; never Active after end date

**Independent Test**: Overdue &gt;14 → Suspended; pay arrears+2w before end → Active; Activate/pay restore after end → rejected / debt-only

### Implementation

- [x] T019 [US3] Implement Active/Grace → Suspended transition (clear grace, set `suspendedAt`, audit `PAYMENT_LIFECYCLE`/`SYSTEM`) in `apps/api/src/services/policy-lifecycle.service.ts`
- [x] T020 [US3] Implement Suspended → Active restore when paid ≥ arrears + 2 weeks **and** `endDate` not passed in `apps/api/src/services/policy-lifecycle.service.ts`; if paid &lt; required, throw `ValidationException` (no silent partial restore)
- [x] T021 [US3] Implement `applyPaymentToPolicyLifecycle` in `apps/api/src/services/policy-lifecycle.service.ts` and hook from completed-payment paths for **prepaid and postpaid**: `mpesa-ipn.service.ts`, `mpesa-stk-push.service.ts`, on-demand STK completion in `customer.service.ts`, and manual/admin payment completion paths that mark payments `COMPLETED` (including postpaid member payment completion where applicable)
- [x] T022 [US3] On/after end date: apply payment to debt only (no Active); when Suspended debt reaches **zero** → set **EXPIRED**; surplus above debt → renew; reject admin Activate via `assertPolicyMayBecomeActive`; use `ValidationException` for insufficient restore amounts in `apps/api/src/services/policy-lifecycle.service.ts`
- [x] T023 [P] [US3] Add suspension / reactivation SMS templates in `apps/api/prisma/seed-messaging.sql` and enqueue from transitions in `apps/api/src/modules/messaging/policy-lifecycle-messaging.service.ts`

**Checkpoint**: US3 suspend/restore + post-end Activate block verified

---

## Phase 6: User Story 4 — Inactive / Expired / renewal (P1)

**Goal**: Suspended ≥30d before end → Inactive; term-end rules; renewal new policy (new number, reuse pay acct + members); surplus after debt renews

**Independent Test**: Suspended &gt;30d before end → Inactive; Active past end → Expired; Suspended past end stays Suspended; surplus payment creates new Active + supersession

### Implementation

- [x] T024 [US4] Implement Suspended → Inactive when `suspendedAt` age ≥30 days **and** before end date; set `inactivatedAt` in `apps/api/src/services/policy-lifecycle.service.ts`
- [x] T025 [US4] Implement term-end transitions: Active/Grace → Expired; Inactive → Expired; Suspended/Terminated/Deactivated unchanged in `apps/api/src/services/policy-lifecycle.service.ts`
- [x] T026 [US4] Implement Inactive restore before end (within 30d: arrears+2w; after 30d: one month) in `apps/api/src/services/policy-lifecycle.service.ts`
- [x] T027 [US4] Implement `renewPolicyFromPrior` (new policy number, reuse `paymentAcNumber` + member numbers, supersession, start date within/after 30d rules; when renewing from Suspended-past-end after debt cleared, prior → **EXPIRED**) in `apps/api/src/services/policy-lifecycle.service.ts`
- [x] T028 [US4] Split post–end-date overpayment: debt on old policyId, surplus triggers renew in `applyPaymentToPolicyLifecycle` in `apps/api/src/services/policy-lifecycle.service.ts`
- [x] T029 [P] [US4] Add inactive / renewal SMS templates in `apps/api/prisma/seed-messaging.sql` and schedule keys for renewal windows in `apps/api/src/modules/messaging/policy-lifecycle-messaging.service.ts`
- [x] T030 [US4] Extend policy display labels for `INACTIVE` in `apps/api/src/utils/policy-display.util.ts`

**Checkpoint**: US4 expiry/renewal/surplus paths independently testable

---

## Phase 7: User Story 5 — Admin Terminate (P2)

**Goal**: Terminate action beside Reset Start Date; mandatory reason; selected policy Terminated; customer Terminated only if no open policies

**Independent Test**: Terminate one of two open policies → policy Terminated, customer not; terminate last open → customer Terminated; registration gate still blocks

### Implementation

- [x] T031 [US5] Add `TerminatePolicyRequestDto` / response fields in `apps/api/src/dto/policy-lifecycle/policy-lifecycle.dto.ts`
- [x] T032 [US5] Implement `terminatePolicy` (audit `MANUAL_ADMIN`, notification, customer coupling Option C) in `apps/api/src/services/policy-lifecycle.service.ts`
- [x] T033 [US5] Expose `POST .../policies/:policyId/terminate` in `apps/api/src/controllers/internal/policy-lifecycle.controller.ts` per `specs/003-policy-lifecycle/contracts/openapi.yaml`
- [x] T034 [P] [US5] Add `terminateCustomerPolicy` client in `apps/agent-registration/src/lib/api.ts`
- [x] T035 [US5] Add Terminate menu item + reason dialog on admin Products tab in `apps/agent-registration/src/app/(main)/customer/[customerId]/_components/products-tab.tsx` (reuse `policy-reason-dialog.tsx`)
- [x] T036 [P] [US5] Add terminate SMS template in `apps/api/prisma/seed-messaging.sql` and send from `terminatePolicy`

**Checkpoint**: US5 admin Terminate UX + API complete

---

## Phase 8: User Story 6 — Daily automated processing (P1)

**Goal**: Once-daily UTC evaluation orchestrating grace/suspend/inactive/expire + renewal notification schedule; idempotent; manual run endpoint

**Independent Test**: Seed boundary policies → `POST /internal/policies/lifecycle/run-daily` → expected transitions; second run same day does not duplicate SMS ledger rows

### Implementation

- [x] T037 [US6] Flesh out `PolicyLifecycleJobService` with `@Cron('0 1 * * *')` UTC calling evaluation methods in `apps/api/src/services/policy-lifecycle-job.service.ts` (stub from T009a)
- [x] T038 [US6] Confirm job provider registration in `apps/api/src/app.module.ts` (may already be done in T009a)
- [x] T039 [US6] Add `POST /internal/policies/lifecycle/run-daily` (admin-guarded) returning batch counters per `specs/003-policy-lifecycle/contracts/openapi.yaml` in `apps/api/src/controllers/internal/policy-lifecycle.controller.ts` (or dedicated controller)
- [x] T040 [US6] Ensure job skips `DEACTIVATED`/`TERMINATED` for payment-lifecycle mutations and freezes Suspended after end per spec in `apps/api/src/services/policy-lifecycle-job.service.ts`
- [x] T041 [US6] Queue renewal reminder schedule points (before/after expiry) with ledger dedupe in `apps/api/src/services/policy-lifecycle-job.service.ts` + messaging service
- [x] T042 [US6] Add Sentry/error logging for job failures in `apps/api/src/services/policy-lifecycle-job.service.ts`
- [x] T042a [US6] Log daily-run wall-clock duration (and counts) so ops can verify SC-008 overnight batch window in `apps/api/src/services/policy-lifecycle-job.service.ts`

**Checkpoint**: Full daily automation matches quickstart flows 1–2 and 6

---

## Phase 9: Polish & Cross-Cutting

**Purpose**: Verification, lint, docs consistency

- [x] T043 [P] Add unit tests for due-date / restore amounts / renew start dates in `apps/api/src/utils/__tests__/policy-due-date.util.spec.ts`
- [x] T044 [P] Add unit tests for Suspended-after-end debt→Expired and Terminate multi-policy coupling in `apps/api/src/services/__tests__/policy-lifecycle.service.spec.ts`
- [ ] T045 Run manual scenarios from `specs/003-policy-lifecycle/quickstart.md` against local API
- [x] T046 Run `pnpm lint` from repo root `~/Projects/microbima` and fix issues in touched TS/JS files
- [x] T047 [P] Update Swagger decorators on new endpoints to match `specs/003-policy-lifecycle/contracts/openapi.yaml`
- [x] T048 Confirm every lifecycle path calls the EntityStatusChange helper (T009b) — checklist pass in code review

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup** → **Phase 2 Foundational** (blocks all stories)
- **US1–US5** can proceed after Foundational; **US6** depends on US2–US4 evaluation methods existing (orchestrates them)
- **US5 (Terminate)** independent of grace/suspend once Foundational + customer sync done
- **Polish** after desired stories complete

### User Story Dependencies

```text
Foundational
    ├── US1 Activate + pending reminders
    ├── US2 Grace          ──┐
    ├── US3 Suspend/restore ─┼──► US6 Daily job (orchestration)
    ├── US4 Inactive/Expire/Renew ──┘
    └── US5 Terminate (can parallel with US2–US4)
```

### Parallel Opportunities

- T006 || T007 after schema migration starts
- T011 || T016 || T023 || T029 || T036 template seed edits (coordinate single file sequentially if conflicting)
- T034 || T031 after service contract known
- T043 || T044 in Polish

### Parallel Example: After Foundational

```bash
# Dev A: US1 activation + messaging
# Dev B: US5 Terminate API + UI
# Dev C: US2/US3 grace+suspend (then US4, then US6)
```

---

## Implementation Strategy

### MVP First

1. Phase 1–2 Foundational  
2. **US1** (activation dates + pending reminders)  
3. Stop and validate first-payment path  

### Recommended incremental path

1. US1 → US2 → US3 → US4 → US6 (automation spine)  
2. US5 Terminate can ship anytime after Foundational  
3. Polish + quickstart  

### Suggested MVP scope

**US1 only** proves term dates + activation messaging hooks; production value for lifecycle requires **US2+US3+US6** minimum for grace/suspend automation.

---

## Task count summary

| Phase | Story | Tasks |
|-------|-------|-------|
| Setup | — | T001–T002 (2) |
| Foundational | — | T003–T009, T009a–b |
| US1 Activate | US1 | T010–T014 (5) |
| US2 Grace | US2 | T015–T018 (4) |
| US3 Suspend/restore | US3 | T019–T023 (5) |
| US4 Inactive/Expire/Renew | US4 | T024–T030 (7) |
| US5 Terminate | US5 | T031–T036 (6) |
| US6 Daily job | US6 | T037–T042 (6) |
| Polish | — | T043–T047 (5) |
| **Total** | | **52** (T001–T009, T009a–b, T010–T042, T042a, T043–T048) |

---

## Notes

- Do not implement waiting periods or claims-based payment routing (out of scope)
- Prefer `message_templates` over new `system_settings` keys; if settings added, sync `MessagingSettingsSnapshot`
- All status writes must use `EntityStatusChange` with correct trigger
- Commit after each logical task group; run `pnpm lint` after TS/JS changes
