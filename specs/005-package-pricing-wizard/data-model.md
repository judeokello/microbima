# Data Model: Package Pricing Storage & Admin Wizard

**Branch**: `005-package-pricing-wizard`  
**Date**: 2026-08-10  
**Spec**: [spec.md](./spec.md)  
**Intake**: [docs/proposals/package-pricing-db-wizard.md](../../docs/proposals/package-pricing-db-wizard.md)

## Overview

Reuse `packages`, `package_plans`, `package_payment_frequencies`. Add normalized pricing categories and plan rate cells. Remove runtime dependence on static `{slug}-pricing.json`.

## New enum

### `PackagePricingCategoryKind`

| Value | Meaning |
|-------|---------|
| `MEMBER_ONLY` | Principal-only band; required once per package; spouse add-on never applies |
| `UP_TO_N` | Family band up to `maxMembers` (inclusive household size) |
| `ADDITIONAL_SPOUSE` | Optional add-on rates; at most one per package |

---

## Existing entities (touched)

### `Package`

| Change | Notes |
|--------|--------|
| `isActive` | Cannot be true when pricing incomplete; auto-false when incomplete-making persist |
| `slug` | Remains for identity/URLs; **not** required for static file lookup after cutover |

No `pricingMode` column.

### `PackagePlan`

Unchanged structurally. Creating an active plan without rates → incompleteness → deactivate package if was active.

### `PackagePaymentFrequency`

Unchanged. Enabling a frequency expands required rate cells (except annual, which is always required — see below). `CUSTOM` remains disallowed for packages.

---

## New entity: `PackagePricingCategory`

Table: `package_pricing_categories`

| Field | Type | Notes |
|-------|------|--------|
| `id` | Int PK | |
| `packageId` | Int FK → packages | ON DELETE CASCADE |
| `key` | VarChar(50) | Stable slug: `member_only`, `up_to_5`, `additional_spouse`, … |
| `displayName` | VarChar(100) | Agent/admin label e.g. `M`, `M(5)` |
| `kind` | `PackagePricingCategoryKind` | |
| `maxMembers` | Int? | Required iff `UP_TO_N`; null otherwise; ≥ 2 |
| `sortOrder` | Int | Grid section order |
| `createdAt` / `updatedAt` | timestamptz | UTC |
| `createdBy` / `updatedBy` | string? | Align with package audit norms |

**Constraints**

- Unique `(packageId, key)`
- At most one `MEMBER_ONLY` per package (partial unique or app+DB check)
- At most one `ADDITIONAL_SPOUSE` per package
- Unique `(packageId, maxMembers)` among rows where `kind = UP_TO_N`
- `MEMBER_ONLY` required for every package (create with package or first pricing ensure)

**Relations**

- `package` → Package
- `rates` → PackagePlanRate[]

---

## New entity: `PackagePlanRate`

Table: `package_plan_rates`

| Field | Type | Notes |
|-------|------|--------|
| `id` | Int PK | |
| `packagePlanId` | Int FK → package_plans | ON DELETE CASCADE |
| `packagePricingCategoryId` | Int FK → package_pricing_categories | ON DELETE CASCADE |
| `frequency` | `PaymentFrequency` | `DAILY` \| `WEEKLY` \| `MONTHLY` \| `QUARTERLY` \| `ANNUALLY` only; **reject `CUSTOM`** |
| `amount` | Decimal(10,2) | Must be > 0 when present for completeness |
| `createdAt` / `updatedAt` | timestamptz | UTC |
| `createdBy` / `updatedBy` | string? | |

**Constraints**

- Unique `(packagePlanId, packagePricingCategoryId, frequency)`
- Plan and category must belong to the same package (enforce in service; optional DB trigger)
- Amount > 0 for completeness (zero/negative invalid)

**Annual rule**

- Completeness always requires an `ANNUALLY` rate for each active plan × each defined category.
- Sellable frequencies for customers = `package_payment_frequencies` only.
- If Annually is also enabled as payment frequency, the same `ANNUALLY` cell is the installment amount.

**Enabled-frequency rates**

- Completeness also requires a rate for each frequency in `package_payment_frequencies` (excluding CUSTOM).
- If Annually is enabled, it is covered by the always-required annual cell (no double requirement beyond one `ANNUALLY` row).

---

## Completeness definition

For package P:

1. At least one active `PackagePlan`.
2. Exactly one `MEMBER_ONLY` category exists.
3. For every **active** plan × every category on P × every frequency in  
   `enabledFrequencies(P) ∪ {ANNUALLY}`:  
   a `PackagePlanRate` exists with `amount > 0`.

`isPricingComplete` is computed (not necessarily stored); may be returned on API responses and package details.

---

## State transitions (package active)

```text
[inactive] --activate--> [active]
                ^ only if isPricingComplete

[active] --persist incomplete-making change--> [inactive] + warning
         (add plan, add category, enable frequency without rates)

[inactive] --save complete rates--> [inactive] (activate still explicit)
```

---

## Household resolution (runtime)

| Household size | Category |
|----------------|----------|
| 1 | `MEMBER_ONLY` |
| > 1 | Smallest `UP_TO_N` with `maxMembers >= size` |
| No fitting band | Block (no clamp) |

**Undersized picker**: When household size is **known**, block selecting a band that cannot cover that size. When size is **unknown**, skip undersize check (agent may still pick; overflow/block rules apply once size is known).

Additional spouse: disabled for Member only; apply add-on when opted in and (when household known) more than one spouse; block add-on if household known and ≤1 spouse.

---

## Soft loss / suggest-fill (derived, not stored)

Cadence days: DAILY=1, WEEKLY=7, MONTHLY=31, QUARTERLY=90, ANNUALLY=365.

Not persisted; computed on **cell edit commit** (admin UI) and optionally returned as advisory soft-loss hints on pricing responses. Suggest-fill never silently overwrites non-empty cells without confirm.

---

## Migration mapping (legacy JSON → tables)

| JSON | Target |
|------|--------|
| `plans.{key}` | `PackagePlan` matched by name case-insensitive; create if missing |
| `categories.{key}` | `PackagePricingCategory` `UP_TO_N` or `MEMBER_ONLY` |
| `additional_spouse` | Category kind `ADDITIONAL_SPOUSE`, key `additional_spouse` |
| `daily/weekly/monthly/annually` | `PackagePlanRate.frequency` + amount |
| `pricingMode` | Dropped |

Packages: `mfanisi-boda`, `mfanisi-go` by slug.

---

## Out of model (MVP)

- `package_plan_rate_revisions`
- `pricingMode` field
- Static files under `public/product-pricing/`
