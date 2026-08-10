# Tasks: Package Pricing Storage & Admin Wizard

**Input**: Design documents from `/specs/005-package-pricing-wizard/`  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/openapi.yaml](./contracts/openapi.yaml), [quickstart.md](./quickstart.md)

**Tests**: **Jest TDD for API/domain** (completeness, lookup math, family category, activation gates, suggest-fill). Write failing tests first under `apps/api/src/services/__tests__/` and `apps/api/src/utils/__tests__/`. **UI** validated via Spec Independent Tests + [quickstart.md](./quickstart.md) (no new FE test framework required).

**Organization**: Phases by user story priority so each increment is independently testable.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Parallelizable (different files, no incomplete dependency)
- **[USn]**: User story label (story phases only)
- Every task includes an exact file path

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold pricing DTOs/helpers and FE API stubs without schema changes yet

- [x] T001 Create pricing helper module at `apps/api/src/services/package-pricing/` and DTO file `apps/api/src/dto/packages/package-pricing.dto.ts` per [plan.md](./plan.md) (do not co-locate under product-management; keep dedicated package-pricing folder)
- [x] T002 [P] Add FE API method stubs `getPackagePricing`, `getPackagePricingBySlug`, `putPackagePricing`, `suggestPackagePricingFill`, `createPackagePricingCategory` in `apps/agent-registration/src/lib/api.ts`
- [x] T003 [P] Add shared cadence/soft-loss types stub in `apps/api/src/utils/package-pricing-cadence.util.ts` (export `PAYMENT_CADENCE_DAYS` alignment + floor helper signatures)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, completeness engine, lookup-only installment utils, activation gates — MUST complete before story UI/cutover

**⚠️ CRITICAL**: No user story implementation until this phase completes

### Tests first (Foundational)

> Write these tests FIRST; ensure they FAIL before implementation

- [x] T004 [P] Write failing unit tests for pricing completeness (enabled freqs ∪ ANNUALLY, Member only required, optional Up to N/spouse, amount > 0) in `apps/api/src/services/__tests__/package-pricing-completeness.spec.ts`
- [x] T005 [P] Write failing unit tests removing extrapolate / lookup-only installment + annual in `apps/api/src/utils/__tests__/insurance-installment.util.spec.ts` (extend existing)
- [x] T006 [P] Write failing unit tests for package-aware family category + overflow block + undersized validation in `apps/api/src/utils/__tests__/family-category.util.spec.ts` (extend or replace hardcoded 5/8 tests)
- [x] T007 [P] Write failing unit tests for soft-loss floor + suggest-fill empty cells in `apps/api/src/utils/__tests__/package-pricing-cadence.util.spec.ts`

### Implementation (Foundational)

