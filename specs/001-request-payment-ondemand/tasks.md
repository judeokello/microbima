# Tasks: On-Demand Payment Request

**Input**: `/home/judeokello/Projects/microbima/specs/001-request-payment-ondemand/` (plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md)

**Prerequisites**: plan.md, spec.md

**Tests**: Not explicitly required by spec; no dedicated test tasks. Add later if team adopts TDD for the new endpoint.

**Format**: `- [ ] T### [P?] [US#?] Description with absolute file path`

---

## Phase 1: Setup (shared)

**Purpose**: Infra/doc items that reduce integration surprises before backend/UI work.

- [ ] T001 [P] Align `PaymentStatusGateway` browser origin allowlist with admin/agent-registration deployment needs in `/home/judeokello/Projects/microbima/apps/api/src/gateways/payment-status.gateway.ts` (see `/home/judeokello/Projects/microbima/specs/001-request-payment-ondemand/research.md` R1).

---

## Phase 2: Foundational (blocking)

**Purpose**: API shapes and orchestration **all user stories** depend on. Complete before US1–US5 UI polish.

**Checkpoint**: Policy detail exposes billing mode; on-demand STK orchestration callable from internal API.

- [ ] T002 Add `schemeBillingMode` (`prepaid` | `postpaid`) to customer policy detail DTO/Swagger in `/home/judeokello/Projects/microbima/apps/api/src/dto/customers/customer-products.dto.ts`.
- [ ] T003 Populate `schemeBillingMode` from linked scheme `isPostpaid` in `getCustomerPolicyDetail` in `/home/judeokello/Projects/microbima/apps/api/src/services/customer.service.ts` (extend scheme `select` with `isPostpaid`; **FR-022**: emit **Sentry** `captureMessage` warning when prepaid and `policy.premium === 0` on this fetch).
- [ ] T004 [P] Add `schemeBillingMode` to `CustomerPolicyDetail` in `/home/judeokello/Projects/microbima/apps/agent-registration/src/lib/api.ts`.
- [ ] T005 Add validated request DTO for on-demand STK body (mode, installmentCount, customAmountKes, phoneNumber) in `/home/judeokello/Projects/microbima/apps/api/src/dto/customers/ondemand-stk-payment.dto.ts`.
- [ ] T006 Inject `MpesaStkPushService` into `CustomerService` and implement on-demand flow (authorize, reject postpaid, create `policy_payments` placeholder `PENDING-STK-*`, call `initiateStkPush`, return `wsToken`) in `/home/judeokello/Projects/microbima/apps/api/src/services/customer.service.ts`.
- [ ] T007 Expose `POST /internal/customers/:customerId/policies/:policyId/ondemand-stk` with correlation id header in `/home/judeokello/Projects/microbima/apps/api/src/controllers/internal/customer.controller.ts`.
- [ ] T008 [P] If FR-011 audit requires it, extend `PaymentDto` and `getCustomerPayments` mapping for `paymentStatus` in `/home/judeokello/Projects/microbima/apps/api/src/dto/customers/customer-payments-filter.dto.ts` and `/home/judeokello/Projects/microbima/apps/api/src/services/customer.service.ts`.

---

## Phase 3: User Story 1 — Trigger Payment Request (Priority: P1) — MVP core

**Goal**: After payments filter succeeds for a **prepaid** policy, staff see **Request payment**, open a dialog with prefilled phone, and submit triggers API + STK initiation.

**Independent Test**: Filter payments by package-plan for a prepaid customer; button enabled; dialog opens; submit returns 201 + `wsToken` / `stkPushRequestId` (per existing STK contract).

- [ ] T009 [US1] Pass customer phone into `PaymentsTab` from `/home/judeokello/Projects/microbima/apps/agent-registration/src/app/(main)/customer/[customerId]/page.tsx` and extend `/home/judeokello/Projects/microbima/apps/agent-registration/src/app/(main)/customer/[customerId]/_components/payments-tab.tsx` props for FR-007 prefilled phone.
- [ ] T010 [US1] Implement FR-021 empty **Package – Plan** list messaging and postpaid-disable copy for `Request payment` in `/home/judeokello/Projects/microbima/apps/agent-registration/src/app/(main)/customer/[customerId]/_components/payments-tab.tsx`.
- [ ] T011 [US1] Add typed `initiateCustomerOndemandStk` client in `/home/judeokello/Projects/microbima/apps/agent-registration/src/lib/api.ts` targeting the new internal route.
- [ ] T012 [US1] Add `request-payment-dialog.tsx` under `/home/judeokello/Projects/microbima/apps/agent-registration/src/app/(main)/customer/[customerId]/_components/request-payment-dialog.tsx` and wire open/close + submit from `/home/judeokello/Projects/microbima/apps/agent-registration/src/app/(main)/customer/[customerId]/_components/payments-tab.tsx`.

