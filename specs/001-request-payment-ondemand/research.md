# Research: On-Demand Payment Request

Consolidates design decisions for `/speckit.plan`. All prior **NEEDS CLARIFICATION** items from an initial technical sketch are resolved below.

---

## R1 — WebSocket CORS for admin UI

**Decision**: Ensure **`PaymentStatusGateway`** CORS `origin` callback allows the **same browser origin(s)** used to load the admin customer UI (typically **`AGENT_REGISTRATION_URL`** / `NEXT_PUBLIC_*`). If production admin is served from a **different host** than agent registration, add **explicit env** (e.g. `PAYMENT_STATUS_WS_ALLOWED_ORIGINS` comma-separated) or reuse a shared “allowed frontends” config — **do not** hardcode only one URL without verifying deployment.

**Rationale**: Gateway currently keys off `AGENT_REGISTRATION_URL` in non-dev; mismatch blocks Socket.IO handshake for staff.

**Alternatives considered**: Wildcard origins in production (rejected — security); duplicate gateway namespace (rejected — unnecessary).

---

## R2 — Orchestration: dedicated endpoint vs client-only `initiateStkPush`

**Decision**: Add **`POST /internal/customers/{customerId}/policies/{policyId}/ondemand-stk`** (name final in tasks) that:

1. Authorizes via **`canUserAccessCustomer`**.
2. Loads policy + **package scheme** → rejects if **`scheme.isPostpaid`** (or equivalent).
3. Validates body: mode `INSTALLMENTS` | `CUSTOM`; installments 1–5; amount / derived amount within **1–70,000**; phone rules per FR-008 (server-side mirror).
4. Creates **`policy_payments`** row: `PENDING-STK-*`, `PENDING_STK_CALLBACK`, `MPESA`, expected date **UTC now**, `accountNumber` per existing placeholder convention (see `policy.service` / onboarding).
5. Calls **`MpesaStkPushService.initiateStkPush`** with `accountReference = policy.paymentAcNumber`, normalized **254…** phone.
6. Returns **`StkPushRequestResponseDto`**-shaped payload (`id`, `wsToken`, `checkoutRequestID`, …).

**Rationale**: Client-only STK bypasses **policy–customer binding** and **postpaid** checks; placeholder creation must stay **atomic** with business validation.

**Alternatives considered**: Only reuse public `POST internal/mpesa/stk-push/initiate` from UI (rejected — duplicates validation, leaks logic to client).

---

## R3 — Placeholder `policy_payments` timing

**Decision**: Follow **onboarding** pattern: **persist placeholder** with `transactionReference` **`PENDING-STK-…`** **before** successful Daraja initiation where possible; if Daraja fails after DB write, **mark for cleanup** or leave row with failed STK (align with existing error handling patterns in `MpesaStkPushService`). Exact transaction order (placeholder first vs after `mpesa_stk_push_requests` row) should match existing tests and callback expectations — **callback** matches placeholder by **`policyId` + PENDING-STK prefix**.

**Rationale**: `mpesa-stk-push.service` and `mpesa-ipn.service` already **upgrade** placeholder rows on success.

**Alternatives considered**: No placeholder until callback (rejected — breaks parity with onboarding and FR-011 row visibility).

---

## R4 — FR-019 UI labels vs storage enums

**Decision**: Keep **DB** enums as today: **`MpesaStkPushStatus`** (`PENDING`, `COMPLETED`, `FAILED`, `CANCELLED`, `EXPIRED`), **`PaymentStatus`** on `policy_payments`. Map to **spec** vocabulary via a **single shared helper** in the agent-registration app:

- File: `apps/agent-registration/src/lib/payment-status-vocabulary.ts` — `mapStkGatewayStatusToSpecVocabulary()`
- Onboarding payment page consumes this helper for in-page status display; on-demand flow and notifications MUST use the same function for FR-019 / FR-023 alignment.

| Spec (FR-019) | `mapStkGateway…` mapping from gateway |
|---------------|--------------------------------------|
| processing | STK `PENDING` (in flight; matches onboarding treatment) |
| success | `COMPLETED` |
| failed | `FAILED` |
| cancelled | `CANCELLED` |
| timeout | `EXPIRED` |
| pending | unknown / default |

**Rationale**: FR-023 requires **same progression semantics as onboarding**; one module avoids drift between flows.

**Alternatives considered**: New DB enum for FR-019 only (rejected — redundant).

---

## R5 — Payment list API completeness (FR-011 Option C)

**Decision**: Audit **`getCustomerPayments`** response vs onboarding listing. If onboarding or payment detail pages expose **`paymentStatus`** or STK linkage, add fields to **`PaymentDto`** / **`Payment`** (typescript) **without** changing sorting contract unless required. If current grid is sufficient, **no** migration — only document mapping.

**Rationale**: Clarification **C** requires **parity**, not new business rules.

**Alternatives considered**: New parallel “ondemand payments” endpoint (rejected unless audit proves gap).

---

## R6 — Sentry warning payload (FR-022)

**Decision**: `Sentry.captureMessage` **warning** level (or `captureException` with severity) including:

- `feature: ondemand_payment_request`
- `reason: missing_policy_premium` (client) / `zero_premium_prepaid_policy_detail_fetch` (server on `getCustomerPolicyDetail` when prepaid and `premium === 0`)
- `customerId`, `policyId`, `packageId`, `correlationId`

Fire on **policy detail fetch** (server), **dialog open** and **submit** (client) with optional **dedupe key** `{customerId,policyId,sessionId}` in implementation.

**Rationale**: Constitution VIII + explicit spec.

**Alternatives considered**: Log-only (rejected — spec requires Sentry).

---

## R7 — Empty `policies` list (FR-021)

**Decision**: When `GET …/policies` returns **empty** for a customer who **should** be prepaid-contacts, show **static copy**: contact administrator to recover policy. No API change required beyond maybe **200 + []** already.

**Rationale**: Spec scope.

**Alternatives considered**: Infer prepaid without policies (rejected ambiguous).
