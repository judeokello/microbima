# Research: Premium Statement PDF

**Feature**: `001-premium-statement-pdf`  
**Date**: 2026-04-03

## R1 — PDF generation stack

**Decision**: Use **`@react-pdf/renderer`** (`renderToBuffer`) for the premium statement, following the existing pattern in `apps/api/src/modules/messaging/attachments/attachment-generator.service.ts` (member card PDF).

**Rationale**: Dependency already in `apps/api/package.json`; no new native deps; embeds PNG logo; deterministic layout; fits server-side NestJS.

**Alternatives considered**:

- **Puppeteer + HTML** — Already used for some flows; heavier (browser launch), higher latency; keep for HTML-first templates only.
- **pdf-lib** — Not in use; would add dependency and manual layout work.

## R2 — All-time captured payments (spec vs early tech note)

**Decision**: **FR-005 (spec)** wins: sum **`amount`** for **all** rows for the policy where `paymentStatus IN (COMPLETED, COMPLETED_PENDING_RECEIPT)`, **without** filtering by `expectedPaymentDate` / `actualPaymentDate`.

**Rationale**: Clarification session explicitly chose “all confirmed for policy regardless of dates.”

**Alternatives considered**: Restricting to `expectedPaymentDate >= policy.startDate` — **rejected** for all-time line; may still be used for **premium-due paid** slice (R3).

## R3 — Premium due: “paid” component

**Decision**: Sum **`amount`** for **confirmed** payments where **`expectedPaymentDate`** falls in the **closed window** from **policy start (start of day UTC)** through **statement as-of (end of day UTC)** inclusive, matching installment schedule semantics. **Expected periods**: `floor(inclusiveDayCount / policy.paymentCadence)` from start through as-of; **expected amount** = periods × `Number(policy.premium)`; display **premium due** and **excess** per spec.

**Rationale**: Aligns “paid through as-of” with scheduled installments; uses `paymentCadence` only (not `frequency` enum for math). UTC boundaries per constitution.

**Alternatives considered**: Using `actualPaymentDate` for the paid sum — possible for cash-basis interpretation; spec defers to planning; **expectedPaymentDate** chosen for schedule alignment.

## R4 — Statement date and as-of

**Decision**: Printed **statement date** = calendar date of generation in **long US format**; **as-of** for premium due = **UTC midnight** of that calendar date as the end-of-day window for “through as-of” (consistent with tech doc §5).

**Rationale**: Matches stakeholder clarification (generation day); avoids filter `to` date affecting due.

## R5 — Payments list API: pagination and status filter

**Decision**: Extend **`GET /internal/customers/:customerId/payments`** with optional **`paymentStatus`** (repeat query param or comma-separated list) filtering `PolicyPayment.paymentStatus`. Add optional **`page`** + **`pageSize`** (defaults preserve current “all rows” behavior for backward compatibility, or document breaking change — prefer **default pageSize large** or **opt-in pagination** in first iteration).

**Rationale**: Tech notes require DB-level filtering and UI pagination; PDF endpoint uses its own query with confirmed-only + date range.

**Alternatives considered**: Single mega-fetch for UI — rejected for scale; PDF-only endpoint without list changes — rejected because UI must not load all rows.

## R6 — Filename and sanitization

**Decision**: Build filename per spec §7 + **FR-010**; sanitize with `replace` for `/ \ : * ? " < > |` and collapse spaces; policy number `/` → `-`.

**Rationale**: Cross-platform safe downloads.

## R7 — Postpaid detection

**Decision**: Reuse same scheme lookup as **`getCustomerPolicyDetail`** / on-demand STK: `PackageSchemeCustomer` → `scheme.isPostpaid` (or existing helper). Disable **Generate report** + block server if postpaid.

**Rationale**: Single source of truth with existing Payments feature.

## R8 — Package default `productDurationDays`

**Decision**: **365** when omitted on create (per tech doc §6); validate **1–365** on create/update.

**Rationale**: Matches product owner note; migration backfill can set **276** for Mfanisi Go–type packages before NOT NULL.
