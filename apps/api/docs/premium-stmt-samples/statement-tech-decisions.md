# Premium Statement PDF — Technical & Planning Notes

**Companion to**: `spec.md` (`specs/001-premium-statement-pdf/spec.md`)  
**Audience**: `/speckit.plan`, implementers, API/UI work  
**Last updated**: 2026-04-03

This document captures **implementation decisions** deliberately kept out of the stakeholder spec.

---

## 1. Payment fetch strategy

- Prefer **database queries** that return **only** needed rows (policy + optional date range + **status IN (...)** ), not “load all payments then filter in app”.
- **UI pagination**: list endpoint supports `page` / `pageSize` (or cursor) plus the same filters as today, with optional **`paymentStatus`** filter:
  - **Payments tab default**: `ALL` (no status restriction) **or** explicit “all statuses” — preserve current behavior unless product decides otherwise.
  - **PDF generation**: dedicated request with **`paymentStatus IN ('COMPLETED', 'COMPLETED_PENDING_RECEIPT')`** and the **same from/to** as the UI filter.
- PDF generation MUST run a query that returns **all** matching rows for that filter (or paged server-side assembly into one PDF), so row count is not limited to the first UI page.

---

## 2. “Captured” / confirmed payment statuses (Prisma)

Use **`COMPLETED`** and **`COMPLETED_PENDING_RECEIPT`**.

- **`PENDING_STK_CALLBACK`**: **exclude** from statement table and from all statement totals.
- Align **`getCustomerPolicyDetail` (or successor)** “total paid” / related fields with this definition **if** those numbers are shown next to the same policy context, to avoid drift.

---

## 3. Header fields — data mapping

| Header field | Source / rule |
|--------------|----------------|
| Statement date | Generation date formatted **long US** (e.g. `April 3, 2026`). Align “as-of” for premium due with **UTC midnight** of that calendar date unless product specifies otherwise. |
| Salutation | `Customer.firstName`, `middleName`, `lastName` — full name, template styling (e.g. uppercase in sample). |
| Product | `Package.name` via `Policy.package`. |
| Plan | `PackagePlan.name` via `Policy.packagePlan` (nullable → show **"—"** or empty per template). |
| Premium frequency | `Policy.frequency` — display label (Daily, Weekly, …). |
| Premium as per frequency | `Policy.premium` (installment amount). |
| Policy number (PDF body) | `Policy.policyNumber` — **slashes allowed**. |
| Policy number (filename) | Replace `/` with `-`. |
| Total premium paid (filtered) | Sum of `amount` for rows in PDF (confirmed + date filter). |
| All-time captured payments | Sum of `amount` for `paymentStatus IN (COMPLETED, COMPLETED_PENDING_RECEIPT)` for this **policyId**, **ignoring** UI from/to. **Date predicate**: recommend `expectedPaymentDate >= policy.startDate` (start at start-of-day UTC) — **confirm in implementation review** if business prefers `actualPaymentDate` instead. |
| Policy start / end | `Policy.startDate`, `Policy.endDate` — long US date format. **`endDate` null** → display **"-"**. |
| Status | `Policy.status` (enum string / label). |
| Premium due | See §5. |

---

## 4. Blocking generation (validation)

| Condition | UX | Telemetry |
|-----------|-----|-----------|
| `policyNumber` null/empty | In-page bar: e.g. **Error: Missing Policy number. Contact support** | Sentry **warning** |
| `startDate` null | Specific message, e.g. missing start date | Sentry **warning** |
| `premium` === 0 | Specific message, e.g. incorrect/zero premium | Sentry **warning** |

Do **not** generate PDF when any of the above holds.

---

## 5. Premium due algorithm

- **Cadence**: use **`Policy.paymentCadence`** (days) only — **not** `frequency` for math.
- **As-of “now”**: **UTC midnight** for the statement date (same as spec “as-of”).
- **Inclusive** calendar span: **`policy.startDate`** through as-of date, both **inclusive** (define consistently in UTC).
- **Expected periods**: floor(inclusiveDayCount / paymentCadence).
- **Expected amount**: `expectedPeriods * Number(policy.premium)`.
- **Captured paid (for due comparison)**: sum of **confirmed** payments for policy **from start through as-of** (align date field with §3 all-time predicate — typically `expectedPaymentDate` or `actualPaymentDate` bounds; **pick one rule** and use consistently).
- **Premium due**: `max(0, expected - paid)` for display magnitude; if `paid > expected`, show **positive** difference and append **`(Excess Payment)`** next to the value.

---

## 6. Package: `productDurationDays`

- **Column**: `Package.productDurationDays` — integer, **nullable** in first migration; **backfill** (e.g. 276) then **NOT NULL** in a follow-up migration.
- **Create/update package** (admin API + UI): numeric control **1–365**, **max length 3** characters, **no** letters; **default when omitted on create**: **365**.
- **Statement / payments tab**: **no silent fallback** in business logic once packages are expected to be populated; if null at runtime during transition, treat as data defect (block statement + Sentry **or** explicit team choice).
- **Payments tab** “installments in premium period”: replace hardcoded **`PREMIUM_DAYS_PER_YEAR = 276`** with **`package.productDurationDays`** when loading policy/package context.

---

## 7. Filename format

`DD-MonthName-{ProductPlanLabel} Premium-Statement-{FullName}-{PolicyNumberWithHyphens}.pdf`

Example: `03-April-MfanisiGo Gold Premium-Statement-John Maina Mwangi-MP-MFG-001.pdf`

- **`ProductPlanLabel`**: from `Policy.productName` + plan — **sanitize** for filesystem (`/ \ : * ? " < > |`, etc.).
- **Month name**: match approved template (full vs abbreviated).
- **Day**: zero-padded two digits.

---

## 8. Logo asset

- **Path**: `apps/api/assets/maishapoalogo-nobg.png`
- Load from **local filesystem** / buffer at PDF generation — no Supabase dependency.

---

## 9. Postpaid

- Same **`postpaid`** detection as existing payments features: **disable** Generate report with explanation.

---

## 10. PDF table columns

Payment type; Transaction reference; Expected payment date; Actual payment date; Amount. **No** account number.

---

## 11. Suggested API shape (for plan/tasks)

- e.g. `GET .../customers/:customerId/policies/:policyId/premium-statement.pdf?from=&to=`  
  - `Content-Type: application/pdf`, `Content-Disposition` filename per §7.  
  - Server query: confirmed statuses + date filter on **`expectedPaymentDate`** (current list behavior) unless product changes.

---

## 12. Open implementation choices

- **All-time / premium-due** payment date field: `expectedPaymentDate` vs `actualPaymentDate` vs both — finalize in plan.
- **Statement printed date** vs **as-of** for due: default both to generation date at UTC midnight unless legal wants filter end date.