- [x] T008 Extend Prisma schema in `apps/api/prisma/schema.prisma` per [data-model.md](./data-model.md): enum `PackagePricingCategoryKind`, models `PackagePricingCategory`, `PackagePlanRate`, relations on `Package` / `PackagePlan`
- [x] T009 Create and apply Prisma migration via `pnpm exec prisma migrate dev --name package_pricing_rates` from `apps/api` (never `db push`); confirm RLS auto-enable on new public tables
- [x] T010 Implement completeness calculator in `apps/api/src/services/package-pricing/package-pricing-completeness.ts` until T004 passes
- [x] T011 Refactor `apps/api/src/utils/insurance-installment.util.ts` to lookup-only (delete extrapolate paths) until T005 passes; mirror in `apps/agent-registration/src/lib/insurance-installment.ts`
- [x] T012 Update `apps/api/src/utils/family-category.util.ts` for package bands / overflow / undersized checks until T006 passes
- [x] T013 Implement cadence floor + suggest-fill helpers in `apps/api/src/utils/package-pricing-cadence.util.ts` until T007 passes
- [x] T014 Implement pricing DTOs + validation in `apps/api/src/dto/packages/package-pricing.dto.ts` aligned with `specs/005-package-pricing-wizard/contracts/openapi.yaml`; use `ValidationException` / `ErrorCodes` / `status`
- [x] T015 Add `isPricingComplete` + activate-reject helpers only in `apps/api/src/services/product-management.service.ts` (reject `isActive=true` when incomplete). Do **not** wire auto-deactivate on incomplete-making persists here — that is US3 (T037–T040).
- [x] T016 Auto-seed `MEMBER_ONLY` category on package create in `apps/api/src/services/product-management.service.ts`
- [x] T016a Add `setup_admin` to `AppRoles` in `apps/api/src/utils/roles.util.ts` and `ROLES` in `apps/agent-registration/src/lib/supabase.ts`
- [x] T016b [P] Write failing Jest tests: mutate package/pricing endpoints require `setup_admin`; non-`setup_admin` gets 403; list/read still allowed for `registration_admin` in `apps/api/src/services/__tests__/package-pricing-rbac.spec.ts`
- [x] T016c [P] Write failing Jest tests: only root (bootstrap) user may add/remove `setup_admin` on user role updates; `registration_admin` cannot in `apps/api/src/services/__tests__/setup-admin-role-grant.spec.ts`
- [x] T016d Enforce `setup_admin` on package/pricing mutate paths in `apps/api/src/controllers/internal/product-management.controller.ts` (and related guards) until T016b passes; keep list/detail readable without `setup_admin`
- [x] T016e Restrict granting/revoking `setup_admin` to root/bootstrap user in BA user create/update API (server-side) until T016c passes; find existing user-management service under `apps/api/src/`
- [x] T016f Show `setup_admin` role checkbox only when current user is root in `apps/agent-registration/src/app/(main)/admin/ba-registration/page.tsx` and `apps/agent-registration/src/app/(main)/admin/ba-management/_components/edit-ba-dialog.tsx`
- [x] T016g Gate Create Package / edit / activate UI to `setup_admin` in `apps/agent-registration/src/app/(main)/admin/underwriters/` pages (list remains visible to other admin roles read-only)
- [x] T016h [P] Extend Jest tests in `apps/api/src/services/__tests__/product-management-package-frequencies.spec.ts` (or sibling) to assert package create/update rejects `CUSTOM` frequency (FR-006)
- [x] T016i Update root user seed roles to include `setup_admin` in `apps/api/prisma/seed.ts` (and bootstrap create path if separate); add short backfill note in `specs/005-package-pricing-wizard/quickstart.md` for existing root users

**Checkpoint**: Schema migrated; completeness + lookup-only + family util green under Jest; activate-reject helpers available (auto-deactivate deferred to US3); `setup_admin` RBAC + root-only grant green under Jest; CUSTOM rejected on packages; root seeded with `setup_admin`

---

## Phase 3: User Story 1 — Admin defines complete pricing before activation (P1) 🎯 MVP

**Goal**: Admin can save a full pricing grid and activate only when complete; cannot activate incomplete packages

**Independent Test**: Create package → leave one cell empty → activate blocked; fill all required cells (enabled freqs + annual) → activate → package selectable for registration

### Tests for User Story 1

> Write failing tests FIRST

- [x] T017 [P] [US1] Write failing tests for GET/PUT pricing mapping (drop-in shape, no `pricingMode`) in `apps/api/src/services/__tests__/package-pricing.service.spec.ts`
- [x] T018 [P] [US1] Write failing tests for activate rejected when incomplete in `apps/api/src/services/__tests__/product-management-package-pricing-activate.spec.ts`
- [x] T018b [P] [US1] Write failing tests that saving a complete pricing grid does **not** auto-set `isActive=true` (FR-015 explicit activate only) in `apps/api/src/services/__tests__/product-management-package-pricing-activate.spec.ts` (or sibling)
- [x] T018a [P] [US1] Write failing tests for `POST .../pricing/categories` (Member only uniqueness, Up to N maxMembers uniqueness, ADDITIONAL_SPOUSE at most one) in `apps/api/src/services/__tests__/package-pricing-category.spec.ts`

### Implementation for User Story 1

