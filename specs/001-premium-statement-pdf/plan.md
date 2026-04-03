# Implementation Plan: Customer Premium Statement PDF

**Branch**: `001-premium-statement-pdf` | **Date**: 2026-04-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-premium-statement-pdf/spec.md` and technical notes from `apps/api/docs/premium-stmt-samples/statement-tech-decisions.md`.

## Summary

Deliver a **Premium Statement** PDF from **Customer Detail → Payments** (`apps/agent-registration`): **Generate report** after policy + date filter returns at least one **confirmed** payment (`COMPLETED`, `COMPLETED_PENDING_RECEIPT`); **postpaid** disabled; block with Sentry warning when policy number, start date, premium, or package **product duration** is missing. **Backend**: Prisma migration adding `Package.productDurationDays`; extend **product-management** create/update package APIs and admin UI; new **internal** endpoint returning `application/pdf` with `Content-Disposition` filename per spec; shared query/helpers for confirmed payments, all-time sum, premium-due math (UTC); PDF built with **@react-pdf/renderer** (pattern from `attachment-generator.service.ts`). **Frontend**: payments list with optional `paymentStatus` filter and pagination; format amounts like existing Payments table (**FR-014**). See [research.md](./research.md) for date rules and stack choice.

## Technical Context

**Language/Version**: TypeScript 5.3.x, Node.js 18+

**Primary Dependencies**: NestJS 11, Prisma 6, Next.js (agent-registration), `@react-pdf/renderer`, Sentry

**Storage**: PostgreSQL; new column `packages.product_duration_days`

**Testing**: API Jest/unit; integration for PDF endpoint; `pnpm lint` after TS/JS changes

**Target Platform**: Fly.io API; browser (agent-registration admin)

**Project Type**: Turbo monorepo — `apps/api`, `apps/agent-registration`, `apps/web-admin` (package admin if applicable)

**Performance Goals**: Align with spec **SC-002** (≤10s typical generation)

**Constraints**: UTC for statement as-of; Prisma migrations only; standardized errors; logo `apps/api/assets/maishapoalogo-nobg.png`

**Scale/Scope**: Per-request PDF; large row counts may require streaming or server-side pagination for list

## Constitution Check

| Principle | Status |
|-----------|--------|
| API-first | Pass |
| Migrations only | Pass |
| UTC dates | Pass |
| Error standards | Pass |
| Sentry | Pass |
| RBAC | Pass — same as `getCustomerPayments` (**FR-013**) |

**Re-check after design**: No violations.

## Project Structure

### Documentation (this feature)

```text
specs/001-premium-statement-pdf/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/openapi.yaml
└── spec.md
```

### Source code (touchpoints)

```text
apps/api/prisma/schema.prisma
apps/api/src/services/customer.service.ts
apps/api/src/controllers/internal/customer.controller.ts
apps/api/src/dto/customers/customer-payments-filter.dto.ts
apps/api/src/modules/messaging/attachments/attachment-generator.service.ts (reference)
apps/agent-registration/.../payments-tab.tsx
apps/agent-registration/src/lib/api.ts
```

**Structure Decision**: API + agent-registration; package field in product-management / web-admin per existing package edit flows.

## Complexity Tracking

None required.

## Phase 0 and Phase 1 outputs

| Artifact | Path |
|----------|------|
| Research | [research.md](./research.md) |
| Data model | [data-model.md](./data-model.md) |
| Contracts | [contracts/openapi.yaml](./contracts/openapi.yaml) |
| Quickstart | [quickstart.md](./quickstart.md) |

## Suggested next command

`/speckit.tasks`
