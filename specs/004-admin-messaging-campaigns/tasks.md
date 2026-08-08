# Tasks: Admin Messaging Campaigns

**Input**: Design documents from `/specs/004-admin-messaging-campaigns/`  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/openapi.yaml](./contracts/openapi.yaml), [quickstart.md](./quickstart.md)

**Tests**: **TDD required for API/domain.** For each story: write failing Jest tests first, confirm they fail, then implement until green (`apps/api/src/modules/messaging/campaigns/__tests__/` and messaging `__tests__/`). **UI** (pills, colors, compose layout) is validated via Spec Independent Tests + [quickstart.md](./quickstart.md) — no new frontend test framework in this feature.

**Organization**: Phases by user story (P1 → P3) so each increment is independently testable.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Parallelizable (different files, no incomplete dependency)
- **[USn]**: User story label (story phases only)
- Every task includes an exact file path

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold campaign module + frontend deps without schema changes yet

- [X] T001 Create campaigns module folders `apps/api/src/modules/messaging/campaigns/` and `apps/api/src/modules/messaging/campaigns/__tests__/` plus DTO stub `apps/api/src/dto/messaging/campaign.dto.ts` per [plan.md](./plan.md)
- [X] T002 [P] Add `sanitize-html` (or chosen sanitizer) dependency in `apps/api/package.json`
- [X] T003 [P] Add placeholder catalog constant file `apps/api/src/modules/messaging/campaigns/campaign-placeholders.ts` (customer + policy keys for compose picker)
- [X] T004 [P] Add frontend API stubs for campaigns in `apps/agent-registration/src/lib/api.ts` (preview/create/list/get/cancel/CSV method signatures)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, settings, seeds, shared audience/preflight, worker/webhook hooks — MUST complete before story work

**⚠️ CRITICAL**: No user story implementation until this phase completes

### Tests first (Foundational)

> Write these tests FIRST; ensure they FAIL before implementation tasks below

- [X] T005 [P] Write failing unit tests for HTML sanitizer (strip script/handlers, allow basic rich-text tags) in `apps/api/src/modules/messaging/campaigns/__tests__/campaign-html.sanitizer.spec.ts`
- [X] T006 [P] Write failing unit tests for audience expand/skip/dedupe in `apps/api/src/modules/messaging/campaigns/__tests__/campaign-audience.service.spec.ts` covering: scheme union, both contact phones, paste resolve, content-hash, **include `isTestUser` customers (FR-019)**, **phone→254… and email trim+lowercase (FR-021b)**, reject selecting inactive schemes/packages when building audience from IDs (FR-017a/FR-018a)
- [X] T007 [P] Write failing unit tests for preflight block vs soft-skip + sample selection in `apps/api/src/modules/messaging/campaigns/__tests__/campaign-preflight.service.spec.ts` (sample order: customerId, policyId, normalizedAddress nulls last per FR-029; empty HTML body via stripped plain-text length 0 per FR-009a)

### Implementation (Foundational)

