# Implementation Plan: Admin Messaging Campaigns

**Branch**: `004-admin-messaging-campaigns` | **Date**: 2026-08-08 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/004-admin-messaging-campaigns/spec.md`  
**Intake**: [docs/proposals/admin-messaging-campaigns.md](../../docs/proposals/admin-messaging-campaigns.md)  
**Related**: [research.md](./research.md), [data-model.md](./data-model.md), [quickstart.md](./quickstart.md), [contracts/openapi.yaml](./contracts/openapi.yaml)

## Summary

Add an admin **campaign** capability to compose and send ad hoc SMS/email to combinable audiences (scheme customers, scheme contacts, pasted lists), with placeholder pills, preview, preflight CSVs, typed name confirmation, configurable delay + cancel, idempotency, and campaign audit/history. Reuse the existing messaging **outbox worker** and providers by creating pre-rendered `MessagingDelivery` rows after a delay. Separately, provide a **Templates** UI for editing non-campaign system templates. Customer care can view campaign history only.

## Technical Context

**Language/Version**: TypeScript 5.3.x, Node.js >= 18  
**Primary Dependencies**: NestJS 11.x (`apps/api`), Prisma 6.x, `@nestjs/schedule`, `@sentry/nestjs`, Next.js (`apps/agent-registration`), **TipTap** (email rich text), HTML sanitizer (`sanitize-html` or equivalent)  
**Storage**: PostgreSQL (Prisma migrations); no new Redis  
**Testing**: Jest TDD for API/domain under `apps/api/src/modules/messaging/campaigns/__tests__/`. UI validated via Spec Independent Tests + quickstart (no new frontend test framework in this feature).  
**Target Platform**: Linux API (Fly.io), admin web portal  
**Project Type**: Monorepo (pnpm + turbo) — API + agent-registration admin UI  
**Performance Goals**:
- Preview for typical scheme audiences (<1k) returns in a few seconds under normal load  
- Warn (not block) at 5,000 sendable recipients  
- Dispatcher + worker continue to process campaign deliveries without blocking transactional messaging  
**Constraints**:
- Prisma migrations only (no `db push`)  
- UTC timestamps  
- Standardized errors (`status`, `ValidationException`, existing `ErrorCodes`, correlation IDs)  
- System settings via `MessagingSettingsSnapshot` sync rule  
- Non-prod customer-linked redirect preserved  
- English-only campaigns MVP (`en` on deliveries)  
- Campaign immutable after Send (cancel + recreate only)  
- Phone normalize via existing MSISDN util; email trim+lowercase  
- Email HTML sanitized server-side (FR-010a); empty body = stripped plain-text length 0  
**Scale/Scope**: Admin bulk campaigns; soft warn at 5k; AT multi-recipient batching deferred (research R7)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status |
|------|--------|
| API-first REST on internal API | Pass — campaigns + template PATCH documented in OpenAPI |
| Prisma migrations; UTC | Pass — new tables/enums via migrate |
| Standardized errors + correlation IDs | Pass — ValidationException / existing filter |
| RBAC | Pass — registration_admin vs customer_care |
| Sentry for blocking failures | Pass — preflight blocks only (not soft skips) |
| Lint after TS/JS changes | Pass — required in implementation tasks |
| No unjustified new datastores | Pass — Postgres outbox only |

**Post-design re-check**: Design reuses messaging module, settings snapshot pattern, and admin portal — no constitution violations. Customer-care access to campaign history requires careful admin-layout role gating (research R13) — justified complexity, not a principle breach.

## Project Structure

### Documentation (this feature)

```text
specs/004-admin-messaging-campaigns/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── openapi.yaml
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit.tasks (not this command)
```

### Source Code (repository root)

```text
apps/api/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed-messaging.sql                    # add admin shells + settings
└── src/
    ├── modules/messaging/
    │   ├── messaging.types.ts                # snapshot keys
    │   ├── settings/system-settings.service.ts
    │   ├── messaging.worker.ts               # handedOffAt; respect CANCELLED
    │   ├── africas-talking-webhook.service.ts # receiptConfirmedAt
    │   ├── campaigns/
    │   │   ├── campaign.types.ts
    │   │   ├── campaign-audience.service.ts  # expand, skip, render, dedupe
    │   │   ├── campaign-preflight.service.ts
    │   │   ├── campaign.service.ts           # preview, create, cancel, list, detail, CSV
    │   │   ├── campaign.dispatcher.ts        # cron: DELAYED → deliveries
    │   │   └── campaign-html.sanitizer.ts
    │   └── messaging.module.ts               # wire new providers
    ├── controllers/internal/
    │   └── messaging-campaigns.controller.ts # or extend messaging.controller.ts
    └── dto/messaging/
        └── campaign.dto.ts

