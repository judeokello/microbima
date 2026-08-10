# Intake: Package Pricing DB + Admin Wizard

**Status:** Implementation in progress on branch `005-package-pricing-wizard` — see [`specs/005-package-pricing-wizard/`](../../specs/005-package-pricing-wizard/) (`spec.md`, `plan.md`, `data-model.md`, `contracts/openapi.yaml`, `quickstart.md`, `tasks.md`). Static JSON under `public/product-pricing/` removed; rates live in Postgres + Internal API.  
**Date:** 2026-08-10  
**Product surface:** Admin app (`apps/agent-registration`) + Internal API (`apps/api`)  
**Related prior art:**
- Static pricing files: `apps/agent-registration/public/product-pricing/{slug}-pricing.json`
- Installment helpers: `apps/agent-registration/src/lib/insurance-installment.ts`, `apps/api/src/utils/insurance-installment.util.ts`
- Family category derivation: `apps/api/src/utils/family-category.util.ts`
- Package admin UI: create-package dialog, package detail (`plans`, payment frequencies)
- Product management API: `apps/api/src/controllers/internal/product-management.controller.ts`
- Existing models: `Package`, `PackagePlan`, `PackagePaymentFrequency`

**This file:** Decision / intake log (includes proposed tables for planning).  
**Source of truth for implementation:** [`specs/005-package-pricing-wizard/spec.md`](../../specs/005-package-pricing-wizard/spec.md)

---

## 1. Problem

Insurance package rate tables (plan × family grouping × payment frequency) live as **static JSON files** under the agent-registration `public/` tree. They are:

- Baked into the Fly.io container image (no persistent volume).
- Loaded client-side via `fetch('/product-pricing/{slug}-pricing.json')`.
- Not editable through admin APIs.
- Unsafe / impossible to edit on a running multi-instance deployment (ephemeral disk, instance divergence, lost on redeploy).

Package metadata (name, slug, plans, payment frequencies) is already in Postgres, but **rates are not**. Admins also cannot define custom “up to N members” groupings in the UI; categories are hardcoded in JSON and in `deriveFamilyCategoryFromDependants` (`member_only` / `up_to_5` / `up_to_8`).

Additionally, `pricingMode: "extrapolate" | "lookup"` complicates runtime: extrapolate derives some installments as `daily × cadenceDays` instead of using table bands. Product direction is to **remove extrapolate entirely** and charge only explicit stored rates (lookup semantics).

---

## 2. Goals

1. **Persist pricing in Postgres** as the source of truth; stop serving rates from static JSON on agent-registration.
2. **Admin wizard** for package create/edit with three steps:
   - Step 1 — Package setup (existing: metadata + payment frequencies; no `CUSTOM`).
   - Step 2 — Pricing grid (groupings × frequencies × plans).
   - Step 3 — **Product Utilization Configuration** (placeholder content for now) → **Finish**.
3. **Lookup-only runtime** — remove `pricingMode` / `extrapolate`; installment and annual amounts come from stored cells for the selected frequency.
4. **Configurable family groupings** per package (member only, up to N, additional spouse), unique within the package.
5. **Soft loss warnings** when a coarser frequency amount is below “finest enabled band × cadence” (admin may still save).
6. **Activation gating** — package cannot be active while the pricing grid is incomplete; incomplete edits of an active package force inactive + clear admin warning.
7. **Edit UX** — double-click cells to edit; while editing, show previous and new values in-cell with the new value highlighted.
8. Migrate existing `mfanisi-boda` and `mfanisi-go` JSON into DB; then delete JSON files and FE static fetch path.

---

## 3. Non-goals (MVP)

- `CUSTOM` payment frequency on packages / pricing grid.
- Keeping or supporting `pricingMode: "extrapolate"` at runtime.
- Writing pricing JSON to container disk or Fly volumes.
- Auto-filling missing rates at **customer payment time** (inference is admin-authoring only, if at all).
- Product Utilization Configuration content on step 3 (blank shell + Finish only).
- Changing how policy premium snapshots already stored on `Policy` are recalculated historically (new enrollments/modifies use new lookup path).
- Partner-facing pricing editors (registration admin only).

---

## 4. Current state (baseline)

