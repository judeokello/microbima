# Data Model: Modify Product & Policy Lifecycle

**Feature**: `002-modify-product-policy`  
**Date**: 2026-07-09

## Overview

This feature extends the policy/customer lifecycle with **DEACTIVATED** status, an audit entity for all status transitions, policy supersession links for modify-product, schema constraint changes to allow historical policy rows per package, and **OUTSTANDING** payment placeholders for installment backfill.

---

## Enum changes

### PolicyStatus (add value)

```prisma
enum PolicyStatus {
  PENDING_ACTIVATION
  ACTIVE
  SUSPENDED
  DEACTIVATED   // NEW — admin/business closure; reversible in future lifecycle
  TERMINATED    // fraud/permanent
  EXPIRED
}
```

### CustomerStatus (add value)

```prisma
enum CustomerStatus {
  PENDING_KYC
  PENDING_ACTIVATION
  KYC_VERIFIED
  ACTIVE
  SUSPENDED
  DEACTIVATED   // NEW — no ACTIVE policies; distinct from TERMINATED
  TERMINATED
  DELETED
}
```

### PaymentStatus (add value)

```prisma
enum PaymentStatus {
  PENDING_STK_CALLBACK
  COMPLETED_PENDING_RECEIPT
  COMPLETED
  OUTSTANDING   // NEW — backfilled expected installment not yet paid (not STK)
}
```

`missedPayments` row count (Products tab) treats any row with `expectedPaymentDate < now` and `actualPaymentDate == null` as missed — **OUTSTANDING** rows satisfy this without impersonating STK placeholders.

### StatusChangeEntityType

```prisma
enum StatusChangeEntityType {
  POLICY
  CUSTOMER
}
```

### StatusChangeTrigger

```prisma
enum StatusChangeTrigger {
  MANUAL_ADMIN
  MODIFY_PRODUCT
  PAYMENT_LIFECYCLE
  SYSTEM
}
```

---

## Policy model changes

```prisma
model Policy {
  // ... existing fields ...

  deactivatedAt        DateTime?  // denormalized; set when status → DEACTIVATED

  supersedesPolicyId   String?    @db.Uuid  // old policy this one replaced (modify)
  supersededByPolicyId String?    @db.Uuid  // new policy that replaced this one

  supersedesPolicy     Policy?  @relation("PolicySupersession", fields: [supersedesPolicyId], references: [id])
  supersededByPolicy   Policy?  @relation("PolicySupersession", fields: [supersededByPolicyId], references: [id])
  supersededPolicies   Policy[] @relation("PolicySupersession")

  statusChanges        EntityStatusChange[]

  // REMOVE: @@unique([customerId, packageId])
  // ADD via raw SQL migration — partial unique index (see below)
}
```

### Partial unique index (PostgreSQL)

```sql
CREATE UNIQUE INDEX policies_customer_package_active_unique
ON policies ("customerId", "packageId")
WHERE status IN ('ACTIVE', 'PENDING_ACTIVATION', 'SUSPENDED');
```

Allows multiple **DEACTIVATED** / **TERMINATED** / **EXPIRED** rows per `(customerId, packageId)` for modify history.

---

## Customer model changes

```prisma
model Customer {
  // ... existing fields ...

  deactivatedAt   DateTime?  // denormalized; set when status → DEACTIVATED

  statusChanges   EntityStatusChange[]
}
```

---

## EntityStatusChange (source of truth)

```prisma
model EntityStatusChange {
  id            String                  @id @default(uuid()) @db.Uuid
  entityType    StatusChangeEntityType
  customerId    String                  @db.Uuid
  policyId      String?                 @db.Uuid

  fromStatus    String                  @db.VarChar(50)
  toStatus      String                  @db.VarChar(50)
  reason        String                  @db.VarChar(1000)

  trigger       StatusChangeTrigger
  changedBy     String                  @db.Uuid
  correlationId String?                 @db.VarChar(100)
  metadata      Json?

  createdAt     DateTime                @default(now())

  customer Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  policy   Policy?  @relation(fields: [policyId], references: [id], onDelete: SetNull)

  @@index([customerId, createdAt])
  @@index([policyId, createdAt])
  @@map("entity_status_changes")
}
```

### Mandatory `reason`

Required for:

- Manual deactivate
- Manual activate (SUSPENDED→ACTIVE)
- Reset start date
- Modify product (also used for deactivate step within modify)