- [X] T008 Extend Prisma enums/models in `apps/api/prisma/schema.prisma` per [data-model.md](./data-model.md): `MessagingCampaignStatus`, `MessagingCampaign`, `MessagingCampaignAuditEvent`, `MessagingDelivery.campaignId` / `handedOffAt` / `receiptConfirmedAt`, `MessagingDeliveryStatus.CANCELLED`
- [X] T009 Create and apply Prisma migration via `pnpm exec prisma migrate dev --name admin_messaging_campaigns` from `apps/api` (never `db push`)
- [X] T010 [P] Extend `MessagingSettingsSnapshot` + defaults + `assignFromJson` in `apps/api/src/modules/messaging/messaging.types.ts` and `apps/api/src/modules/messaging/settings/system-settings.service.ts` (`campaignConfirmThreshold`, `campaignSmsDelaySeconds`, `campaignEmailDelaySeconds`, `campaignIdempotencyWindowMinutes`)
- [X] T011 [P] Seed admin shells + routes + settings + bump `system_settings_meta` in `apps/api/prisma/seed-messaging.sql` (`admin_template_sms`, `admin_template_email`)
- [X] T012 Implement HTML sanitizer helper in `apps/api/src/modules/messaging/campaigns/campaign-html.sanitizer.ts` until T005 passes
- [X] T013 Define campaign types/status helpers in `apps/api/src/modules/messaging/campaigns/campaign.types.ts`
- [X] T014 Implement audience expand/skip/render/dedupe in `apps/api/src/modules/messaging/campaigns/campaign-audience.service.ts` until T006 passes (normalization, test users, inactive scheme/package rejection)
- [X] T015 Implement preflight orchestration in `apps/api/src/modules/messaging/campaigns/campaign-preflight.service.ts` until T007 passes
- [X] T016 Wire campaign providers into `apps/api/src/modules/messaging/messaging.module.ts`
- [X] T017 Set `handedOffAt` when provider accept succeeds in `apps/api/src/modules/messaging/messaging.worker.ts`; skip `CANCELLED` deliveries
- [X] T018 Set `receiptConfirmedAt` on SMS delivery-success webhook paths in `apps/api/src/modules/messaging/africas-talking-webhook.service.ts`; for EMAIL leave receipt unset unless a receipt signal exists (FR-037)
- [X] T019 [P] Write unit tests for settings snapshot coercion of new campaign keys in `apps/api/src/modules/messaging/__tests__/system-settings-campaign.spec.ts` (or extend existing settings tests)

**Checkpoint**: Schema + settings + audience/preflight green under Jest; delivery progress fields ready

---

## Phase 3: User Story 1 — Compose and send SMS campaign (P1) 🎯 MVP

**Goal**: Admin can preview and send an SMS campaign with delay → dispatcher → pre-rendered deliveries → customer Messages tab

**Independent Test**: SMS campaign to one scheme with `{first_name}`; preview → confirm if needed → delay → deliveries; linked customer shows message on Messages tab

### Tests for User Story 1 ⚠️

> Write these tests FIRST; ensure they FAIL before implementation

- [X] T020 [P] [US1] Write failing unit/integration tests for SMS `preview` (counts, sample order, empty-body 422, missing filters 422, **`largeAudienceWarning` at ≥5000**) in `apps/api/src/modules/messaging/campaigns/__tests__/campaign.service.preview.spec.ts`
- [X] T021 [P] [US1] Write failing unit/integration tests for SMS `create` → `DELAYED`, name confirmation, **optional Idempotency-Key**, name+body+audience window, **immutability (no content update after DELAYED)**, **`en` language on campaign** in `apps/api/src/modules/messaging/campaigns/__tests__/campaign.service.create.spec.ts`
- [X] T022 [P] [US1] Write failing unit tests for dispatcher claiming DELAYED SMS campaigns and creating pre-rendered PENDING deliveries with `campaignId` and **`requestedLanguage`/`usedLanguage` = `en`** in `apps/api/src/modules/messaging/campaigns/__tests__/campaign.dispatcher.spec.ts`

### Implementation for User Story 1

- [X] T023 [US1] Add campaign DTOs + validation in `apps/api/src/dto/messaging/campaign.dto.ts` aligned with `specs/004-admin-messaging-campaigns/contracts/openapi.yaml`; use `ValidationException` / `ErrorCodes` / `status` + correlationId (FR-034a)
- [X] T024 [US1] Implement `CampaignService.preview` / `create` (SMS path) in `apps/api/src/modules/messaging/campaigns/campaign.service.ts` until T020–T021 pass (immutable after Send per FR-032a)
- [X] T025 [US1] Implement `CampaignDispatcher` cron in `apps/api/src/modules/messaging/campaigns/campaign.dispatcher.ts` until T022 passes (non-prod redirect on enqueue; English-only)
- [X] T026 [US1] Expose POST `/internal/messaging/campaigns/preview` and POST `/internal/messaging/campaigns` (admin-only) in `apps/api/src/controllers/internal/messaging-campaigns.controller.ts` (standardized errors FR-034a; optional Idempotency-Key)
- [X] T027 [US1] Register controller in `apps/api/src/modules/messaging/messaging.module.ts`
- [X] T028 [P] [US1] Build placeholder composer (pills + picker) in `apps/agent-registration/src/components/messaging/placeholder-composer.tsx`
- [X] T029 [P] [US1] Build campaign preview panel in `apps/agent-registration/src/components/messaging/campaign-preview-panel.tsx`
- [X] T030 [US1] Implement SMS compose page in `apps/agent-registration/src/app/(main)/admin/campaigns/compose/page.tsx`
- [X] T031 [US1] Wire compose API client calls in `apps/agent-registration/src/lib/api.ts`
- [X] T032 [US1] Add nav link to Campaigns in `apps/agent-registration/src/app/(main)/admin/layout.tsx` (admin-visible)

