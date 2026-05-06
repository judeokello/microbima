# Tasks: Customer Self-Service Portal (`/self/customer`)

**Input**: `/specs/001-customer-self-service/` — [spec.md](./spec.md), [plan.md](./plan.md), [data-model.md](./data-model.md), [research.md](./research.md), [contracts/openapi.yaml](./contracts/openapi.yaml), [quickstart.md](./quickstart.md)  
**Prerequisites**: Phase 2 (Foundational) completes before any [US*] implementation work.  
**Tests**: Spec does not mandate automated tests; **T046** adds a minimal manual QA checklist. Run it before release sign-off.

**Format**: `- [ ] Txxx [P] [USn] Description with file path`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Discovery and env/documentation so implementation matches repo patterns.

- [x] T001 Add portal base URL + Supabase vars documentation for customer flows in `apps/api/env.example` and `apps/agent-registration/.env.example` (or nearest env template)
- [x] T002 [P] Trace reusable API functions from `apps/agent-registration/src/app/(main)/customer/[customerId]/page.tsx` through `apps/agent-registration/src/lib/api.ts` and note customer-portal Bearer requirements in `specs/001-customer-self-service/plan.md` (short “Inventory” bullet) if gaps found
- [x] T003 [P] Inspect `apps/api/src/modules/messaging/settings/system-settings.service.ts` and existing seed patterns for `system_settings` JSON shape before writing FR-016 seeds

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: DB, provisioning, messaging, Nest guards, and Next shell—**blocks all user stories**.

**Checkpoint**: OTP welcome path + Supabase user on create + PIN-complete endpoint callable.

- [x] T004 Add `portalPinSetupCompletedAt DateTime?` to `Customer` in `apps/api/prisma/schema.prisma` and create migration under `apps/api/prisma/migrations/`
- [x] T005 [P] Seed `general_support_number` and `medical_support_number` in `apps/api/prisma/seed.ts` (values per spec FR-016; JSON shape per `SystemSettingsService`)
- [x] T006 Add `apps/api/src/utils/customer-portal-auth.util.ts` with national phone canonicalisation to `07…` and `buildSyntheticCustomerEmail(phone)` returning `{national07, email}`
- [x] T007 [P] Add OTP generation utility (length per [research.md](./research.md) R4; document final choice in research if changed) in `apps/api/src/utils/customer-portal-auth.util.ts` or sibling file
- [x] T008 Extend `apps/api/src/services/supabase.service.ts` with `createCustomerPortalUser` (admin `createUser` with `id: customerId`, synthetic email, password = OTP, `user_metadata.roles` includes `customer`)
- [x] T009 Update `apps/api/src/services/customer.service.ts` to after successful principal create: generate OTP, call `createCustomerPortalUser`, enqueue `customer_created` with placeholders `otp`, `customer_specific_weblogin`, `medical_support_number`, `general_support_number` (resolve support keys via settings service)
- [x] T010 Implement idempotent customer portal Auth provisioning and post-create **retry/reconciliation** in `apps/api/src/services/supabase.service.ts` and `apps/api/src/services/customer.service.ts` per **FR-005** (no duplicate Auth users for the same `customerId`; safe replay after partial failure; document operational retry entry points)
- [x] T011 Extend messaging seed/templates in `apps/api/prisma/seed.ts` (and template storage per existing messaging module) for **`customer_created`** body/placeholders and new template **`portal_pin_setup_complete`** (personal link only; no OTP in follow-up)
- [x] T012 [P] Extend `apps/api/src/modules/messaging/messaging.service.ts` (or placeholder resolver) to inject `medical_support_number` / `general_support_number` from `SystemSetting` when building `customer_created` / follow-up payloads
- [x] T013 Create `apps/api/src/modules/customer-portal/customer-portal.module.ts` with service + controller + guard wiring (path chosen to match eventual OpenAPI)
- [x] T014 Implement Supabase JWT guard (validate JWT, `sub` UUID, ensure `customer` role in `user_metadata.roles`) in `apps/api/src/modules/customer-portal/guards/supabase-customer.guard.ts`
- [x] T015 Implement `apps/api/src/modules/customer-portal/customer-portal.service.ts`: `completePinSetup(customerId, pin, pinConfirm)` → validate 4-digit + match → Supabase admin update password → set `portalPinSetupCompletedAt` → enqueue `portal_pin_setup_complete`
- [x] T016 Implement `POST` pin-complete handler in `apps/api/src/modules/customer-portal/customer-portal.controller.ts` following standardized errors (`status`, `ValidationException`, correlation ID)
- [x] T017 [P] Implement `GET` login display context (masked national phone per DESIGN.md `07•••••` + last 4, firstName, lastName; **uniform 200 body** for unknown `customerId` per spec/OpenAPI) in `customer-portal.controller.ts` for deep-link screen per FR-001a
- [x] T018 [P] Implement `GET` portal status (`portalPinSetupCompletedAt` or boolean) for signed-in customer in `customer-portal.controller.ts` to drive PIN gating on Next side
- [x] T019 Register `CustomerPortalModule` in `apps/api/src/app.module.ts`
- [x] T020 Add `customer` role constant and helper (e.g. `isCustomerRole`) in `apps/agent-registration/src/lib/supabase.ts` alongside existing `ROLES`
- [x] T021 [P] Add Heritage fonts/tokens (Plus Jakarta Sans, Inter, palette from DESIGN.md) via `apps/agent-registration` Tailwind/theme or layout-level CSS variables referencing `specs/001-customer-self-service/design/maishapoa_heritage/DESIGN.md`
- [x] T022 Create `apps/agent-registration/src/app/self/customer/layout.tsx` with logo, footer support lines pattern, and child outlet (visual parity with Stitch shells, not raw HTML paste)
- [x] T023 Update `apps/agent-registration/src/middleware.ts` (if present) or document layout-only guarding: segment `/self/customer` for future role redirects without breaking staff routes