Not required for future `PAYMENT_LIFECYCLE` auto-suspend (system-generated reason in `reason` field).

### Metadata examples

**Modify product (`trigger: MODIFY_PRODUCT`):**

```json
{
  "operation": "MODIFY_PRODUCT",
  "sourcePolicyId": "uuid-old",
  "newPolicyId": "uuid-new",
  "firstPaymentId": 12345,
  "paymentsMovedCount": 11,
  "placeholdersBackfilledCount": 8,
  "planBefore": "Silver",
  "planAfter": "Gold",
  "packagePlanIdBefore": 1,
  "packagePlanIdAfter": 2,
  "schemeIdBefore": 10,
  "schemeIdAfter": 12,
  "frequencyBefore": "DAILY",
  "frequencyAfter": "WEEKLY",
  "cadenceBefore": 1,
  "cadenceAfter": 7,
  "premiumBefore": "152.00",
  "premiumAfter": "980.00",
  "policyNumberChoice": "KEEP_EXISTING",
  "familyCategory": "up_to_5"
}
```

**Reset start date:**

```json
{
  "operation": "RESET_START_DATE",
  "previousStartDate": "2026-01-01T00:00:00.000Z",
  "newStartDate": "2026-02-15T00:00:00.000Z",
  "previousEndDate": "2026-12-31T23:59:59.999Z",
  "newEndDate": "2027-02-14T23:59:59.999Z"
}
```

---

## Customer ↔ policy status coupling

**Definition:** “Active policy” = `PolicyStatus.ACTIVE` only (excludes `PENDING_ACTIVATION`).

### On policy deactivate

After setting policy → `DEACTIVATED`:

| Remaining policies (not DEACTIVATED/TERMINATED) | Customer status |
|------------------------------------------------|-----------------|
| ≥1 ACTIVE | unchanged |
| 0 ACTIVE, ≥1 PENDING_ACTIVATION | `PENDING_ACTIVATION` |
| otherwise | `DEACTIVATED` (+ `deactivatedAt`) |

Includes: only SUSPENDED → deactivate → customer `DEACTIVATED`.

### On modify (within same transaction)

1. Deactivate source (rules above apply mid-transaction).
2. Create new policy (ACTIVE or PENDING_ACTIVATION).
3. If new policy is ACTIVE and customer was `DEACTIVATED` or `SUSPENDED` → customer `ACTIVE` (clear `deactivatedAt` if set).

### On activate (SUSPENDED→ACTIVE)

- Customer `SUSPENDED` → `ACTIVE`
- Customer already `ACTIVE` → unchanged

### TERMINATED

- Immutable. Block all lifecycle mutations.

---

## Modify product transaction

```
BEGIN TRANSACTION
  1. Validate admin, customer not TERMINATED, source eligible
  2. Validate postpaid migration rules
  3. Record EntityStatusChange: source policy → DEACTIVATED
  4. Update source: status=DEACTIVATED, deactivatedAt=now, supersededByPolicyId=(pending)
  5. Apply customer status coupling (step 3)
  6. Resolve paymentAcNumber from source (transfer)
  7. Create new policy (same packageId, new plan/scheme/frequency/cadence/premium/productName)
  8. Link supersedesPolicyId / supersededByPolicyId
  9. Update package_scheme_customers if scheme changed
 10. Move policy_payments (selected + subsequent) to new policyId
 11. Set new startDate/endDate from first migrated payment (or null if none)
 12. Set new status ACTIVE | PENDING_ACTIVATION
 13. If customer was DEACTIVATED/SUSPENDED and new ACTIVE → customer ACTIVE
 14. Run backfillMissedInstallmentPlaceholders(newPolicyId)
 15. Write EntityStatusChange for new policy activation / modify metadata
COMMIT
```

### Payment migration rules

- Source: only the policy being modified.
- Eligible payments: `COMPLETED` or `COMPLETED_PENDING_RECEIPT` with `actualPaymentDate` set.
- Block if any selected payment has `postpaidSchemePaymentItem` link.
- Order by `expectedPaymentDate` asc (or `actualPaymentDate`); admin picks `firstPaymentId`; move that row and all later completed rows.

### Policy number choice

| Choice | Behavior |
|--------|----------|
| `KEEP_EXISTING` | Copy `policyNumber` from source to new policy |
| `GENERATE_NEW` | Call `generatePolicyNumberInTransaction` for package |