| Concern | Today |
|--------|--------|
| Package metadata / frequencies / plans | Postgres + admin UI |
| Rate bands (daily/weekly/monthly/annually) | `public/product-pricing/{slug}-pricing.json` only |
| Pricing modes | `extrapolate` (e.g. mfanisi-go) vs `lookup` (e.g. mfanisi-boda) |
| Family categories | Hardcoded keys + size thresholds in util |
| Additional spouse | JSON `additional_spouse` band; UI disables for `member_only` |
| Fly deploy | Agent-registration Dockerfile copies `public/`; no mounts; multi-machine FS not shared |

**Implication:** Changing rates in production today requires git + rebuild/redeploy of agent-registration. Disk edits on a running machine are not acceptable.

---

## 5. UX — three-step wizard

### 5.1 Step 1 — Package setup (keep)

Existing create/edit package surface:

- Name, slug, description, logo, etc.
- Payment frequencies: `DAILY` | `WEEKLY` | `MONTHLY` | `QUARTERLY` | `ANNUALLY` with installment counts.
- **No `CUSTOM`.**
- Frequencies chosen here become the **rows** of the pricing grid in step 2.

### 5.2 Step 2 — Pricing grid

Visual model matches underwriter rate sheets (sections of tables with plan columns).

**Sections (groupings)** — admin-defined, unique per package:

| Kind | Meaning |
|------|---------|
| Member only | Principal only; additional spouse does **not** apply |
| Up to N members per family | Custom N (e.g. 3, 5, 7, 8); no duplicate N on same package |
| Extra / additional spouse | Add-on rates per plan × frequency |

**Columns** — package plans (Silver, Gold, …). Admin can add a plan column (creates/uses `PackagePlan`).

**Rows** — enabled package payment frequencies from step 1 (daily, weekly, monthly, annually, quarterly as enabled).

**Cell editing**

- Double-click to enter/edit amount.
- On edit of an existing value: show **previous** and **new** in the same cell; highlight the new figure in a distinct color.
- Empty cells mean incomplete pricing for that plan × category × frequency.

**Authoring inference (optional helper, not runtime mode)**

- Admin may leave a cell empty and use a helper that suggests amount from a lower band × cadence (e.g. weekly from daily × 7).
- Suggested values must still be confirmed/saved as explicit cells.
- Runtime never extrapolates.

**Soft loss warning**

- Using finest **enabled** frequency as baseline (daily if present, else weekly, else …):
  - If weekly &lt; daily × 7 → warn.
  - If monthly &lt; finest × (cadence ratio for month) → warn.
  - Same pattern for coarser bands.
- Cadence days for warnings should align with existing `PAYMENT_CADENCE_DAYS` (1 / 7 / 31 / 90 / 365) unless Spec Kit decides otherwise.
- Warning is visual (e.g. icon); **save is still allowed**.

### 5.3 Step 3 — Product Utilization Configuration

- Title only for now; **no configuration content** in MVP.
- Primary action: **Finish** (completes wizard / returns to package detail).

### 5.4 Activation / incompleteness rules

**Complete pricing** means: for every active plan × every pricing category (including additional spouse where defined) × every enabled package frequency, a non-null amount is stored (or an explicit product rule says a given section is optional — default: all required).

| Event | Behavior |
|-------|----------|
| Create package | Cannot set `isActive = true` until pricing is complete |
| Edit active package and add plan / category / frequency that leaves gaps | **Immediately** set package `isActive = false` |
| Admin warning | Inform that package is disabled and **new customers cannot be registered** into it until editing is complete and pricing is fully populated |
| After full save with complete grid | **Activate** control becomes available again; admin may re-activate |

Inactive packages must not appear in customer/agent registration package dropdowns (existing inactive filtering should apply; verify all surfaces).

---

## 6. Data model proposal

Reuse existing:

- `packages`
- `package_plans`
- `package_payment_frequencies`

Add normalized pricing tables (names indicative; Spec Kit may refine).

### 6.1 `package_pricing_categories`

Groupings / sections for a package.

| Column | Type / notes |
|--------|----------------|
| `id` | PK |
| `packageId` | FK → `packages`, cascade delete |
| `key` | Stable slug, e.g. `member_only`, `up_to_5` |
| `displayName` | UI label, e.g. `M`, `M(5)` |
| `kind` | `MEMBER_ONLY` \| `UP_TO_N` \| `ADDITIONAL_SPOUSE` |
| `maxMembers` | Nullable; required when `kind = UP_TO_N` |
| `sortOrder` | Section order in grid |
| timestamps / audit | As per project norms |