**Checkpoint**: SMS MVP green (Jest + manual Independent Test)

---

## Phase 4: User Story 2 — Compose and send email campaign (P1)

**Goal**: Email tab with subject + HTML, email-only audiences, soft-skips, email delay default

**Independent Test**: Email campaign to scheme contacts; missing emails soft-skipped; sendable contacts receive HTML email

### Tests for User Story 2 ⚠️

- [X] T033 [P] [US2] Write failing tests for EMAIL preview/create (subject required, phone-list rejected, HTML sanitized FR-010a, empty chrome body FR-009a, soft-skip missing emails, receiptConfirmed may stay 0) in `apps/api/src/modules/messaging/campaigns/__tests__/campaign.service.email.spec.ts`
- [X] T034 [P] [US2] Extend dispatcher tests for `admin_template_email` pre-rendered subject/HTML deliveries in `apps/api/src/modules/messaging/campaigns/__tests__/campaign.dispatcher.spec.ts`

### Implementation for User Story 2

- [X] T035 [US2] Extend `CampaignService` / preflight for EMAIL in `apps/api/src/modules/messaging/campaigns/campaign.service.ts` and `campaign-preflight.service.ts` until T033 passes
- [X] T036 [US2] Ensure dispatcher creates email deliveries in `apps/api/src/modules/messaging/campaigns/campaign.dispatcher.ts` until T034 passes
- [X] T037 [P] [US2] Add TipTap rich text email editor in `apps/agent-registration/src/components/messaging/rich-text-email-editor.tsx` (add TipTap deps in `apps/agent-registration/package.json` as needed)
- [X] T038 [US2] Extend compose UI Email tab in `apps/agent-registration/src/app/(main)/admin/campaigns/compose/page.tsx`

**Checkpoint**: Email path green under tests + Independent Test

---

## Phase 5: User Story 3 — Preflight block + CSV (P1)

**Goal**: Blocking placeholder failures; session CSV on preview; FAILED_PREFLIGHT + `_failedX` rename + Sentry on Send; soft-skip CSV without Sentry

**Independent Test**: `{policy_number}` unresolvable → preview CSV no history; Send → `*_failed1` + Sentry; soft-skips alone do not block

### Tests for User Story 3 ⚠️

- [X] T039 [P] [US3] Write failing tests: preview with blocking errors creates no campaign row; returns error rows in `apps/api/src/modules/messaging/campaigns/__tests__/campaign.service.preflight.spec.ts`
- [X] T040 [P] [US3] Write failing tests: Send with blocking errors saves FAILED_PREFLIGHT renamed `{name}_failedX`, frees original name, no deliveries in `apps/api/src/modules/messaging/campaigns/__tests__/campaign.service.preflight.spec.ts`
- [X] T041 [P] [US3] Write failing tests: soft-skips alone do not Sentry; blocking Send does (mock Sentry) in `apps/api/src/modules/messaging/campaigns/__tests__/campaign.service.preflight.spec.ts`
- [X] T042 [P] [US3] Write failing tests for CSV serialization columns (name, phone/email, customerId, error) in `apps/api/src/modules/messaging/campaigns/__tests__/campaign-csv.spec.ts`

### Implementation for User Story 3

