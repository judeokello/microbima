# Implementation Plan: Package Pricing Storage & Admin Wizard

**Branch**: `005-package-pricing-wizard` | **Date**: 2026-08-10 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/005-package-pricing-wizard/spec.md`  
**Intake**: [docs/proposals/package-pricing-db-wizard.md](../../docs/proposals/package-pricing-db-wizard.md)  
**Related**: [research.md](./research.md), [data-model.md](./data-model.md), [quickstart.md](./quickstart.md), [contracts/openapi.yaml](./contracts/openapi.yaml)

## Summary

Move package rate tables from static agent-registration JSON files into PostgreSQL, expose them via Internal API as a **drop-in** for registration / modify / recovery payment UIs, and add a three-step admin wizard (Setup → Pricing grid → Product Utilization placeholder) gated to **`setup_admin`** (root/bootstrap grants the role). Pricing is **lookup-only** (no extrapolate). Completeness gates activation; incomplete-making persists deactivate active packages with warnings (in-flight registrations may finish). Soft loss warnings on cell commit + suggest-fill help admins author rates. Migrate Mfanisi Boda/Go, then remove static files.

## Technical Context

**Language/Version**: TypeScript 5.3.x, Node.js >= 18  
**Primary Dependencies**: NestJS 11.x (`apps/api`), Prisma 6.x, Next.js (`apps/agent-registration`)  
**Storage**: PostgreSQL via Prisma migrations (`package_pricing_categories`, `package_plan_rates`); no Fly volumes for rates  
**Testing**: Jest unit/integration under `apps/api` (completeness, lookup math, family category, activation gates); agent-registration smoke via quickstart / existing Playwright patterns where present  
**Target Platform**: Linux API + agent-registration on Fly.io  
**Project Type**: Monorepo (pnpm + turbo) — API + agent-registration  
**Performance Goals**:
- Pricing GET for a package returns within normal admin/agent latency (small grids: few plans × few categories × ≤5 frequencies)  
- Soft loss / suggest-fill compute client-side or cheap server-side without blocking save  
**Constraints**:
- Prisma migrations only (no `db push`)  
- UTC timestamps  
- Standardized errors (`status`, `ValidationException`, existing `ErrorCodes`, correlation IDs)  
- RLS auto-enable on new `public` tables; no open Data API policies  
- No `CUSTOM` frequency on package pricing  
- Annual rate always required for completeness even if Annually not sellable  
- Big-bang cutover after migration (no long dual-read flag)  
- Package mutate (create/edit/pricing/activate) requires `setup_admin`; list/view for other admin roles; only root/bootstrap may grant `setup_admin` (Supabase `user_metadata.roles`)  
- Soft-loss UI warning on cell edit commit within 1s; amounts Decimal(10,2) currency  
**Scale/Scope**: Admin product management + existing registration payment surfaces; initially two migrated packages (Boda, Go)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status |
|------|--------|
| API-first REST on internal API | Pass — pricing GET/PUT + by-slug documented in OpenAPI |
| Prisma migrations; UTC | Pass — new tables/enum via migrate |
| Standardized errors + correlation IDs | Pass — ValidationException / existing filter |
| RBAC | Pass — `setup_admin` for package/pricing mutate; root-only role grant; list/read for other admin roles; pricing **read** for agents without `setup_admin` |
| Supabase RLS on new public tables | Pass — rely on `rls_auto_enable` trigger; no anon policies |
| Lint after TS/JS changes | Pass — required in implementation tasks |
| No unjustified disk/static rate stores | Pass — Postgres only; delete JSON after cutover |

**Post-design re-check**: Design extends product-management; drop-in DTO mirrors legacy JSON without `pricingMode`; no constitution violations. Slight FE complexity for wizard + dual previous/new cell display is justified by spec UX.

## Project Structure

### Documentation (this feature)

```text
specs/005-package-pricing-wizard/
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
│   ├── schema.prisma                    # PackagePricingCategory, PackagePlanRate, enum
│   ├── migrations/                      # pricing tables + optional data migration
│   └── seed-*.sql                       # or script import from legacy JSON
└── src/
    ├── utils/
    │   ├── insurance-installment.util.ts    # lookup-only; remove extrapolate
    │   └── family-category.util.ts          # package-aware bands
    ├── services/
    │   └── product-management.service.ts    # completeness, activate gates, pricing CRUD
    ├── controllers/internal/
    │   └── product-management.controller.ts # pricing endpoints
    └── dto/packages/                        # pricing DTOs