---

## Phase 3: User Story 1 — Generic login (Priority: P1)

**Goal**: Member signs in at `/self/customer` with phone + PIN field (OTP or chosen PIN).

**Independent Test**: Open `/self/customer`, sign in with `07…` + correct secret; land on `/self/customer/:customerId` or PIN setup when incomplete.

- [x] T024 [US1] Implement `apps/agent-registration/src/app/self/customer/page.tsx` generic login UI referencing `specs/001-customer-self-service/design/generic_login_heritage_with_logo/screen.png`
- [x] T025 [US1] Extract form logic into `apps/agent-registration/src/app/self/customer/_components/generic-login-form.tsx` calling `supabase.auth.signInWithPassword` with synthetic email from T006 rules and labels **Phone number** / **PIN** only

---

## Phase 4: User Story 2 — Deep-link login (Priority: P1)

**Goal**: `/self/customer/:customerId` shows masked phone + name; PIN field only; invalid id → generic login without enumeration.

**Independent Test**: Hit deep link; complete sign-in; mismatch session vs URL signs out and clears return path per spec.

- [x] T026 [US2] Implement `apps/agent-registration/src/app/self/customer/[customerId]/page.tsx` (pre-auth) fetching display context from T017 endpoint and rendering per `design/deep_link_login_heritage_with_logo/`
- [x] T027 [US2] Add client sign-in for deep-link flow using same synthetic email mapping + PIN field in `apps/agent-registration/src/app/self/customer/_components/deep-link-login-form.tsx`
- [x] T028 [US2] Implement post-login mismatch handling: if session user id ≠ route `customerId`, `signOut` and `redirect('/self/customer')` without query return URL in `apps/agent-registration/src/app/self/customer/[customerId]/layout.tsx` or dedicated guard component

---