- [X] T043 [US3] Implement failed-preflight persist + `_failedX` rename + audit in `apps/api/src/modules/messaging/campaigns/campaign.service.ts` until T039–T041 pass
- [X] T044 [US3] Emit Sentry recreate context only for blocking Send in `apps/api/src/modules/messaging/campaigns/campaign.service.ts`
- [X] T045 [US3] Add GET errors.csv / skips.csv in `apps/api/src/controllers/internal/messaging-campaigns.controller.ts` until T042 covered
- [X] T046 [US3] Return blockingErrors/softSkips in preview DTOs in `apps/api/src/dto/messaging/campaign.dto.ts`
- [X] T047 [US3] Add preview-session CSV download + Send failure UX in `apps/agent-registration/src/app/(main)/admin/campaigns/compose/page.tsx` and `campaign-preview-panel.tsx`

**Checkpoint**: Preflight/CSV/rename/Sentry rules green

---

## Phase 6: User Story 4 — Cancel + completed with failures (P2)

**Goal**: Cancel in delay or after dispatch (PENDING→CANCELLED); terminal Completed with failures

**Independent Test**: Cancel during delay; cancel mid-dispatch; mixed failures → COMPLETED_WITH_FAILURES

### Tests for User Story 4 ⚠️

- [X] T048 [P] [US4] Write failing tests: cancel DELAYED → CANCELLED, zero deliveries / no handoffs in `apps/api/src/modules/messaging/campaigns/__tests__/campaign.service.cancel.spec.ts`
- [X] T049 [P] [US4] Write failing tests: cancel DISPATCHING cancels PENDING only; leaves SENT/handed-off untouched in `apps/api/src/modules/messaging/campaigns/__tests__/campaign.service.cancel.spec.ts`
- [X] T050 [P] [US4] Write failing tests: dispatcher finalizes COMPLETED vs COMPLETED_WITH_FAILURES in `apps/api/src/modules/messaging/campaigns/__tests__/campaign.dispatcher.spec.ts`

### Implementation for User Story 4

- [X] T051 [US4] Implement `CampaignService.cancel` in `apps/api/src/modules/messaging/campaigns/campaign.service.ts` until T048–T049 pass
- [X] T052 [US4] Mark remaining PENDING/RETRY_WAIT deliveries CANCELLED on cancel in `apps/api/src/modules/messaging/campaigns/campaign.service.ts`
- [X] T053 [US4] Finalize COMPLETED / COMPLETED_WITH_FAILURES in `apps/api/src/modules/messaging/campaigns/campaign.dispatcher.ts` until T050 passes
- [X] T054 [US4] Expose POST `/internal/messaging/campaigns/{id}/cancel` in `apps/api/src/controllers/internal/messaging-campaigns.controller.ts`
- [X] T055 [US4] Add countdown + cancel controls in `apps/agent-registration/src/app/(main)/admin/campaigns/[campaignId]/page.tsx`

**Checkpoint**: Cancel + terminal status green under Jest

---

## Phase 7: User Story 5 — Campaign history & audit (P2)

**Goal**: List/detail with progress counts + audit; customer_care read-only history

**Independent Test**: As customer_care, view history/detail/CSVs; no compose/send/cancel

### Tests for User Story 5 ⚠️

- [X] T056 [P] [US5] Write failing tests for list/get progress aggregates (targeted/handedOff/receiptConfirmed) + audit payload in `apps/api/src/modules/messaging/campaigns/__tests__/campaign.service.history.spec.ts` (EMAIL fixture may have receiptConfirmed=0 with handedOff > 0 per FR-037)
- [X] T057 [P] [US5] Write failing RBAC tests: customer_care can GET list/detail/CSV; cannot POST preview/create/cancel in `apps/api/src/modules/messaging/campaigns/__tests__/messaging-campaigns.controller.rbac.spec.ts`

### Implementation for User Story 5

