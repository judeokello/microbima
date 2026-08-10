# Quickstart: Package Pricing Storage & Admin Wizard

**Branch**: `005-package-pricing-wizard`  
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

## Prerequisites

- API + Postgres running; agent-registration against that API
- `setup_admin` for package create/edit/pricing wizard (granted only by root/bootstrap user; root is seeded with `setup_admin`)
- **Existing envs**: ensure root user’s `user_metadata.roles` includes `setup_admin` (one-time backfill if seed already ran)
- Other admin roles may list/view packages read-only
- Agent role for registration payment smoke
- Migrations applied (pricing tables + Mfanisi seed/import)

## Verify migration

Both `mfanisi-boda` and `mfanisi-go` pricing JSON sheets are required migration inputs (same packages on staging/master). Point `DATABASE_URL` at the target env, then:

```bash
DATABASE_URL=... pnpm exec ts-node -r dotenv/config apps/api/scripts/migrate-package-pricing-json.ts
```

The script **fails** if either package slug is missing in that database (local gaps are not an excuse to skip a sheet).

1. Confirm packages `mfanisi-boda` and `mfanisi-go` have `MEMBER_ONLY` (+ expected Up to N / spouse from JSON).
2. `GET /internal/product-management/packages/by-slug/mfanisi-boda/pricing` returns plans/categories/rates **without** `pricingMode`.
3. Same for `mfanisi-go`.
4. Go may be incomplete until admin fills gaps — `isPricingComplete` reflects that.

## Happy path — create package wizard

1. Admin → underwriter → **Create package** (step 1): name, slug, description, frequencies (no Custom), leave inactive.
2. Confirm Member only category exists (auto-seeded).
3. Step 2 **Pricing**: add Silver/Gold plans if needed; fill all enabled frequency cells + annual; optional Up to N / spouse.
4. Use **Suggest fill** on empty cells; after committing a below-floor cell edit (blur/Enter), confirm soft loss icon appears within ~1s; save anyway if intentional.
5. Attempt activate while one cell empty → blocked.
6. Complete grid → save → package stays **inactive** until explicit activate → then appears in registration package list.

## Incomplete edit on active package

1. Open active package with complete pricing.
2. Persist a new plan (or new Up to N) without rates.
3. Expect: package `isActive=false`, warning banner, package hidden from **new** registration selection.
4. An in-flight registration that already selected the package may still finish payment.
5. Fill rates → activate again explicitly (not auto).

## Registration drop-in

1. As agent, start customer registration for an active migrated package.
2. Payment step: select plan, family category, spouse (if allowed), frequency — same controls as before.
3. Installment equals stored band (not daily×cadence); annual summary equals stored annual.
4. No “extrapolated from daily” copy.
5. With static JSON files removed/absent, payment still loads pricing from API.

## Undersized category

1. Registration with household size that exceeds selected category (when dependants known).
2. Submit blocked with clear message; cannot pick a cheaper undersized band.

## Go UAT

1. Compare Go monthly/weekly (and other enabled) installments to pre-cutover extrapolate where they differed.
2. Fill any missing required cells; confirm lookup-only amounts.
3. Walk one registration payment smoke for Go.
4. Confirm incomplete Go cannot activate until `isPricingComplete` is true.
5. **Sign-off**: `setup_admin` completes this checklist informally (no formal CSV/ticket required for MVP) before production cutover.

## Cleanup check

- `public/product-pricing/*.json` unused / removed.
- Grep shows no `productPricingPath` / `pricingMode === 'extrapolate'` in registration flows.