**Constraints / rules**

- Unique `(packageId, key)`.
- At most one `MEMBER_ONLY` and one `ADDITIONAL_SPOUSE` per package.
- Unique `(packageId, maxMembers)` among `UP_TO_N` rows (no repeated N).
- Spouse add-on never applies when resolved category is member-only.

### 6.2 `package_plan_rates`

Grid cells.

| Column | Type / notes |
|--------|----------------|
| `id` | PK |
| `packagePlanId` | FK → `package_plans` |
| `packagePricingCategoryId` | FK → `package_pricing_categories` |
| `frequency` | `PaymentFrequency` enum; **reject `CUSTOM`** |
| `amount` | `Decimal(10, 2)` |
| timestamps / audit | As per project norms |

**Constraints / rules**

- Unique `(packagePlanId, packagePricingCategoryId, frequency)`.
- Frequency must be enabled on the parent package’s `package_payment_frequencies`.
- Prefer only storing rates for enabled frequencies; adding/removing a frequency in step 1 expands/contracts the required grid.

### 6.3 Optional: rate revisions (edit history)

For audit and richer “previous vs new” beyond in-session draft:

- `package_plan_rate_revisions` (`rateId`, `previousAmount`, `newAmount`, `changedBy`, `changedAt`)

MVP may use in-session draft comparison only; Spec Kit should decide.

### 6.4 What is removed

- File field / concept of `pricingMode` on package pricing payloads.
- Dependence on `package.slug` **solely** for static file lookup (slug may remain for URLs/display; rates keyed by `packageId`).
- Hardcoded global category thresholds in favor of per-package `maxMembers` bands.

---

## 7. Runtime resolution

### 7.1 API (illustrative)

- `GET /internal/product-management/packages/:id/pricing` — full grid + categories + plans.
- `PUT /internal/product-management/packages/:id/pricing` — replace/upsert grid (wizard step 2 save).
- Category CRUD may be nested in the PUT or separate endpoints (Spec Kit choice).

Response shape can mirror today’s JSON for easier FE cutover, **without** `pricingMode`:

```json
{
  "packageId": 1,
  "isPricingComplete": true,
  "categories": [
    { "key": "member_only", "display": "M", "kind": "MEMBER_ONLY", "maxMembers": 1 },
    { "key": "up_to_5", "display": "M(5)", "kind": "UP_TO_N", "maxMembers": 5 },
    { "key": "additional_spouse", "display": "Additional spouse", "kind": "ADDITIONAL_SPOUSE" }
  ],
  "plans": {
    "silver": {
      "planId": 10,
      "name": "Silver",
      "rates": {
        "member_only": { "daily": 56, "weekly": 392, "monthly": 1765, "annually": 17645 },
        "up_to_5": { "daily": 99, "weekly": 695, "monthly": 3129, "annually": 31293 },
        "additional_spouse": { "daily": 12, "weekly": 84, "monthly": 379, "annually": 3789 }
      }
    }
  }
}
```

### 7.2 Installment / annual math

- Installment = stored amount for selected frequency (category ± additional spouse when applicable).
- Annual display = stored `annually` band (or Spec Kit-defined fallback if annually not enabled — prefer requiring annually when needed for UI).
- Delete extrapolate branches in FE + API helpers.

### 7.3 Family category derivation

Replace hardcoded `≤1 / ≤5 / ≤8` with package-aware logic:

- Household size = 1 + active dependants.
- Size 1 → `MEMBER_ONLY` category.
- Size &gt; 1 → smallest `UP_TO_N` category where `maxMembers >= householdSize` (define overflow behavior if none fit — Spec Kit must specify: block enrollment vs highest band).
- Additional spouse premium: same idea as today (e.g. more than one spouse, and not member-only).

### 7.4 FE consumers to switch off static JSON

“FE” = frontend. These must stop `fetch(productPricingPath(slug))` and call the API instead:

- Registration payment page
- Modify product dialog
- Recovery / dashboard payment flows
- Any tests that assume `public/product-pricing/*.json`

---

## 8. Activation service rules (backend)

Enforce server-side (not UI-only):

1. Reject `isActive: true` if `isPricingComplete === false`.
2. When mutations would make pricing incomplete (add plan, add category, add frequency without rates):
   - Persist `isActive = false`.
   - Return warning flag/message for admin UI banner.
