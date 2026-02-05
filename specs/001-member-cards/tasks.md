# Tasks: Member Numbers and Printable Member Cards for Customers

**Input**: Design documents from `/specs/001-member-cards/`  
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, quickstart.md

**Tests**: Not explicitly requested in spec; no test tasks included. Add per quickstart if desired (Jest backend, manual frontend). Automated test coverage for the new member-cards endpoint and extended customer details is out of scope for this feature; rely on T028 validation and manual verification per quickstart. Add Jest/integration tests in a follow-up if required by project policy.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1, US2, US3 (user story from spec.md)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `apps/api/` (NestJS, Prisma)
- **Frontend**: `apps/agent-registration/` (Next.js)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies and one-time setup for the feature

- [ ] T001 Add html-to-image dependency to apps/agent-registration/package.json for client-side PNG export

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema and package API changes that US2 and US3 depend on. Must complete before Member cards tab and package preview.

**⚠️ CRITICAL**: User Story 2 and 3 need cardTemplateName; User Story 1 does not.

- [ ] T002 Add cardTemplateName field (String? @db.VarChar(100)) to Package model in apps/api/prisma/schema.prisma
- [ ] T003 Create and apply Prisma migration in apps/api with name add_package_card_template_name then run prisma generate
- [ ] T004 Add cardTemplateName to PackageDetailDto and ensure getPackageById returns it in apps/api/src/dto/packages/package.dto.ts and apps/api/src/services/product-management.service.ts (select cardTemplateName in getPackageById)

**Checkpoint**: Schema and package API ready; US1 can proceed; US2 and US3 can use cardTemplateName

---

## Phase 3: User Story 1 – View member numbers on customer detail screen (Priority: P1) – MVP

**Goal**: Principal and each dependant show member number on existing Customer Details cards; placeholder "Not assigned" when missing. Member number is display-only and must not be editable.

**Independent Test**: Open customer detail page (admin or non-admin) for a customer with policy and dependants; principal card and each dependant card show member number (or "Not assigned"). Same on dashboard customer page.

### Implementation for User Story 1

- [ ] T005 [P] [US1] Add memberNumber and memberNumberCreatedAt to customer detail DTOs (principal and dependants) in apps/api/src/dto/customers/ (see data-model.md and customer-detail.dto.ts)
- [ ] T006 [US1] In getCustomerDetails load policyMemberPrincipals for customer and policyMemberDependants for customer's dependants in apps/api/src/services/customer.service.ts
- [ ] T007 [US1] Map principal member number and createdAt and per-dependant member number and createdAt into customer detail response in apps/api/src/services/customer.service.ts
- [ ] T008 [P] [US1] Extend CustomerDetailData and nested types with memberNumber and memberNumberCreatedAt in apps/agent-registration/src/lib/api.ts
- [ ] T009 [US1] Display member number (or placeholder "Not assigned") in CustomerInfoSection in apps/agent-registration/src/app/(main)/customer/[customerId]/_components/customer-info-section.tsx
- [ ] T010 [US1] Display member number (or placeholder "Not assigned") per dependant in SpouseSection in apps/agent-registration/src/app/(main)/customer/[customerId]/_components/spouse-section.tsx
- [ ] T011 [US1] Display member number (or placeholder "Not assigned") per dependant in ChildrenSection in apps/agent-registration/src/app/(main)/customer/[customerId]/_components/children-section.tsx

**Checkpoint**: User Story 1 complete; member numbers visible on customer detail page on all three routes (admin, customer, dashboard)

---

## Phase 4: User Story 2 – View and download membership/medical cards per policy (Priority: P2)

**Goal**: New "Member cards" tab; one group per policy; one card per principal and per dependant; PNG download per card (disabled when no member number); empty state when no policies. Implement the tab content once (e.g. a shared component or section) and reuse it on all three customer pages; do not duplicate markup or logic across T022–T024.

**Independent Test**: Open Member cards tab for customer with at least one policy; see cards grouped by policy; each card shows required fields; download produces PNG; when member has no number, placeholder and download disabled; when no policies, empty-state message.

### Implementation for User Story 2

- [ ] T012 [P] [US2] Create MemberCardDataDto, MemberCardsByPolicyItemDto, MemberCardsResponseDto in apps/api/src/dto/customers/ (or new file under dto/customers) per contracts/member-cards-api.yaml
- [ ] T013 [US2] Implement getMemberCards in apps/api/src/services/customer.service.ts (access check same as getCustomerDetails; resolve scheme via PackageSchemeCustomer; build principal + dependants MemberCardData; dates DD/MM/YYYY; return { memberCardsByPolicy })
- [ ] T014 [US2] Add GET :customerId/member-cards endpoint in apps/api/src/controllers/internal/customer.controller.ts returning member cards response DTO
- [ ] T015 [P] [US2] Define MemberCardData and related types in apps/agent-registration/src/types/member-card.ts
- [ ] T016 [P] [US2] Create sample-card-data.ts with schemeName MFANISI, Jane Doe, John Doe, MFG023-00, 07/05/1983, 11/12/2025 in apps/agent-registration/src/components/member-cards/sample-card-data.ts
- [ ] T017 [P] [US2] Create DefaultCardTemplate component (props data: MemberCardData, className?) in apps/agent-registration/src/components/member-cards/templates/DefaultCardTemplate.tsx with DD/MM/YYYY dates
- [ ] T018 [P] [US2] Create WellnessCardTemplate component (props data: MemberCardData, className?) in apps/agent-registration/src/components/member-cards/templates/WellnessCardTemplate.tsx matching sample card layout
- [ ] T019 [US2] Create card-template-registry.tsx with CARD_TEMPLATE_REGISTRY mapping template name to component and fallback to default in apps/agent-registration/src/components/member-cards/card-template-registry.tsx
- [ ] T020 [US2] Create MemberCardWithDownload wrapper (ref, toPng via html-to-image, download button disabled when memberNumber null) in apps/agent-registration/src/components/member-cards/MemberCardWithDownload.tsx
- [ ] T021 [US2] Add getMemberCards(customerId) calling GET /internal/customers/:customerId/member-cards in apps/agent-registration/src/lib/api.ts
- [ ] T022 [US2] Add "Member cards" tab and content (empty state when no data; per-policy sections and cards via registry; use MemberCardWithDownload) to apps/agent-registration/src/app/(main)/admin/customer/[customerId]/page.tsx
- [ ] T023 [US2] Add "Member cards" tab and same content to apps/agent-registration/src/app/(main)/customer/[customerId]/page.tsx
- [ ] T024 [US2] Add "Member cards" tab and same content to apps/agent-registration/src/app/(main)/dashboard/customer/[customerId]/page.tsx

