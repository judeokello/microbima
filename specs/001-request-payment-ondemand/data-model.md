# Data Model: On-Demand Payment Request

## Existing tables (relevant)

### `policies`

- **id** (UUID): policy primary key
- **customerId**, **packageId**, **packagePlanId**: scope
- **premium** (Decimal): installment amount for FR-005
- **paymentAcNumber**: BillRefNumber for STK **`accountReference`**
- **status**: `PolicyStatus`
- Relation: **`policyPayments`** → `policy_payments`

### `policy_payments`

- **id**, **policyId**, **paymentType** (`MPESA`), **transactionReference** (unique; placeholder `PENDING-STK-*`)
- **amount**, **accountNumber**, **expectedPaymentDate**, **actualPaymentDate**
- **paymentStatus**: `PENDING_STK_CALLBACK` | `COMPLETED_PENDING_RECEIPT` | `COMPLETED`
- **paymentMessageBlob**: JSON audit

### `mpesa_stk_push_requests`

- **id** (UUID): correlates with WS **`sub`** / **`stkPushRequestId`**
- **status**: `PENDING` | `COMPLETED` | `FAILED` | `CANCELLED` | `EXPIRED`
- **phoneNumber**, **amount**, **accountReference**, **checkoutRequestId**, etc.

### Scheme billing (via `package_scheme_customer` + `scheme`)

- **`scheme.isPostpaid`**: drives FR-018 / FR-020 (prepaid vs postpaid)

## API view-model extensions (no new DB tables required for MVP)

### `CustomerPolicyDetail` (response augmentation)

| Field | Type | Notes |
|-------|------|-------|
| `schemeBillingMode` | `prepaid` \| `postpaid` | Derived from linked scheme `isPostpaid` |
| Optional: `canRequestOndemandStk` | boolean | Server-side: prepaid and policy active context |

### `Payment` (list row augmentation — if audit shows parity gap)

| Field | Type | Notes |
|-------|------|-------|
| `paymentStatus` | string enum | Mirror Prisma `PaymentStatus` for display |
| Optional: `stkPushRequestId` | string? | If exposed for debugging or status |

## Validation rules (server)

- **customerId** + **policyId**: policy must belong to customer; user must pass **`canUserAccessCustomer`**
- **Postpaid**: reject with clear error or UI-only disable + **409** / **422** per ErrorCodes convention
- **Phone**: normalize to `254…`; accept UI `01` / `07` ten digits; max length 10 on raw input
- **Amount**:
  - **Installments**: `count` in 1..5; `derived = count * policy.premium`; must satisfy 1..70000
  - **Custom**: **Min 1**, **Max 70000** (Daraja); integer vs decimal per existing STK DTO
- **Placeholder**: unique `transactionReference` per rules (`PENDING-STK-…`); **UTC** `expectedPaymentDate`

## State transitions (logical)

1. Staff submit → **placeholder** `policy_payments` (`PENDING_STK_CALLBACK`) + **STK** row `PENDING` (ordering per implementation; see research R3)
2. Callback / IPN / query → update **`mpesa_stk_push_requests`** and **placeholder** per existing services
3. Terminal → **`PaymentStatus`** `COMPLETED` or failure paths; WS emits **COMPLETED** / **FAILED** / **CANCELLED** / **EXPIRED**
4. UI maps STK + policy payment state to **FR-019** vocabulary (shared with onboarding)

## Observability

- **FR-022**: Sentry warning when **prepaid** and **`premium` empty/missing/zero**: **server** on `getCustomerPolicyDetail` fetch; **client** on dialog open and submit; tags in [research.md](./research.md) R6.
