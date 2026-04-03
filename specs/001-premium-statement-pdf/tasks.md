# Tasks: Customer Premium Statement PDF

**Input**: Design documents from `/home/judeokello/Projects/microbima/specs/001-premium-statement-pdf/`  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/openapi.yaml](./contracts/openapi.yaml)

**Tests**: Not explicitly requested in spec — no mandatory TDD tasks; optional test task in Polish phase.

**Organization**: Phases follow user story priorities (P1: US1, US2, US4; P2: US3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallelizable (different files, no ordering dependency within phase)
- **[Story]**: [US1]–[US4] for user-story phases only

---

## Phase 1: Setup (shared)

**Purpose**: Confirm assets and contracts before schema work.

- [x] T001 Verify logo file exists at `apps/api/assets/maishapoalogo-nobg.png` and is referenced by PDF generator
- [x] T002 [P] Align `specs/001-premium-statement-pdf/contracts/openapi.yaml` with final route path under `apps/api` global prefix (e.g. `/api`)

---

## Phase 2: Foundational (blocking)

**Purpose**: Schema + package APIs + policy detail enrichment + payments list filters — **must complete before PDF UI and statement service integration.**

**Checkpoint**: Migrations applied; packages can store `productDurationDays`; customer policy detail exposes duration for Payments tab.

- [x] T003 Add `productDurationDays Int?` to `Package` model in `apps/api/prisma/schema.prisma` with `@@map` unchanged
- [x] T004 Create Prisma migration under `apps/api/prisma/migrations/` via `npx prisma migrate dev --name package_product_duration_days` (no `db push` on tracked DBs)
- [x] T005 [P] Add optional `productDurationDays` to `CreatePackageRequestDto` and `UpdatePackageRequestDto` with `@IsOptional()`, `@IsInt()`, `@Min(1)`, `@Max(365)` in `apps/api/src/dto/packages/package.dto.ts`
- [x] T006 Add `productDurationDays` to `PackageDetailDto` in `apps/api/src/dto/packages/package.dto.ts` for API responses
- [x] T007 Persist `productDurationDays` on `package.create` and `updatePackage` in `apps/api/src/services/product-management.service.ts` (default **365** on create when omitted per [research.md](./research.md))
- [x] T008 [P] Extend `CustomerPolicyDetailDto` / nested product or enrollment object in `apps/api/src/dto/customers/customer-products.dto.ts` to include `productDurationDays` (nullable)
- [x] T009 Include `package: { select: { productDurationDays: true, name: true } }` (or equivalent) in `getCustomerPolicyDetail` query in `apps/api/src/services/customer.service.ts` and map to DTO
- [x] T010 [P] Extend `CustomerPaymentsFilterDto` in `apps/api/src/dto/customers/customer-payments-filter.dto.ts` with optional `paymentStatus` (array or CSV), `page`, `pageSize`
- [x] T011 Refactor `getCustomerPayments` in `apps/api/src/services/customer.service.ts` to apply `paymentStatus IN (...)` when provided and paginate when `page`/`pageSize` set; preserve backward-compatible defaults for existing callers
- [x] T012 Update `getCustomerPolicyDetail` / `totalPaidToDate` logic in `apps/api/src/services/customer.service.ts` to sum only `COMPLETED` + `COMPLETED_PENDING_RECEIPT` when aligning with spec (avoid drift with statement) — or document follow-up if out of scope for this PR

---

## Phase 3: User Story 1 — Generate Premium Statement from Payments (Priority: P1) MVP

**Goal**: Download PDF from Payments tab after filter; confirmed rows only; full row set; postpaid disabled; filename per spec; amounts match Payments formatting.

**Independent Test**: Prepaid policy + confirmed payments in range → **Generate report** downloads PDF with correct row count and header fields per [spec.md](./spec.md) US1.

### Implementation

- [x] T013 [US1] Create `PremiumStatementService` (or equivalent) in `apps/api/src/services/premium-statement.service.ts` with dependencies on `PrismaService`, `ConfigService`, Sentry
- [x] T014 [P] [US1] Implement React-PDF document component(s) for statement layout (header, table columns per spec) under `apps/api/src/services/` or `apps/api/src/modules/premium-statement/` — embed logo from `apps/api/assets/maishapoalogo-nobg.png` via `readFileSync` or bundled path
- [x] T015 [US1] Implement `buildStatementFilename(...)` sanitization per **FR-010** in `apps/api/src/services/premium-statement.service.ts`
- [x] T016 [US1] Implement data loaders: policy, customer, package, packagePlan, scheme postpaid check (reuse same pattern as `getCustomerPolicyDetail` / on-demand STK) in `premium-statement.service.ts`
- [x] T017 [US1] Query confirmed payments for PDF table: `policyId`, `fromDate`/`toDate` on `expectedPaymentDate`, statuses `COMPLETED` + `COMPLETED_PENDING_RECEIPT` in `premium-statement.service.ts`
- [x] T018 [US1] Compute filtered total, all-time sum, and premium-due + excess per [research.md](./research.md) in `premium-statement.service.ts` (UTC boundaries)
- [x] T019 [US1] Add `GET :customerId/policies/:policyId/premium-statement` handler in `apps/api/src/controllers/internal/customer.controller.ts` returning PDF bytes with `Content-Type: application/pdf` and `Content-Disposition` attachment filename
- [x] T020 [P] [US1] Register `PremiumStatementService` in `apps/api/src/app.module.ts` providers (or customer module if extracted)
- [x] T021 [P] [US1] Add `getPremiumStatementPdf(customerId, policyId, fromDate, toDate, userId, roles)` wrapper in `apps/api/src/services/customer.service.ts` delegating to `PremiumStatementService` with `canUserAccessCustomer` guard
- [x] T022 [P] [US1] Add client helper `getPremiumStatement(...)` in `apps/agent-registration/src/lib/api.ts` (fetch blob, handle errors)
- [x] T023 [US1] Add **Generate report** button, disabled rules (no confirmed rows, postpaid, not filtered), and `blob` download in `apps/agent-registration/src/app/(main)/customer/[customerId]/_components/payments-tab.tsx`
- [x] T024 [P] [US1] Pass same date filters as list when requesting PDF; ensure dashboard/admin customer routes using `PaymentsTab` receive consistent props if duplicated components exist under `apps/agent-registration/src/app/(main)/dashboard/customer/` and `admin/customer/`
- [x] T025 [US1] Replace hardcoded `PREMIUM_DAYS_PER_YEAR` / `276` usage in `payments-tab.tsx` with `policyDetail` field from API for installment helper when `productDurationDays` present

---

## Phase 4: User Story 2 — Block Statement When Policy Data Is Invalid (Priority: P1)

**Goal**: No PDF + in-page errors + Sentry warning for missing policy number, start date, zero premium, missing package duration.

**Independent Test**: Each invalid state returns 422 (or domain-appropriate) + banner message; Sentry warning fired — per US2.

- [x] T026 [US2] Throw `ValidationException` (or `UnprocessableEntityException` with `ValidationException` pattern) for each **FR-008** case in `apps/api/src/services/premium-statement.service.ts` before PDF render
- [x] T027 [P] [US2] Call `Sentry.captureMessage` / warning with tags (`feature: premium_statement`, reason) for each block path in `premium-statement.service.ts`
- [x] T028 [US2] Map API error body to user-visible banners in `apps/agent-registration/src/app/(main)/customer/[customerId]/_components/payments-tab.tsx` for generate action (reuse error display patterns)
- [x] T029 [US2] Ensure **FR-013**: unauthorized users get same outcome as `getCustomerPayments` (404) in `premium-statement.service.ts` / controller

---

## Phase 5: User Story 4 — Configure Product Duration on Packages (Priority: P1)

**Goal**: Admins set 1–365 on create/update; Payments tab uses value; unavailable helper when null.

**Independent Test**: Create package with duration; verify API persistence and Payments helper reads `productDurationDays`.

- [x] T030 [P] [US4] Add `productDurationDays` field to create/edit package UI in `apps/agent-registration/src/app/(main)/admin/underwriters/[underwriterId]/_components/create-package-dialog.tsx` (validation 1–365, max 3 chars)
- [x] T031 [US4] PATCH/POST payloads include `productDurationDays` to `internal/product-management/packages` endpoints from `create-package-dialog.tsx`
- [x] T032 [US4] Show installment helper **unavailable** state in `payments-tab.tsx` when `productDurationDays` is null (per clarification) alongside **Generate report** block

---

## Phase 6: User Story 3 — Premium Due and Overpayment Presentation (Priority: P2)

**Goal**: Premium due uses generation-day as-of; excess label; table filter does not shrink due horizon.

**Independent Test**: Filter `toDate` before today; PDF table respects filter; header premium due uses **as-of** = generation day — US3.

- [x] T033 [US3] Verify `premium-statement.service.ts` uses statement **generation** calendar date for as-of (not `toDate` query param) for **FR-006**
- [x] T034 [P] [US3] Add focused unit tests for due vs excess in `apps/api/src/utils/__tests__/premium-statement-math.spec.ts` (pure math; optional but recommended for financial math)
- [x] T035 [US3] Render **(Excess Payment)** label next to positive excess amount per template in React-PDF component

---

## Phase 7: Polish & cross-cutting

- [x] T036 [P] Document new endpoint in `apps/api` Swagger decorators; ensure correlation ID on errors
- [x] T037 Run `pnpm lint` from repository root `/home/judeokello/Projects/microbima` after TS/JS edits
- [ ] T038 Walk through `specs/001-premium-statement-pdf/quickstart.md` smoke checklist
- [x] T039 [P] Update `apps/api/docs/premium-stmt-samples/statement-tech-decisions.md` if implementation choices differ from draft
- [ ] T040 Backfill script or SQL note for existing packages (`productDurationDays`) before enforcing NOT NULL in a follow-up migration (optional follow-on task)

---

## Dependencies & execution order

### Phase dependencies

- **Phase 1** → no prerequisites
- **Phase 2** → blocks all story phases (schema + filters + package field)
- **Phase 3 (US1)** → depends on Phase 2; delivers MVP PDF
- **Phase 4 (US2)** → depends on T013–T019 (service/controller exists); tightens validation/UX
- **Phase 5 (US4)** → can overlap Phase 3 after T007; admin UI needs DTO from T005–T007
- **Phase 6 (US3)** → depends on premium due code in T018/T033
- **Phase 7** → after desired stories complete

### User story dependencies

| Story | Depends on | Notes |
|-------|------------|--------|
| US1 | Phase 2 | Core PDF + UI |
| US2 | US1 service | Validation layers |
| US4 | Phase 2 DTO/service | Admin + helper |
| US3 | US1 math | Refinement |

### Parallel opportunities

- **Phase 2**: T005, T006, T008, T010 in parallel after T003–T004
- **Phase 3**: T014, T020, T022, T024 in parallel after T016–T017
- **Phase 4**: T027 parallel with T026 once messages defined
- **Phase 5**: T030 parallel to backend if two devs
- **Phase 6**: T034 parallel to T033

---

## Parallel example: Phase 3 (US1)

```text
# After T016–T017 land, parallel:
T014  React-PDF layout component file(s)
T020  app.module.ts registration
T022  apps/agent-registration/src/lib/api.ts client
T024  dashboard/admin PaymentsTab copies
```

---

## Implementation strategy

### MVP (User Story 1 + Foundational)

1. Complete Phase 2 (migration + filters + package persistence + policy detail).
2. Complete Phase 3 (US1): PDF download + Generate report + prepaid-only happy path.
3. **Stop & validate** against **SC-001**, **SC-002** quick manual test.

### Incremental

4. Phase 4 (US2): Harden validation + Sentry + banners.
5. Phase 5 (US4): Admin UI for duration + helper unavailable.
6. Phase 6 (US3): Math edge cases + excess label + optional unit tests.
7. Phase 7: Polish.

### Task counts

| Area | Count |
|------|-------|
| Setup | 2 |
| Foundational | 10 |
| US1 | 13 |
| US2 | 4 |
| US4 | 3 |
| US3 | 3 |
| Polish | 5 |
| **Total** | **40** |

---

## Notes

- Use **`status`** in error responses per workspace rules, not `statusCode`.
- All date math for statement **as-of** and premium due: **UTC** (`setUTCHours` / `Date.UTC` patterns).
- Reuse **`canUserAccessCustomer`** for **FR-013**.