3. `isPricingComplete` computed from plans × categories × enabled frequencies vs existing rate rows.

---

## 9. Migration path

1. Prisma migration: new tables + enums for category kind.
2. One-time seed/import from:
   - `apps/agent-registration/public/product-pricing/mfanisi-boda-pricing.json` (`lookup`)
   - `apps/agent-registration/public/product-pricing/mfanisi-go-pricing.json` (store **explicit bands from file**; stop extrapolating at read time — validate Go monthly/weekly match intended charges).
3. Ship API + admin wizard + switch FE consumers together (or behind short feature flag if Spec Kit prefers).
4. Delete static JSON files and `productPricingPath` usage.
5. Remove `PricingMode` / extrapolate code paths and tests; replace with lookup-only tests.

**Post-migration:** rate edits do **not** require redeploy. Schema/UI/API changes still do.

---

## 10. Soft loss warning formula (proposed)

Let `C(f)` = cadence days for frequency `f` from `PAYMENT_CADENCE_DAYS`.  
Let finest enabled frequency on the package be `f0` with amount `A0`.

For each coarser enabled frequency `f` with amount `A`:

- Expected floor ≈ `A0 * (C(f) / C(f0))` (document rounding: e.g. compare after `Math.round` to cents/whole KES as product decides).
- If `A < floor` → soft warn on that cell.

Admin may save anyway.

---

## 11. Roles & access

| Capability | Expected |
|------------|----------|
| Create/edit package wizard, pricing grid, activate | **`setup_admin`** only |
| List/view packages (read-only) | Other admin roles (`registration_admin`, `customer_care`, …) |
| Grant/revoke `setup_admin` | **Root (bootstrap) user only** (Supabase `user_metadata.roles`) |
| Read pricing for payment/modify/recovery | Existing agent/admin flows via internal API (no `setup_admin` required) |

**Normative detail:** [`specs/005-package-pricing-wizard/spec.md`](../../specs/005-package-pricing-wizard/spec.md) FR-024 / FR-024a. This intake section is historical context; do not implement from the older “registration admin only” wording.

---

## 12. Open questions for Spec Kit `/specify`

> **Resolved in Spec Kit clarifications (2026-08-10+).** Kept for history; implement from `spec.md`, not this list.

1. Overflow when household size exceeds all `UP_TO_N` bands — **block** (no clamp).
2. Is `QUARTERLY` required in the grid whenever enabled on the package? — **Yes**, when enabled; annual always required for completeness.
3. Persist rate revision history in MVP? — **No**; in-session previous/new only.
4. Cadence ratios for loss warnings — **1/7/31/90/365**.
5. Step 1/2 chrome — **unspecified** (tabs vs stepper OK).
6. Feature flag during cutover vs big-bang? — **Big-bang** after migration/UAT.

Also locked: lookup-only; Member only required; suggest-fill MVP; soft loss on cell commit ≤1s; deactivate on persist; in-flight registrations may finish; Go amounts may differ + informal `setup_admin` UAT sign-off.
---

## 13. Suggested Spec Kit seed summary

Use this intake to generate a feature that:

- Moves package pricing from static FE JSON to Postgres.
- Removes extrapolate pricing mode.
- Adds admin wizard steps 1–3 (step 3 placeholder).
- Implements pricing completeness ↔ package active gating with warnings.
- Migrates mfanisi-boda and mfanisi-go rates; deletes JSON files.
- Updates payment/modify/recovery to load rates from API.
- Makes family categories configurable per package.

---

## 14. Reference: legacy JSON shape

```json
{
  "packageSlug": "mfanisi-boda",
  "pricingMode": "lookup",
  "plans": {
    "silver": {
      "name": "Silver",
      "categories": {
        "member_only": { "display": "M", "daily": 56, "weekly": 392, "monthly": 1765, "annually": 17645 },
        "up_to_5": { "display": "M(5)", "daily": 99, "weekly": 695, "monthly": 3129, "annually": 31293 },
        "up_to_8": { "display": "M(8)", "daily": 123, "weekly": 861, "monthly": 3869, "annually": 38686 }
      },
      "additional_spouse": { "daily": 12, "weekly": 84, "monthly": 379, "annually": 3789 }
    }
  }
}
```

Target: same information in `package_pricing_categories` + `package_plan_rates`, no `pricingMode`.