apps/agent-registration/
└── src/
    ├── app/(main)/admin/underwriters/
    │   └── .../packages/                    # wizard steps 1–3; pricing grid
    ├── app/(main)/register/payment/         # fetch API pricing; drop-in UI
    ├── app/(main)/dashboard/recovery/
    ├── app/(main)/customer/.../modify-product-dialog.tsx
    ├── lib/insurance-installment.ts         # lookup-only; remove productPricingPath usage
    └── lib/api.ts                           # getPackagePricing / putPackagePricing
```

**Structure Decision**: Extend existing product-management API and admin package pages; keep registration payment interaction pattern; swap data source from `public/product-pricing` to Internal API.

## Complexity Tracking

| Violation / Complexity | Why Needed | Simpler Alternative Rejected Because |
|------------------------|------------|-------------------------------------|
| Always-required `ANNUALLY` rate vs optional Annually frequency | Spec clarification for annual quote without forcing Annually as payment cadence | Deriving annual from installment×count or daily×365 reintroduces non-lookup math |
| Deactivate on persist of plan/category/frequency | Spec: agents must not sell incomplete packages mid-edit | Deactivate only on full grid save leaves a window of active incomplete data |
| Drop-in DTO shaped like legacy JSON | Minimize registration UI rewrite | Fully normalized grid DTO forces larger FE churn |

## Phase 0: Outline & Research (completed)

See [research.md](./research.md) — resolved: Postgres storage, lookup-only, annual band rule, drop-in API, completeness/activation, soft loss + suggest-fill, family picker validation, JSON migration, wizard shell, no rate revisions MVP, RLS, **`setup_admin` RBAC + root-only grant**, in-flight registrations after deactivate, soft-loss timing on cell commit, Currency Decimal(10,2), no CUSTOM on pricing grids.

## Phase 1: Design & Contracts (completed)

- [data-model.md](./data-model.md) — categories, rates, completeness, household rules, JSON mapping, Currency amounts  
- [contracts/openapi.yaml](./contracts/openapi.yaml) — GET/PUT pricing, by-slug, category create, suggest-fill, activation gates; **`setup_admin`** on mutate; agents may GET by-slug without `setup_admin`  
- [quickstart.md](./quickstart.md) — wizard, deactivate, registration drop-in, Go UAT, soft-loss timing, setup_admin grant  

## Phase 2: Implementation planning note

Task breakdown is in [tasks.md](./tasks.md). Suggested implementation order:

1. Prisma migration + enum + RLS inheritance; seed Member only on package create; Decimal amounts  
2. Completeness helper + activation / auto-deactivate gates; FR-015 no auto-reactivate  
3. `setup_admin` RBAC + root-only role grant (Jest TDD first)  
4. Pricing GET/PUT + by-slug + category create + suggest-fill endpoints + unit tests  
5. Migrate mfanisi-boda / mfanisi-go JSON → tables  
6. Admin wizard UI (steps 1–3) + pricing grid (double-click, previous/new, soft loss ≤1s, suggest-fill); hide mutate for non-`setup_admin`  
7. Switch registration / modify / recovery to API pricing; remove extrapolate + static files  
8. Package-aware family category util + undersized-band block when household known  
9. Quickstart / UAT for Go amount differences + informal `setup_admin` sign-off  

## Key implementation rules (from repo)

- Use `ValidationException` / existing error codes; prefer `status` not `statusCode`  
- Prisma migrate only; UTC for timestamps  
- Align cadence with `PAYMENT_CADENCE_DAYS` (1/7/31/90/365)  
- Run `pnpm lint` at repo root after TS/JS changes  
- Intake table proposal is normative baseline; refine only with justification in tasks/PRs  
- Roles: Supabase `user_metadata.roles`; never grant `setup_admin` except root/bootstrap