- [X] T058 [US5] Implement list/get + progress aggregates + audit in `apps/api/src/modules/messaging/campaigns/campaign.service.ts` until T056 passes
- [X] T059 [US5] Expose GET list/detail with RBAC in `apps/api/src/controllers/internal/messaging-campaigns.controller.ts` until T057 passes
- [X] T060 [US5] Build campaigns history list in `apps/agent-registration/src/app/(main)/admin/campaigns/page.tsx`
- [X] T061 [US5] Complete campaign detail page in `apps/agent-registration/src/app/(main)/admin/campaigns/[campaignId]/page.tsx`
- [X] T062 [US5] Allow customer_care on history routes only; hide compose/templates/cancel in `apps/agent-registration/src/app/(main)/admin/layout.tsx` and campaign pages

**Checkpoint**: History + RBAC green; compose remains admin-only

---

## Phase 8: User Story 6 — Edit system templates (P2)

**Goal**: Separate Templates UI for non-admin shells; edit/save live templates; no campaign send

**Independent Test**: Edit a system template and save; compose still only uses admin shells; Templates has no Send

### Tests for User Story 6 ⚠️

- [X] T063 [P] [US6] Write failing tests: list with `excludeAdminCampaignShells=true` omits `admin_template_sms` / `admin_template_email` in `apps/api/src/modules/messaging/__tests__/messaging-templates.admin-shells.spec.ts`
- [X] T064 [P] [US6] Write failing tests: PATCH non-admin template updates body; PATCH/reject admin shells as non-editable campaign templates per product rules in `apps/api/src/modules/messaging/__tests__/messaging-templates.admin-shells.spec.ts`

### Implementation for User Story 6

- [X] T065 [US6] Ensure list/PATCH supports `excludeAdminCampaignShells` and admin-shell guard in `apps/api/src/controllers/internal/messaging.controller.ts` (and/or templates service) until T063–T064 pass
- [X] T066 [US6] Build Templates admin page in `apps/agent-registration/src/app/(main)/admin/messaging-templates/page.tsx`
- [X] T067 [US6] Add Templates nav (admin-only) in `apps/agent-registration/src/app/(main)/admin/layout.tsx`
- [X] T068 [US6] Confirm compose does not load/save non-admin template keys in `apps/agent-registration/src/app/(main)/admin/campaigns/compose/page.tsx`

**Checkpoint**: Template edit separated from campaigns; tests green

---

## Phase 9: User Story 7 — Multi-scheme / multi-policy dedupe (P3)

**Goal**: Harden union + per-(customer,policy) expansion + address+content dedupe across modes

**Independent Test**: Identical multi-scheme body → one send; differing policy placeholders → two; overlapping contact+customer identical → one

### Tests for User Story 7 ⚠️

- [x] T069 [P] [US7] Write failing fixture tests for SC-005 / SC-006 / overlapping modes in `apps/api/src/modules/messaging/campaigns/__tests__/campaign-audience.dedupe.spec.ts`
- [x] T070 [P] [US7] Write failing tests for per-scheme counts with combinable modes in `apps/api/src/modules/messaging/campaigns/__tests__/campaign-preflight.service.spec.ts`

### Implementation for User Story 7

- [x] T071 [US7] Harden multi-scheme union + policy expansion in `apps/api/src/modules/messaging/campaigns/campaign-audience.service.ts` until T069 passes
- [x] T072 [US7] Fix per-scheme recipient counts in `apps/api/src/modules/messaging/campaigns/campaign-preflight.service.ts` and `apps/agent-registration/src/components/messaging/campaign-preview-panel.tsx` until T070 passes

**Checkpoint**: Dedupe fixtures match Spec SC-005 / SC-006

---

## Phase 10: Polish & Cross-Cutting

**Purpose**: Full test suite, lint, docs, quickstart

