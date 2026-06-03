# Data Model: Premium Statement PDF

**Feature**: `001-premium-statement-pdf`  
**Date**: 2026-04-03

## Schema changes

### `Package` (Prisma `Package`)

| Field | Type | Nullable | Notes |
|-------|------|----------|--------|
| `productDurationDays` | `Int` | **Yes** (initial migration) | Days in product “premium year” (1–365). Backfill then optional follow-up migration to `NOT NULL`. |

**Validation (application layer)**:

- Create/update: integer 1–365, max 3 digits; default **365** on create if omitted (after column is non-null in app logic or after backfill).

## Existing entities (read-only for this feature)

### `Policy`

- `policyNumber`, `startDate`, `endDate`, `status`, `premium`, `frequency`, `paymentCadence`, `productName`, `packageId`, `packagePlanId`, `customerId`

### `Customer`

- `firstName`, `middleName`, `lastName`

### `PackagePlan`

- `name` (plan label)

### `PolicyPayment`

- `paymentType`, `transactionReference`, `expectedPaymentDate`, `actualPaymentDate`, `amount`, `paymentStatus`

**Confirmed statuses** (statement table + filtered total): `COMPLETED`, `COMPLETED_PENDING_RECEIPT`.

## Computed fields (not persisted)

| Name | Rule |
|------|------|
| **Filtered total** | Sum `amount` where `policyId` = X, `paymentStatus` ∈ confirmed, `expectedPaymentDate` within optional `fromDate`–`toDate` (same as list filter). |
| **All-time captured** | Sum `amount` where `policyId` = X, `paymentStatus` ∈ confirmed (no date filter). |
| **Premium due** | See [research.md](./research.md) R3; **excess** label when paid > expected. |
| **Filename** | `DD-MonthName-{sanitized product+plan} Premium-Statement-{sanitized name}-{sanitized policy number}.pdf` |

## Relationships

```text
Customer 1--* Policy *--1 Package
Policy *--1 PackagePlan (optional)
Policy 1--* PolicyPayment
```

## State transitions

N/A (read-only report). `PaymentStatus` unchanged by this feature.