apps/agent-registration/
└── src/
    ├── app/(main)/admin/
    │   ├── campaigns/
    │   │   ├── page.tsx                      # history list
    │   │   ├── compose/page.tsx              # SMS | Email compose (admin)
    │   │   └── [campaignId]/page.tsx         # detail, countdown, cancel, CSVs
    │   ├── messaging-templates/
    │   │   └── page.tsx                      # edit/save non-admin templates
    │   └── layout.tsx                        # allow customer_care for history routes
    ├── components/messaging/
    │   ├── placeholder-composer.tsx          # pills + picker
    │   ├── campaign-preview-panel.tsx
    │   └── rich-text-email-editor.tsx        # TipTap
    └── lib/api.ts                            # campaign + template client methods
```

**Structure Decision**: Extend `apps/api` messaging module with a `campaigns/` subfolder and add admin UI under `apps/agent-registration` `/admin/campaigns` + `/admin/messaging-templates`, reusing existing messages delivery history for per-customer rows. Email compose uses TipTap.

## Complexity Tracking

| Violation / Complexity | Why Needed | Simpler Alternative Rejected Because |
|------------------------|------------|-------------------------------------|
| Campaign dispatcher + delay state machine | Spec safety delay/cancel before provider handoff | Client-only delay is unsafe if browser closes |
| Dual progress timestamps (`handedOffAt` / `receiptConfirmedAt`) | Spec requires both counts | Using only `SENT` conflates API accept and receipts |
| Admin layout role split for customer_care history | Spec: CC views history, not compose | Entire `/admin` stays admin-only today — must open a narrow path |

## Phase 0: Outline & Research (completed)

See [research.md](./research.md) — all planning unknowns resolved (send path, delay, preflight persistence, name rewrite, receipt counts, CANCELLED status, AT batching deferral, HTML sanitize, settings keys, idempotency, RBAC/UI).

## Phase 1: Design & Contracts (completed)

- [data-model.md](./data-model.md) — `MessagingCampaign`, audit events, delivery extensions, seeds, settings  
- [contracts/openapi.yaml](./contracts/openapi.yaml) — preview, CRUD-ish campaign APIs, CSV, template patch  
- [quickstart.md](./quickstart.md) — manual validation paths  

## Phase 2: Implementation planning note

Task breakdown is produced by `/speckit.tasks` (not this command). Suggested implementation order:

1. Prisma migration + settings snapshot + admin template seeds  
2. Audience/preflight services + unit tests  
3. Campaign service (preview/create/cancel/list) + controller RBAC  
4. Dispatcher cron + delivery creation + CANCELLED / handedOffAt / receiptConfirmedAt wiring  
5. Admin UI compose + preview + delay/cancel  
6. Campaign history + CSV + customer_care access  
7. Templates edit UI (exclude admin shells)  
8. Integration tests + quickstart smoke  

## Key implementation rules (from repo)

- Sync new settings keys through `MessagingSettingsSnapshot` + `SystemSettingsService` + migration/seed + meta bump  
- Use `ValidationException` / existing error codes; prefer `status` not `statusCode`  
- UTC for all delay/`dispatchStartsAt` math (`Date` UTC methods)  
- Run `pnpm lint` after TS/JS changes