- [x] T019 [US1] Implement pricing get/put/replace orchestration in `apps/api/src/services/package-pricing/package-pricing.service.ts` until T017 passes
- [x] T020 [US1] Expose `GET/PUT /internal/product-management/packages/:packageId/pricing` in `apps/api/src/controllers/internal/product-management.controller.ts`
- [x] T021 [US1] Wire activate-reject gate on `PUT .../packages/:packageId` until T018 passes in `apps/api/src/services/product-management.service.ts`; ensure complete pricing save paths leave `isActive` unchanged until explicit activate (T018b / FR-015)
- [x] T021a [US1] Implement `POST /internal/product-management/packages/:packageId/pricing/categories` in controller + `apps/api/src/services/package-pricing/package-pricing.service.ts` until T018a passes (create only; auto-deactivate on incomplete is US3)
- [x] T022 [P] [US1] Build pricing grid component (sections × frequencies × plans, double-click edit) in `apps/agent-registration/src/app/(main)/admin/underwriters/packages/[packageId]/_components/package-pricing-grid.tsx`
- [x] T023 [US1] Add Pricing step to package create/edit flow from `apps/agent-registration/src/app/(main)/admin/underwriters/[underwriterId]/_components/create-package-dialog.tsx` and `apps/agent-registration/src/app/(main)/admin/underwriters/packages/[packageId]/page.tsx` (persist step 1 then open pricing)
- [x] T024 [US1] Wire FE pricing load/save via `apps/agent-registration/src/lib/api.ts` and show incomplete/activate controls on package detail `apps/agent-registration/src/app/(main)/admin/underwriters/packages/[packageId]/page.tsx` (after complete save, package stays inactive until explicit activate — FR-015)
- [x] T025 [US1] Support add plan column + add Up to N / Additional spouse category UI calling existing plan create + `POST .../pricing/categories` (T021a) in package pricing grid components under `apps/agent-registration/src/app/(main)/admin/underwriters/packages/[packageId]/_components/`

**Checkpoint**: Admin can complete pricing and activate; incomplete activate blocked (API + UI)

---

## Phase 4: User Story 6 — Migrate Mfanisi Boda/Go rates (P1)

**Goal**: Existing sheet rates landed in DB; Go gaps fillable; static files no longer required for migrated packages

**Independent Test**: GET pricing by slug for `mfanisi-boda` / `mfanisi-go` returns stored bands; Boda matches prior sheet intersections; Go complete after admin fill

### Tests for User Story 6

- [x] T026 [P] [US6] Write failing migration/import mapping tests (JSON categories → kinds/keys/rates) in `apps/api/src/services/__tests__/package-pricing-migrate.spec.ts`

### Implementation for User Story 6

- [x] T027 [US6] Implement import script/seed from `apps/agent-registration/public/product-pricing/mfanisi-boda-pricing.json` and `mfanisi-go-pricing.json` into DB (e.g. `apps/api/prisma/seed-package-pricing.sql` and/or `apps/api/scripts/migrate-package-pricing-json.ts`) until T026 passes
- [x] T028 [US6] Expose `GET /internal/product-management/packages/by-slug/:slug/pricing` in `apps/api/src/controllers/internal/product-management.controller.ts`
- [x] T029 [US6] Document Go UAT fill checklist in `specs/005-package-pricing-wizard/quickstart.md` (ensure incomplete Go cannot activate until filled)

**Checkpoint**: Migrated packages readable by slug; Boda parity; Go fillable

---

## Phase 5: User Story 2 — Drop-in registration / modify / recovery pricing (P1)

**Goal**: Payment UIs use API pricing lookup-only; same agent controls; no static JSON dependency

**Independent Test**: Registration payment for migrated package: plan/category/spouse/frequency work; installment = stored band; annual = stored annual; works with JSON files absent

### Tests for User Story 2

- [x] T030 [P] [US2] Write failing tests for undersized category block when household known in `apps/api/src/utils/__tests__/family-category.util.spec.ts` (extend T006 coverage for FR-019a)

### Implementation for User Story 2