---

## Phase 4: User Story 2 — Installments vs Custom Amount (Priority: P1)

**Goal**: Mutually exclusive modes, KES math for installments 1–5, validation, FR-022 Sentry when premium missing.

**Independent Test**: Toggle modes; only active mode submitted; invalid phone blocked client+server; Sentry fires on open/submit when installment amount absent (prepaid).

- [ ] T013 [US2] Build installment dropdown (1–5), computed total, and custom amount field with exclusivity in `/home/judeokello/Projects/microbima/apps/agent-registration/src/app/(main)/customer/[customerId]/_components/request-payment-dialog.tsx`.
- [ ] T014 [US2] Reuse or mirror registration phone validation (10 chars, `01`/`07`) in `/home/judeokello/Projects/microbima/apps/agent-registration/src/app/(main)/customer/[customerId]/_components/request-payment-dialog.tsx`.
- [ ] T015 [US2] Complete server-side validation and `ValidationException` for modes, bounds (1–70000), postpaid, and missing `paymentAcNumber` in `/home/judeokello/Projects/microbima/apps/api/src/services/customer.service.ts`.
- [ ] T016 [US2] Add FR-022 Sentry warning **(client)** on dialog open and submit when premium/installment data missing in `/home/judeokello/Projects/microbima/apps/agent-registration/src/app/(main)/customer/[customerId]/_components/request-payment-dialog.tsx` (**server** capture on policy detail fetch: **T003**).

---

## Phase 5: User Story 4 — Prepaid/Postpaid Pill (Priority: P1)

**Goal**: Policy summary shows **prepaid** / **postpaid** pill next to Category/plan (FR-020).

**Independent Test**: Open product detail; pill matches API `schemeBillingMode`.

- [ ] T017 [US4] Render billing pill **immediately to the right of the plan name** (`product.planName` row; Category / plan in spec FR-020) using `schemeBillingMode` in `/home/judeokello/Projects/microbima/apps/agent-registration/src/app/(main)/customer/[customerId]/_components/policy-detail-view.tsx`.

---

## Phase 6: User Story 3 — Realtime + Browser Notifications (Priority: P2)

**Goal**: Reuse onboarding WS pattern; optional Notifications API; refresh payments table per FR-011 Option C.

**Independent Test**: After STK, WS updates UI; closing dialog still gets notification when permitted; payments list updates like onboarding for comparable statuses.

**Acceptance notes (analysis G1)**:

- **Deduped updates**: If multiple WS events arrive for the same STK request, UI and table refresh MUST NOT duplicate transaction rows — treat updates idempotently (same pattern as onboarding).
- **List consistency**: Refetch or patch list so it reflects backend state without manual reload, matching comparable onboarding rows for each status.

- [ ] T018 [US3] Integrate `usePaymentStatus` with API response `stkPushRequestId` / `wsToken` in `/home/judeokello/Projects/microbima/apps/agent-registration/src/app/(main)/customer/[customerId]/_components/request-payment-dialog.tsx` (or parent wiring in `payments-tab.tsx`). Use **`mapStkGatewayStatusToSpecVocabulary`** from `/home/judeokello/Projects/microbima/apps/agent-registration/src/lib/payment-status-vocabulary.ts` for FR-019 notification copy (single mapping helper).
- [ ] T019 [P] [US3] Align Socket.IO base URL behavior with onboarding for admin builds in `/home/judeokello/Projects/microbima/apps/agent-registration/src/hooks/usePaymentStatus.ts`.
- [ ] T020 [US3] Add `Notification.requestPermission` gating and notification body/title using **`mapStkGatewayStatusToSpecVocabulary`** from `/home/judeokello/Projects/microbima/apps/agent-registration/src/lib/payment-status-vocabulary.ts` in `/home/judeokello/Projects/microbima/apps/agent-registration/src/app/(main)/customer/[customerId]/_components/request-payment-dialog.tsx` or small colocated helper under `/home/judeokello/Projects/microbima/apps/agent-registration/src/app/(main)/customer/[customerId]/_components/`.
- [ ] T021 [US3] On WS terminal/intermediate rules matching onboarding, refetch `getCustomerPayments` (or equivalent) in `/home/judeokello/Projects/microbima/apps/agent-registration/src/app/(main)/customer/[customerId]/_components/payments-tab.tsx`.
- [ ] T027 [US3] When **`selectedPolicyId`** / package-plan filter changes in `/home/judeokello/Projects/microbima/apps/agent-registration/src/app/(main)/customer/[customerId]/_components/payments-tab.tsx`, **disconnect** the active Socket.IO client / clear `usePaymentStatus` subscription and reset in-flight STK dialog state so no stale updates attach to the wrong policy (analysis G2).