## Phase 5: User Story 3 — First-time forced PIN (Priority: P1)

**Goal**: After OTP sign-in, block main app until 4-digit PIN + confirm; API updates password + DB flag + follow-up SMS; `refreshSession`.

**Independent Test**: New customer completes PIN; OTP no longer works; follow-up message queued; session shows complete.

- [x] T029 [US3] Implement `apps/agent-registration/src/app/self/customer/[customerId]/setup-pin/page.tsx` (or equivalent route) shown when T018 reports incomplete, referencing `design/pin_setup_heritage_with_logo/`
- [x] T030 [P] [US3] Build `apps/agent-registration/src/app/self/customer/_components/pin-setup-form.tsx` with two 4-digit inputs, security tip copy, **Complete Setup** CTA, validation UX
- [x] T031 [US3] Wire PIN form to T016 API with Bearer from Supabase session; on success call `supabase.auth.refreshSession()` and redirect to `apps/agent-registration/src/app/self/customer/[customerId]/page.tsx` (authed home) in `pin-setup-form.tsx`

---

## Phase 6: User Story 5 — Product detail four tabs (Priority: P1)

**Goal**: `/self/customer/:customerId/products/:productId` mirrors staff tabs: Customer details, Products, Payments, Member cards; data customer-scoped.

**Independent Test**: Tabs render with customer JWT; tamper `productId` → same security handling as spec.

- [x] T032 [US5] Create `apps/agent-registration/src/lib/customer-portal-api.ts` wrapping fetch to Nest customer-portal endpoints with `Authorization: Bearer <access_token>`
- [x] T033 [US5] Add Nest read endpoints in `customer-portal.controller.ts` + `customer-portal.service.ts` delegating to existing customer detail / payments / member-card services with **customer guard** and `sub === customerId` checks (narrow DTOs as needed)
- [x] T034 [US5] Create authenticated layout `apps/agent-registration/src/app/self/customer/[customerId]/(portal)/layout.tsx` enforcing session customer id match and shared Heritage chrome
- [x] T035 [US5] Implement `apps/agent-registration/src/app/self/customer/[customerId]/products/[productId]/page.tsx` composing tabs with imports from `apps/agent-registration/src/app/(main)/customer/[customerId]/_components/` (`payments-tab.tsx`, `member-cards-tab.tsx`, etc.) and customer-portal data loaders

---

## Phase 7: User Story 4 — Products list + single-product redirect (Priority: P2)

**Goal**: List at `.../products`; auto-redirect to detail when exactly one product; list still reachable.

**Independent Test**: 0 / 1 / N products behaviours per acceptance scenarios.

- [x] T036 [US4] Implement `apps/agent-registration/src/app/self/customer/[customerId]/products/page.tsx` with product cards per `design/products_list_heritage_with_logo/`
- [x] T037 [US4] Add redirect logic when product count === 1 in `products/page.tsx` (server `redirect()` or client `useEffect` per Next pattern chosen)

---

## Phase 8: User Story 6 — Payments single-plan pre-select (Priority: P2)

**Goal**: Auto-select package-plan filter when one selectable plan in **both** staff and self-service payments views.

**Independent Test**: One-plan vs multi-plan customers on staff page and portal.

- [x] T038 [US6] Update `apps/agent-registration/src/app/(main)/customer/[customerId]/_components/payments-tab.tsx` to pre-select the package-plan control when only one selectable option exists and enable filter as spec requires
- [x] T039 [US6] Ensure self-service payments tab instance passes the same props / uses same component so behaviour matches in `products/[productId]/page.tsx`

---

## Phase 9: User Story 7 — Welcome / OTP / follow-up messaging (Priority: P2)

**Goal**: Requirements SC-005 / SC-006 satisfied; template copy fits SMS length; settings drive numbers.

**Independent Test**: Create customer in dev/staging; inspect outbox/logs for one welcome with all placeholders; complete PIN and see follow-up.

