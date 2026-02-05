# Implementation Plan: Member Numbers and Printable Member Cards for Customers

**Branch**: `001-member-cards` | **Date**: 2025-02-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-member-cards/spec.md` plus aligned technical decisions (backend API shape, frontend structure, template registry, sample data).

## Summary

Display member numbers on the customer detail page (principal and dependants) and add a "Member cards" tab that shows one set of membership/medical cards per policy, with one card per principal and per dependant. Cards are generated on demand (not stored); each card has a PNG download. Card layout is determined by a template per package (nullable `packages.cardTemplateName`); frontend uses a registry mapping template name to React component. Package management screen shows a card template preview with sample data. In the Member cards tab, each policy's cards are shown in a distinct section, with a visible section heading or label indicating the policy/scheme. Technical approach: Add Prisma migration for `packages.cardTemplateName`; extend internal customer-details response with member numbers and createdAt; new endpoint `GET /internal/customers/:customerId/member-cards` returning `{ memberCardsByPolicy: [...] }`; frontend types in `src/types/member-card.ts`, registry and templates in `src/components/member-cards/`; PNG download client-side via html-to-image.

## Technical Context

**Language/Version**: TypeScript 5.3.x  
**Primary Dependencies**: NestJS 11.x (apps/api), Next.js (apps/agent-registration), Prisma 6.x, Express  
**Storage**: PostgreSQL (via Prisma ORM); no server-side storage for card images  
**Testing**: Jest for backend (apps/api); existing frontend testing approach for agent-registration  
**Target Platform**: Node.js >= 18.0.0 (API), browser (Next.js); Fly.io deployment for API  
**Project Type**: Web application (monorepo: apps/api + apps/agent-registration)  
**Performance Goals**: Customer details and member-cards endpoints respond within existing API latency expectations (no new server-side bottlenecks); card PNG generation is client-side and must not block UI  
**Constraints**: Cards generated on demand only (no file storage); date format DD/MM/YYYY on cards; access to member cards same as customer detail page  
**Scale/Scope**: Per-customer member cards (principal + dependants per policy); one default + N package-specific card templates

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. API-First Architecture ✅
- **Compliance**: New internal endpoint `GET /internal/customers/:customerId/member-cards`; extended `GET /internal/customers/:customerId/details` response with member numbers. Agent Registration consumes these APIs.
- **Status**: ✅ PASS

### II. Database Standards ✅
- **Compliance**: Add `packages.cardTemplateName` via Prisma migration (`npx prisma migrate dev --name add_package_card_template_name`). No `db push` for tracked databases. All dates in DB remain UTC; DD/MM/YYYY is display-only on cards.
- **Status**: ✅ PASS

### III. Error Handling Standards ✅
- **Compliance**: Use standardized error format (`status` field), `ValidationException` for validation errors, existing `ErrorCodes` where applicable, correlation IDs in responses. Member-cards endpoint reuses same access check as customer details (404 if not found/forbidden).
- **Status**: ✅ PASS

### IV. Code Quality ✅
- **Compliance**: TypeScript strict mode; nullish coalescing (`??`); `pnpm lint` after TS/JS changes; person names `firstName`, `middleName`, `lastName`.
- **Status**: ✅ PASS

### V. Development Workflow ✅
- **Compliance**: Feature branch from development; PRs to staging/production per constitution.
- **Status**: ✅ PASS

### VI. Technology Constraints ✅
- **Compliance**: Node.js >= 18.0.0, pnpm >= 8.0.0, PostgreSQL, NestJS 11.x, Prisma 6.x, TypeScript 5.3.x.
- **Status**: ✅ PASS

### VII. Security ✅
- **Compliance**: Member-cards and customer details use same authZ (internal API); no separate permission; no card images stored (no new storage surface).
- **Status**: ✅ PASS

### VIII. Monitoring & Observability ✅
- **Compliance**: Correlation IDs; existing Sentry/logging; no new synchronous external calls for card generation (client-side only).
- **Status**: ✅ PASS

**Overall Gate Status**: ✅ **PASS** - All constitution principles satisfied

## Project Structure

### Documentation (this feature)

```text
specs/001-member-cards/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI)
└── tasks.md             # Created by /speckit.tasks
```

### Source Code (repository root)

```text
apps/api/
├── prisma/
│   ├── schema.prisma                              # UPDATE: Package.cardTemplateName
│   └── migrations/
│       └── YYYYMMDD_add_package_card_template_name/
├── src/
│   ├── controllers/internal/
│   │   └── customer.controller.ts                # UPDATE: getCustomerDetails (member numbers); NEW: getMemberCards
│   ├── services/
│   │   └── customer.service.ts                   # UPDATE: getCustomerDetails; NEW: getMemberCards logic
│   └── dto/
│       └── customers/                            # UPDATE: customer-detail DTOs; NEW: member-cards DTOs
└── tests/                                        # Jest; extend/add as needed

apps/agent-registration/
├── src/
│   ├── types/
│   │   └── member-card.ts                        # NEW: MemberCardData and related types
│   ├── components/
│   │   └── member-cards/                         # NEW: registry + template components
│   │       ├── card-template-registry.tsx        # CARD_TEMPLATE_REGISTRY
│   │       ├── templates/
│   │       │   ├── DefaultCardTemplate.tsx       # default layout
│   │       │   └── WellnessCardTemplate.tsx     # example package template
│   │       ├── MemberCardWithDownload.tsx       # wrapper: card + PNG download button
│   │       └── sample-card-data.ts               # sample data for package preview
│   ├── app/(main)/
│   │   ├── admin/customer/[customerId]/page.tsx           # UPDATE: add Member cards tab
│   │   ├── customer/[customerId]/page.tsx                # UPDATE: add Member cards tab
│   │   ├── dashboard/customer/[customerId]/page.tsx      # UPDATE: add Member cards tab
│   │   └── admin/underwriters/packages/[packageId]/page.tsx  # UPDATE: Card template preview section
│   ├── lib/
│   │   └── api.ts                               # UPDATE: getCustomerDetails types; NEW: getMemberCards
│   └── app/(main)/.../customer/[customerId]/_components/
│       ├── customer-info-section.tsx            # UPDATE: show member number (placeholder if missing)
│       ├── spouse-section.tsx                   # UPDATE: show member number per dependant
│       └── children-section.tsx                # UPDATE: show member number per dependant
└── ... (existing tests)
```

**Structure Decision**: Extends existing monorepo. Backend: one new internal endpoint and extended customer-details response; DTOs under existing customers namespace. Frontend: new types and component tree under `src/types/member-card.ts` and `src/components/member-cards/`; three customer detail pages get new tab and shared Member cards content; package detail page gets preview section. No new apps or packages.

## Complexity Tracking

> **No violations detected** - Implementation follows constitution; no additional complexity justification required.

## Phase 0: Research Complete ✅

**Status**: Complete  
**Output**: `research.md`

All technical decisions were provided in the plan input; no NEEDS CLARIFICATION remained. Research consolidates choices (client-side PNG, template registry, scheme resolution, sample data).

## Phase 1: Design Complete ✅

**Status**: Complete  
**Outputs**:
- `data-model.md` - Package schema change; MemberCardData (DTO); existing entities (policy_member_principals, policy_member_dependants, package_scheme_customers, schemes)
- `contracts/member-cards-api.yaml` - OpenAPI for GET /internal/customers/:customerId/member-cards and extended customer details
- `quickstart.md` - Implementation quick start

**Next Steps**: Proceed to `/speckit.tasks` to break down implementation into tasks.