---

## Phase 7: User Story 5 — Administrator Contact (Priority: P2)

**Goal**: Unresolved policy after filter shows contact-administrator path only (FR-021); API errors consistent.

**Independent Test**: Simulate no policy / failed detail load; banner shows; API rejects safely.

- [ ] T022 [US5] Show administrator-contact banner when policy detail is missing after successful filter selection in `/home/judeokello/Projects/microbima/apps/agent-registration/src/app/(main)/customer/[customerId]/_components/payments-tab.tsx` (complements **T010** empty package-plan list; **T010** = no policies in dropdown; **T022** = filter ran but detail unresolved).
- [ ] T023 [US5] Map not-found / postpaid / validation failures to standard error DTO with `status` in `/home/judeokello/Projects/microbima/apps/api/src/services/customer.service.ts` and `/home/judeokello/Projects/microbima/apps/api/src/controllers/internal/customer.controller.ts`.

---

## Phase 8: Polish & cross-cutting

- [ ] T024 [P] Complete Swagger decorators for new route(s) in `/home/judeokello/Projects/microbima/apps/api/src/controllers/internal/customer.controller.ts`.
- [ ] T025 Run `pnpm lint` from `/home/judeokello/Projects/microbima` after TypeScript/JavaScript changes.
- [ ] T026 Walk through `/home/judeokello/Projects/microbima/specs/001-request-payment-ondemand/quickstart.md` and update that doc if env prerequisites change.
- [ ] T028 [P] Document new validation/error scenarios for the on-demand STK endpoint (standard error shape, `status`, correlation id) in `/home/judeokello/Projects/microbima/docs/development/error-handling-guide.md` per workspace API rules.

---

## Dependencies & execution order

### Phase dependencies

- **Phase 1** → may run anytime.
- **Phase 2** → **blocks** Phases 3–7.
- **Phase 3–7** → start after Phase 2; recommended sequence **US1 → US2 → US4 → US3 → US5** (US4 can start after T002–T004 if UI-only pill is prioritized).
- **Phase 8** → after desired stories complete.

### User story dependencies

| Story | Depends on |
|-------|------------|
| US1 | Foundational |
| US2 | US1 dialog + API (T012+) |
| US4 | Foundational (T002–T004); independent of dialog |
| US3 | US1 submit returning `wsToken`; **T027** clears WS when package-plan selection changes |
| US5 | US1 payments tab filters |

### Parallel examples

- **After Phase 2**: Developer A: US1–US2 (`payments-tab.tsx`, `request-payment-dialog.tsx`); Developer B: US4 (`policy-detail-view.tsx`); Developer C: T008 payment DTO audit.
- **Within US3**: T019 [P] while T018 proceeds if env/config only; **T027** alongside T018–T021 (same files) when touching `payments-tab.tsx`.

---

## Implementation strategy

### MVP (smallest shippable)

1. Complete **Phase 2** (Foundational).
2. Complete **Phase 3** + **Phase 4** (US1 + US2) for end-to-end STK on prepaid.
3. Add **Phase 5** (US4) before wide rollout so postpaid/disabled state is obvious.

### Full feature

Add **Phase 6** (WS + notifications + list refresh) and **Phase 7** (admin messaging hardening), then **Phase 8**.

---

## Task summary

| Metric | Value |
|--------|-------|
| **Total tasks** | 28 |
| **Phase 1** | 1 |
| **Phase 2** | 7 |
| **US1** | 4 |
| **US2** | 4 |
| **US4** | 1 |
| **US3** | 5 |
| **US5** | 2 |
| **Polish** | 4 |
| **[P] parallel** | T001, T004, T008, T019, T024, T028 |

**Format validation**: All lines use `- [ ] Tnnn` with file path; `[US#]` only on Phases 3–7; `[P]` only where parallel-safe.
