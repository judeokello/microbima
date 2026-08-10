# Research: Package Pricing Storage & Admin Wizard

**Branch**: `005-package-pricing-wizard`  
**Date**: 2026-08-10  
**Spec**: [spec.md](./spec.md)  
**Intake**: [docs/proposals/package-pricing-db-wizard.md](../../docs/proposals/package-pricing-db-wizard.md)

## R1 — Persist rates in Postgres (not static JSON / not disk writes)

**Decision**: Store pricing in PostgreSQL (`package_pricing_categories`, `package_plan_rates`) served by Internal API. Remove `apps/agent-registration/public/product-pricing/*.json` after migration. Never write rate files into Fly containers.

**Rationale**: Spec + Fly constraints (ephemeral disk, multi-instance divergence). Constitution is API-first; package metadata already lives in Postgres.

**Alternatives considered**:
- Fly volume for JSON — single-machine, operationally fragile.
- Object storage JSON — extra moving part; still not relational with plans/frequencies.

---

## R2 — Lookup-only; delete extrapolate

**Decision**: Single pricing mode: installment = stored amount for selected `PaymentFrequency`; annual display = stored `ANNUALLY` amount. Remove `pricingMode` / extrapolate branches from FE + API helpers.

**Rationale**: Spec FR-003/004; Go may change vs old daily×cadence (accepted + UAT).

**Alternatives considered**: Keep extrapolate for Go only — rejected (spec).

---

## R3 — Annual band vs Annually payment frequency

**Decision**: Always require `package_plan_rates` rows with `frequency = ANNUALLY` for every active plan × defined grouping (completeness). Annually as a **sellable** payment option remains controlled solely by `package_payment_frequencies`. Same cell serves both when Annually is enabled.

**Rationale**: Clarification: annual summary always lookup; not tied to enabling Annually for customers.

**Alternatives considered**: Separate `annualAmount` column — duplicates frequency model; rejected.

---

## R4 — API shape for drop-in FE cutover

**Decision**: `GET /internal/product-management/packages/:packageId/pricing` returns a payload close to legacy JSON (`plans[key].categories` + `additional_spouse` bands) **without** `pricingMode`, plus `isPricingComplete`, category metadata (`kind`, `maxMembers`), and planIds. Agents keep plan/category/spouse/frequency UI; swap `fetch(productPricingPath)` → API client.

Also expose slug-based read for flows that today only have slug: `GET .../packages/by-slug/:slug/pricing` (or include pricing on an existing package-by-slug detail) so payment pages need minimal wiring.

**Rationale**: Spec drop-in FR-002a; current payment page keys plans/categories like JSON.

**Alternatives considered**: Fully normalized grid-only DTO — more FE rewrite; rejected for MVP.

---

## R5 — Completeness + activation enforcement

**Decision**: Central `isPricingComplete(packageId)` in product-management service:

Required cells = active plans × defined groupings (Member only required; optional Up to N / Additional spouse if present) × (enabled payment frequencies ∪ `{ANNUALLY}`), amount > 0.

- Reject `isActive=true` if incomplete.
- On persist of plan create, category create, or frequency enable that breaks completeness → set `isActive=false` in same transaction; return warning flag for admin UI.

**Rationale**: Spec FR-012–015, clarification “deactivate on persist”.

**Alternatives considered**: UI-only deactivate — rejected (FR-023).

---

## R6 — Soft loss warnings + suggest-fill

**Decision**: Client + server helper using cadence days `1/7/31/90/365` (`PAYMENT_CADENCE_DAYS`). Floor for coarser band = finestEnabledAmount × (C_coarse / C_fine), round to 2 decimals. Warn if amount < floor; save allowed. Suggest-fill fills **empty** cells from finest/lower band; confirm before overwrite of non-empty.

**Rationale**: Spec FR-017/018; MVP requires suggest-fill.

**Alternatives considered**: Spreadsheet divisors 10/45/315 — rejected (assumptions).

---

## R7 — Family category at registration

**Decision**: Keep agent category picker populated from package groupings (non–ADDITIONAL_SPOUSE). When household size is known, block submit if selected band cannot cover size (smallest fitting Up to N / Member only rules). When size is unknown, skip undersize check. Overflow with no fitting Up to N → block. Additional spouse: disabled for Member only; apply on opt-in; block add-on if household known and ≤1 spouse.

**Rationale**: Drop-in + FR-019a.

**Alternatives considered**: Auto-derive only — more UX change; rejected.

---

## R8 — Migration of Mfanisi JSON

**Decision**: One-time seed/migration script reads committed JSON (or embeds constants) into categories + rates for packages by slug `mfanisi-boda` / `mfanisi-go`. Map `member_only` / `up_to_*` / `additional_spouse`. Import all bands present including annually. Mark incomplete if gaps; admin fills Go gaps before activate/UAT. Then delete static files and FE path helper.

**Rationale**: Spec FR-021 / Story 6.

**Alternatives considered**: Manual admin re-entry only — error-prone for Boda parity.

---

## R9 — Wizard UX shell

**Decision**: Three-step flow on package create/edit in agent-registration admin (stepper or tabs): (1) existing setup fields, (2) pricing grid, (3) Product Utilization Configuration placeholder + Finish. Prefer package detail page wizard for edit; create may redirect into same multi-step after package row exists (step 1 persist creates inactive package + default Member only category).

**Rationale**: Spec FR-005/022; package must exist before rates FK.

**Alternatives considered**: Single dialog with all steps — too heavy; rejected.

---

## R10 — Rate revisions table

**Decision**: Out of MVP. Previous/new cell display is in-session draft only.

**Rationale**: Spec assumptions / out of scope.

---

## R11 — RLS

**Decision**: New `public` tables rely on existing `ensure_rls_on_public_tables` trigger; no open `anon`/`authenticated` policies. Access via NestJS Prisma only.

**Rationale**: Constitution VII.

---

## R12 — RBAC (`setup_admin`)

**Decision**: New role `setup_admin` for package create/edit/pricing/plans/activate. List/view remains for other admin roles (`registration_admin`, `customer_care`, etc.). Agents may **read** pricing by slug for payment without `setup_admin`. Only the root (bootstrap) user may grant/revoke `setup_admin` via BA role UI + server-enforced user-update. Roles live in Supabase `user_metadata.roles`. Root seed includes `setup_admin`; existing envs need one-time backfill.

**Rationale**: Spec FR-024 / FR-024a; Clarifications.

**Alternatives considered**: Reuse `registration_admin` for mutate — rejected (too broad). Authentik roles — rejected (not how this app stores roles).

---

## R13 — Soft-loss timing

**Decision**: Soft loss warning within 1s of **cell edit commit** (blur / Enter / confirm after double-click), not per keystroke and not deferred to full grid save. Cadences 1/7/31/90/365.

**Rationale**: Spec FR-017 / SC-007.

---

## R14 — In-flight registration after deactivate

**Decision**: Inactive packages hidden from **new** package picks. Mid-registration journeys that already selected the package may finish payment using stored rates (FR-016).

**Rationale**: Spec Clarifications + Edge Cases.

---

## R15 — Amount type

**Decision**: `Decimal(10,2)` currency amounts; > 0 for completeness. No separate currency column in MVP (system default currency assumed).

**Rationale**: Spec edge cases + plan constraints; checklist remediations.