- [ ] T040 [US7] Validate `customer_created` template length and placeholder naming against real SMS provider limits; shorten copy in `apps/api/prisma/seed.ts` or template store if needed without dropping FR-005a elements
- [ ] T041 [US7] Validate `portal_pin_setup_complete` copy and personal URL builder (matches FR-018) in messagingenqueue path in `customer-portal.service.ts`

---

## Phase 10: Polish & Cross-Cutting

- [ ] T042 [DEFERRED 2026-04-09] Legacy backfill script — **no legacy cohort** today (all customers on national `07…` + portal path). Reopen only if a real migration need appears; then add `apps/api/scripts/backfill-customer-portal-users.ts` (Auth users + `portalPinSetupCompletedAt` + OTP rules per research, documented in script header)
- [ ] T043 [P] Align `specs/001-customer-self-service/contracts/openapi.yaml` with final Nest paths and schemas after T016–T018 / T033
- [x] T044 Run `pnpm lint` from repo root `/home/judeokello/Projects/microbima` after TypeScript/JavaScript edits per constitution
- [ ] T045 Walk through `specs/001-customer-self-service/quickstart.md` smoke flow and update that doc with any prerequisite gaps
- [ ] T046 Execute and complete [checklists/qa-implementation.md](./checklists/qa-implementation.md); record environment and sign-off on the checklist (SC-002–SC-006 and core auth flows)

---

## Dependencies & Execution Order

### Phase dependencies

| Phase | Depends on |
|-------|------------|
| 1 Setup | — |
| 2 Foundational | 1 (soft); start 2 once inventory done |
| 3 US1 | 2 |
| 4 US2 | 2 (T017 for context); can parallel US1 after 2 |
| 5 US3 | 2 + partial US1/US2 for navigation context |
| 6 US5 | 2 + US3 for typical authenticated journey |
| 7 US4 | 6 (or reuse product list data service from T033) |
| 8 US6 | 6 (payments tab mounted) |
| 9 US7 | 2 (mostly verification of T009–T012, T015) |
| 10 Polish | Desired stories complete |

### User story completion order (suggested serial MVP)

1. **Foundational (T004–T023)**  
2. **US1** → **US2** → **US3** (auth + PIN)  
3. **US5** (core value)  
4. **US4**, **US6**, **US7** (polish / P2)  
5. **Polish**

### Parallel opportunities

- **T005** ∥ **T006** ∥ **T007** after T004 schema direction is clear (careful: seed may depend on migration applied)
- **T012** ∥ **T017** ∥ **T018** after module skeleton (T013) exists
- **T020** ∥ **T021** while backend tasks progress
- **T030** ∥ **T032** early UI scaffolding after T023
- **T042** ∥ **T043** in polish phase

---

## Parallel example: after Foundational

```text
# Developer A: US1 generic login — T024–T025
# Developer B: US2 deep link — T026–T028 (needs T017 deployed or mocked)
# Developer C: Heritage layout polish — T022 + T021
```

---

## Implementation Strategy

### MVP (smallest shippable)

Complete **Phase 2** + **US1** + **US2** + **US3** (T004–T031): provision customers, sign in with OTP, set PIN, session refresh. No product tabs yet.

### Full feature (spec)

Add **US5**–**US7** + polish (T032–T046).

---

## Task summary

| Metric | Count |
|--------|-------|
| **Total tasks** | 46 |
| **Setup** | 3 |
| **Foundational** | 20 |
| **US1** | 2 |
| **US2** | 3 |
| **US3** | 3 |
| **US5** | 4 |
| **US4** | 2 |
| **US6** | 2 |
| **US7** | 2 |
| **Polish** | 5 |

---

## Notes

- Adjust route group names `(portal)` vs `(authenticated)` to match Next conventions in repo when implementing T034.
- Mixed internal+customer role login remains **out of scope** per spec; guard may only check `customer` for portal module.