**Checkpoint**: User Story 2 complete; Member cards tab works on all three customer pages with download and empty state

---

## Phase 5: User Story 3 – Preview card template on package management screen (Priority: P3)

**Goal**: Package detail page shows "Card template preview" section with template (from package.cardTemplateName or default) filled with sample data; template identifier not in package form.

**Independent Test**: Open package detail page; see card template preview with sample data; no template identifier in create/edit form.

### Implementation for User Story 3

- [ ] T025 [US3] Add "Card template preview" section to package detail page: resolve template from package.cardTemplateName or default, render with sample data from sample-card-data.ts in apps/agent-registration/src/app/(main)/admin/underwriters/packages/[packageId]/page.tsx
- [ ] T026 [US3] Confirm package create/edit form does not expose cardTemplateName (no new field) in: `apps/agent-registration/src/app/(main)/admin/underwriters/[underwriterId]/_components/create-package-dialog.tsx` and `apps/agent-registration/src/app/(main)/admin/underwriters/packages/[packageId]/page.tsx`

**Checkpoint**: User Story 3 complete; package preview visible; template identifier not editable in UI

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Lint and final validation

- [ ] T027 Run pnpm lint from repository root and fix any issues introduced by this feature
- [ ] T028 Validate implementation against quickstart.md and contracts/member-cards-api.yaml (manual or script)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies – start immediately
- **Phase 2 (Foundational)**: No dependency on Phase 1 for schema; T001 can run anytime. T002–T004 must complete before US2 and US3
- **Phase 3 (US1)**: Can start after Phase 1 (no strict need for Phase 2 for US1)
- **Phase 4 (US2)**: Depends on Phase 2 (schema + package API for cardTemplateName in member-cards payload). Depends on Phase 1 for html-to-image
- **Phase 5 (US3)**: Depends on Phase 2 (cardTemplateName in package response) and US2 components (registry, templates, sample data) for reuse
- **Phase 6 (Polish)**: After all implementation phases

### User Story Dependencies

- **US1 (P1)**: Independent; only needs backend customer-details extension and frontend section updates
- **US2 (P2)**: Needs Phase 2 (schema, so member-cards can return cardTemplateName); can reuse US1’s extended customer details but does not depend on US1
- **US3 (P3)**: Needs Phase 2 (package API cardTemplateName) and US2’s registry/templates/sample data for preview

### Within Each User Story

- Backend DTOs before service/controller
- Service before controller
- Frontend types and shared components before pages
- Tab/content before polish

### Parallel Opportunities

- T005, T008 can run in parallel (different codebases)
- T012, T015, T016, T017, T018 can run in parallel (different files)
- T022, T023, T024 can run in parallel (three page files)
- After Phase 2, US1 and US2 can be worked in parallel by different implementers

---

## Parallel Example: User Story 2

```text
# DTOs and frontend types/components (no cross-file deps):
T012: Member cards DTOs in apps/api/src/dto/customers/
T015: types/member-card.ts
T016: sample-card-data.ts
T017: DefaultCardTemplate.tsx
T018: WellnessCardTemplate.tsx

# Then sequential: T019 registry (needs T017, T018), T020 wrapper (needs html-to-image), T013 service, T014 controller, T021 api.ts, T022–T024 pages
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: T001 (html-to-image – optional for US1 but harmless)
2. Phase 2: T002, T003, T004 (needed for US2/US3; can do first)
3. Phase 3: T005–T011
4. **STOP and VALIDATE**: Member numbers visible on customer detail page on admin and non-admin routes
5. Deploy/demo if ready

### Incremental Delivery

1. Phase 1 + 2 → foundation ready
2. Phase 3 (US1) → test independently → MVP
3. Phase 4 (US2) → Member cards tab → test independently
4. Phase 5 (US3) → package preview → test independently
5. Phase 6 → polish

### Suggested MVP Scope

- **MVP**: Phase 1 + Phase 2 + Phase 3 (User Story 1). Delivers member numbers on customer detail screen with placeholder when missing.

---

## Notes

- [P] = parallelizable (different files, no ordering requirement)
- [USn] = task belongs to that user story for traceability
- Customer detail pages under agent-registration use shared components from `customer/[customerId]/_components/`; admin and dashboard import those same components
- Do not expose cardTemplateName in package create/update DTOs or forms; only in GET package response for preview and member-cards payload
- Run `pnpm lint` after TypeScript/JavaScript changes (per project rules)
- If using check-prerequisites.sh and multiple spec directories share prefix 001, ensure FEATURE_DIR or context targets this feature (001-member-cards).