### paymentAcNumber

- Clear on source policy (`null`) and set on new policy in same transaction (preserves global uniqueness).

---

## Installment placeholder backfill

**Function:** `backfillMissedInstallmentPlaceholders(policyId, tx)`

**When:** After modify (and optionally after reset start date — out of scope unless added later).

**Inputs:** `startDate`, `endDate`, `paymentCadence`, `premium`, existing `policy_payments` on policy.

**Algorithm (UTC calendar semantics):**

```
slotStart = utcDayStart(startDate)
deadline = min(utcDayEnd(now), utcDayEnd(endDate))
periodIndex = 0

while slotStart <= deadline:
  slotEnd = slotStart + (paymentCadence - 1) calendar days  // inclusive window

  covered = any policy_payment on this policy where:
    paymentStatus in (COMPLETED, COMPLETED_PENDING_RECEIPT)
    AND actualPaymentDate is not null
    AND coalesce(actualPaymentDate, expectedPaymentDate) within [slotStart, slotEnd] UTC day bounds

  outstandingExists = any policy_payment where:
    paymentStatus = OUTSTANDING
    AND expectedPaymentDate = slotStart (or same period index)

  if not covered and not outstandingExists:
    INSERT policy_payment:
      policyId, paymentType=MPESA (or policy default)
      transactionReference = OUTSTANDING-{policyId}-{periodIndex}  // unique
      amount = premium
      expectedPaymentDate = slotStart (preserve time from startDate if non-midnight)
      actualPaymentDate = null
      paymentStatus = OUTSTANDING

  slotStart += paymentCadence days
  periodIndex++
```

**Notes:**

- Migrated payments with **old** daily `expectedPaymentDate`s still **cover** their calendar window; backfill fills **gaps** at the **new** cadence grid.
- Do not delete or rewrite migrated payment dates in v1.
- Return `placeholdersBackfilledCount` in modify response metadata.

---

## Policy dropdown display (API)

Extend `PolicyOptionDto`:

```typescript
{
  id: string
  displayText: string       // enriched per FR-020
  packageName: string
  planName?: string
  status: PolicyStatus
  policyNumber?: string | null
  startDate?: string | null
  endDate?: string | null
  deactivatedAt?: string | null
}
```

**Label rule (all policies):**

| Status | Suffix |
|--------|--------|
| ACTIVE, PENDING_ACTIVATION, SUSPENDED | `({STATUS}, from {DD Mon})` if startDate; else `({STATUS})` |
| DEACTIVATED, TERMINATED | `({STATUS}, ended {DD Mon})` using endDate ?? deactivatedAt |

---

## Payments list (unfiltered)

Extend payment list DTO with:

```typescript
{
  // ... existing payment fields ...
  policy: {
    id: string
    policyNumber: string | null
    status: PolicyStatus
    displayText: string  // short: "{policyNumber ?? '—'} · {status}"
  }
}
```

Only include `policy` object when `policyId` filter is **omitted** (all-policies view).

---

## Pricing authority

| Source | Used for |
|--------|----------|
| `insurance-pricing.json` | Daily/weekly installment calculation in modify dialog |
| `package_plans` table | Plan **identity** (`id`, `name`) — map JSON plan name → `packagePlanId` |
| `packages.totalPremium` | Display “total premium” on Products tab — **not** installment rates |
| `policies.premium` | Stored installment amount used by premium math |

---

## TERMINATED registration gate

On `createCustomer` (and id/phone update if applicable):

```sql
EXISTS customer WHERE status = 'TERMINATED'
  AND (idNumber = :idNumber OR phoneNumber = :normalizedPhone)
```

→ `ValidationException` with field-specific errors.

---

## Member cards (API only in v1)

`getMemberCards` already loops all policies. Expose `policy.status` on `MemberCardsByPolicyItemDto` for future inactive UI. No card suppression for DEACTIVATED in v1.

---

## Migration checklist

1. Add enum values (`DEACTIVATED`, `OUTSTANDING`)
2. Add columns: `Policy.deactivatedAt`, `supersedesPolicyId`, `supersededByPolicyId`; `Customer.deactivatedAt`
3. Create `entity_status_changes` table
4. Drop `policies_customerId_packageId_key`; create partial unique index
5. Seed/backfill not required for new enums (no existing DEACTIVATED rows)
