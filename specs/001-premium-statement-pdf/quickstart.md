# Quickstart: Premium Statement PDF

**Feature**: `001-premium-statement-pdf`

## Prerequisites

- PostgreSQL with migrations applied
- `apps/api` env configured (DB, Sentry, auth)
- Logo file present: `apps/api/assets/maishapoalogo-nobg.png`
- Internal API reachable from agent-registration

## 1. Apply migration

```bash
cd apps/api
npx prisma migrate dev --name package_product_duration_days
```

(Use exact migration name from implementation.)

## 2. Backfill `productDurationDays` (if nullable phase)

Run SQL or script to set `276` / `365` per package as per product rules; then optional second migration to `NOT NULL`.

## 3. Smoke-test PDF endpoint

With a valid internal token and a prepaid policy with confirmed payments:

1. `GET /api/internal/customers/{customerId}/policies/{policyId}/premium-statement?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD`
2. Expect `200`, `Content-Type: application/pdf`, `Content-Disposition` attachment with `.pdf` filename.
3. Open PDF: header fields, table columns, amounts match UI conventions.

## 4. UI

1. Open **Customer** → **Payments**
2. Select package-plan, set dates, **Filter**
3. With confirmed rows: **Generate report** → file downloads
4. Postpaid policy: button disabled with message

## 5. Lint

From repo root:

```bash
pnpm lint
```

## 6. Negative tests

- Missing policy number → 422 + no PDF; Sentry warning
- Missing `productDurationDays` on package → 422 + no PDF
- Wrong customer / no access → 404 (same as payments)