- [x] T031 [US2] Replace `fetch(productPricingPath(...))` with `getPackagePricingBySlug` in `apps/agent-registration/src/app/(main)/register/payment/page.tsx`; remove extrapolate UI copy
- [x] T032 [P] [US2] Same pricing source swap in `apps/agent-registration/src/app/(main)/dashboard/recovery/page.tsx`
- [x] T033 [P] [US2] Same pricing source swap in `apps/agent-registration/src/app/(main)/customer/[customerId]/_components/modify-product-dialog.tsx`
- [x] T034 [US2] Enforce undersized category / overflow messaging on payment submit when household size is known; skip undersize check while size unknown; enforce spouse add-on rules (FR-020) in `apps/agent-registration/src/app/(main)/register/payment/page.tsx` (and modify/recovery as applicable)
- [x] T035 [US2] Remove or stop using `productPricingPath` in `apps/agent-registration/src/lib/insurance-installment.ts`; delete unused `PricingMode` extrapolate branches FE+API
- [x] T036 [US2] Delete static files `apps/agent-registration/public/product-pricing/mfanisi-boda-pricing.json` and `mfanisi-go-pricing.json` after consumers switched; update any tests referencing them (e.g. `apps/agent-registration/tests/product-pricing-ui.spec.ts`)

**Checkpoint**: Registration/modify/recovery are drop-in on API pricing; static JSON gone

---

## Phase 6: User Story 3 — Incomplete edit deactivates active package (P2)

**Goal**: Persisting plan/category/frequency that breaks completeness sets `isActive=false` + warning immediately

**Independent Test**: Active complete package → persist new plan without rates → inactive + warning + hidden from registration; complete rates → explicit reactivate

### Tests for User Story 3

- [x] T037 [P] [US3] Write failing tests for plan create / category create / frequency enable forcing deactivate + warning in `apps/api/src/services/__tests__/product-management-package-pricing-deactivate.spec.ts`

### Implementation for User Story 3

- [x] T038 [US3] On plan create incomplete → deactivate + warning in `apps/api/src/services/product-management.service.ts` until T037 passes
- [x] T039 [US3] Wire auto-deactivate + warning on existing `POST .../pricing/categories` (from T021a) when create leaves pricing incomplete — do not re-implement the create endpoint
- [x] T040 [US3] On payment-frequency enable that expands required cells without rates → deactivate in package update path in `apps/api/src/services/product-management.service.ts`
- [x] T041 [US3] Show admin warning banner from API `warning` on package detail / pricing step in `apps/agent-registration/src/app/(main)/admin/underwriters/packages/[packageId]/page.tsx`
- [x] T042 [US3] Ensure inactive packages excluded from **new** registration package pickers (verify `getPackages` default active-only) in agent-registration registration flows; do not add a hard block on in-flight payment submit solely because the package later became inactive (FR-016)

**Checkpoint**: Incomplete-making persist deactivates; warning visible; agents cannot select package

---

## Phase 7: User Story 4 — Soft loss warnings + suggest-fill + previous/new cell UX (P2)

**Goal**: Grid shows soft loss icons; suggest-fill empty cells; editing shows previous+new highlighted

**Independent Test**: Enter weekly &lt; daily×7 → warning, save OK; suggest-fill populates empties; edit shows previous/new

### Implementation for User Story 4

- [x] T043 [US4] Expose `POST .../pricing/suggest-fill` in `apps/api/src/controllers/internal/product-management.controller.ts` using cadence util
- [x] T044 [US4] Add soft-loss indicators on cell edit commit (blur/Enter/confirm) within 1s + non-blocking save in `apps/agent-registration/src/app/(main)/admin/underwriters/packages/[packageId]/_components/package-pricing-grid.tsx`
- [x] T045 [US4] Add suggest-fill action (empty only; confirm before overwrite) in pricing grid component + `apps/agent-registration/src/lib/api.ts`
- [x] T046 [US4] Implement previous/new in-cell display on double-click edit in `package-pricing-grid.tsx`: previous dimmed or struck through; new amount distinct emphasis color (FR-011)

**Checkpoint**: Soft loss + suggest-fill + previous/new UX meet Story 4 Independent Test

---

## Phase 8: User Story 5 — Three-step wizard + Utilization placeholder (P3)

**Goal**: Setup → Pricing → Product Utilization Configuration (empty) → Finish

**Independent Test**: Walk create and edit through three titled steps; Finish returns to package context; no utilization inputs required

### Implementation for User Story 5

- [x] T047 [US5] Extract/create wizard shell with steps 1–3 in `apps/agent-registration/src/app/(main)/admin/underwriters/packages/[packageId]/_components/package-wizard.tsx` (or equivalent under packages/[packageId]/)
- [x] T048 [US5] Implement step 3 Product Utilization Configuration placeholder + Finish in wizard component; wire navigation from create-package and package detail edit
- [x] T049 [US5] Ensure create flow: step 1 persist inactive package → step 2 pricing → step 3 Finish ends on package detail page