- [x] T073 Run full campaign-related Jest suite under `apps/api` (`pnpm --filter api test` or project-equivalent path covering `campaigns/__tests__` and messaging template tests) and fix failures
- [x] T074 [P] Document feature pointer from `docs/proposals/admin-messaging-campaigns.md` to `specs/004-admin-messaging-campaigns/`
- [x] T075 Run `pnpm lint` from repo root and fix issues introduced by this feature
- [ ] T076 Execute manual paths in `specs/004-admin-messaging-campaigns/quickstart.md` (SMS happy path, failed preflight rename, email soft-skip, customer_care read-only, non-prod redirect spot-check) — **manual; for you to run locally**
- [x] T077 [P] Ensure large-audience warning (≥5000) and confirm threshold UX copy on `apps/agent-registration/src/app/(main)/admin/campaigns/compose/page.tsx`
- [x] T078 Verify customer-linked campaign deliveries appear on existing Messages tab (`apps/agent-registration` customer messaging tab) — code path: dispatcher sets `customerId` + `campaignId` on `MessagingDelivery`; Messages tab lists by `customerId` with no campaign exclusion (spot-check after a real send still recommended)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup** → no deps  
- **Phase 2 Foundational** → after Setup; **blocks all stories**; tests T005–T007 before impl T012–T015  
- **US1–US7** → after Foundational; each story: **tests → impl**  
- **Polish** → after desired stories; includes full Jest run (T073)  

### User Story Dependencies

| Story | Depends on | Notes |
|-------|------------|--------|
| US1 SMS | Foundation | MVP |
| US2 Email | Foundation + US1 API/UI shell | Extends compose |
| US3 Preflight CSV | US1 create/preview | Rename/Sentry/CSV |
| US4 Cancel | US1 dispatcher | Status finalization |
| US5 History | US1 create | CC role gating |
| US6 Templates | Foundation | Parallel after Foundation |
| US7 Dedupe | Audience service | Extends foundation tests |

### Parallel Opportunities

- T005–T007 failing tests in parallel  
- T010–T011 after migration  
- T020–T022 US1 tests in parallel  
- T028–T029 UI while API impl proceeds (after contracts stable)  
- US6 tests/impl parallel with US4/US5 after Foundation  
- T074 parallel with T075–T078  

### Parallel Example: US1 TDD

```bash
# Red
T020 + T021 + T022  # failing tests in parallel

# Green
T023 → T024 → T025 → T026

# UI (can overlap once API shapes stable)
T028 + T029 → T030
```

---

## Implementation Strategy

### MVP First (US1 only, TDD)

1. Phase 1 + Phase 2 (foundation tests red → green)  
2. Phase 3 US1 tests red → implementation green  
3. **STOP** — Jest + Independent Test for SMS  
4. Demo/deploy if ready  

### Incremental Delivery

1. Foundation (TDD) → US1 SMS (TDD)  
2. US3 preflight safety (TDD) before wide use  
3. US4 cancel (TDD)  
4. US2 email (TDD)  
5. US5 history + RBAC (TDD)  
6. US6 templates (TDD)  
7. US7 dedupe (TDD)  
8. Polish + full suite + quickstart  

### Suggested MVP scope

**Foundation + US1** (strongly recommend US3 before production sends).

---

## Task count summary

| Phase | Tasks | Includes tests |
|-------|------:|----------------|
| Setup | T001–T004 | — |
| Foundational | T005–T019 | T005–T007, T019 |
| US1 SMS | T020–T032 | T020–T022 |
| US2 Email | T033–T038 | T033–T034 |
| US3 Preflight | T039–T047 | T039–T042 |
| US4 Cancel | T048–T055 | T048–T050 |
| US5 History | T056–T062 | T056–T057 |
| US6 Templates | T063–T068 | T063–T064 |
| US7 Dedupe | T069–T072 | T069–T070 |
| Polish | T073–T078 | T073 suite run |
| **Total** | **78** | |

---

## Notes

- **Red → green**: do not implement story code before its failing tests exist  
- Colocate API tests under `apps/api/src/modules/messaging/campaigns/__tests__/` (and messaging `__tests__` for templates)  
- **UI TDD out of scope** for pills/colors/compose (G5); use Independent Test + quickstart  
- Do not use `prisma db push`  
- Sync settings snapshot keys on every new `system_settings` key  
- Run `pnpm lint` after TS/JS changes (also T075)  
- Analyze remediations (2026-08-08) folded into Spec FRs 009a/010a/012/021b/029/032a/034/034a/037 and tasks T006–T026/T033/T037/T056
```