**Checkpoint**: Three-step IA complete including empty utilization step

---

## Phase 9: Polish & Cross-Cutting

**Purpose**: Lint, docs, quickstart validation, cleanup

- [x] T050 [P] Update intake status links if needed in `docs/proposals/package-pricing-db-wizard.md`
- [x] T051 [P] Align OpenAPI notes with final routes in `specs/005-package-pricing-wizard/contracts/openapi.yaml` if paths drifted
- [x] T052 Run `pnpm lint` from repo root and fix issues introduced by this feature
- [ ] T053 Execute [quickstart.md](./quickstart.md) smoke paths (wizard, deactivate, registration drop-in, Go UAT notes) — **manual UAT remaining** (API/FE unit tests + migration script verified; walk quickstart in running apps)
- [x] T054 Grep-confirm no remaining `pricingMode` / `extrapolate` / `productPricingPath` usages in registration payment/modify/recovery paths

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup** → no deps
- **Phase 2 Foundational** → Setup; **blocks all stories**
- **Phase 3 US1 (MVP)** → Foundational
- **Phase 4 US6 Migration** → Foundational (ideally after US1 GET/PUT exists; T028 by-slug can land with US6)
- **Phase 5 US2 Drop-in** → US1 pricing GET + US6 by-slug/migration (or seed data)
- **Phase 6 US3 Deactivate** → US1 activate gates
- **Phase 7 US4 Soft loss / suggest-fill** → US1 grid
- **Phase 8 US5 Wizard shell** → US1 pricing step exists
- **Phase 9 Polish** → desired stories complete

### User Story Dependencies

| Story | Depends on |
|-------|------------|
| US1 Admin pricing/activate | Foundational |
| US6 Migration | Foundational (+ US1 PUT helpful) |
| US2 Drop-in FE | US1 GET + US6 slug data |
| US3 Auto-deactivate | US1 (including T021a category create) |
| US4 Soft loss / suggest-fill | US1 grid |
| US5 Wizard step 3 | US1 step 2 |

US1 test cluster: T018 (activate reject) ∥ T018b (no auto-activate) ∥ T018a (category create) before T021 / T021a.
### Parallel Opportunities

- T002–T003 (Setup)
- T004–T007 (Foundational tests)
- T031–T033 (FE consumer swaps)
- T044–T046 after T043 (UI polish within US4)
- T050–T051 (docs)

---

## Parallel Example: Foundational tests

```bash
# Launch together:
Task: T004 package-pricing-completeness.spec.ts
Task: T005 insurance-installment.util.spec.ts (lookup-only)
Task: T006 family-category.util.spec.ts
Task: T007 package-pricing-cadence.util.spec.ts
```

## Parallel Example: User Story 2 FE cutover

```bash
# After by-slug pricing works:
Task: T031 register/payment/page.tsx
Task: T032 dashboard/recovery/page.tsx
Task: T033 modify-product-dialog.tsx
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1 + 2  
2. Phase 3 US1 — admin can price + activate  
3. **STOP and VALIDATE** Independent Test for US1  

### Incremental Delivery

1. US1 → admin MVP  
2. US6 → migrate Boda/Go  
3. US2 → registration drop-in + delete JSON  
4. US3 → deactivate-on-persist  
5. US4 → soft loss + suggest-fill UX  
6. US5 → wizard step 3 shell  
7. Polish + quickstart  

### Suggested MVP scope

**US1 only** (Foundational + Phase 3). Production cutover needs **US6 + US2** before removing static JSON.

---

## Notes

- Never `prisma db push`; use migrate  
- Run `pnpm lint` after TS/JS changes (T052)  
- UI Independent Tests = manual/quickstart unless existing Playwright covers a path  
- Commit after each task or logical group  
- **FR-015**: T018b + T021 assert complete pricing save never auto-activates  
- **RBAC**: T016a–i / FR-024 / FR-024a (`setup_admin`, root-only grant)  
- Soft-loss commit timing and in-flight FR-016 are covered in US4 / US2 + quickstart  
