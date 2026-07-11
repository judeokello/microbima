# Quickstart: Policy Lifecycle & Status Rules

**Feature**: `003-policy-lifecycle`  
**Depends on**: `002-modify-product-policy` foundation applied

## Prerequisites

```bash
cd apps/api
npx prisma migrate dev --name policy_payment_lifecycle
# apply messaging template seed additions (idempotent)
psql "$DATABASE_URL" -f prisma/seed-messaging.sql   # or project seed script
```

- Admin user with `registration_admin`
- UTC clock for day-boundary tests

## New / changed API

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/internal/customers/:customerId/policies/:policyId/terminate` | Admin terminate (mandatory reason) |
| `POST` | `/internal/customers/:customerId/policies/:policyId/activate` | Existing; **422** if `endDate` passed |
| `POST` | `/internal/policies/lifecycle/run-daily` | Manual daily evaluation |

See [contracts/openapi.yaml](./contracts/openapi.yaml).

## Manual test flows

### 1. Grace → Suspend → Inactive (before end)

1. Active prepaid policy with known cadence; ensure unpaid expected due is in the past.
2. `POST .../lifecycle/run-daily` with overdue 1–7 days → `inGracePeriod=true`, status still `ACTIVE`.
3. Advance overdue &gt;14 days → run daily → `SUSPENDED`, grace cleared.
4. Set `suspendedAt` &gt;30 days ago, end date still future → run daily → `INACTIVE`.

### 2. Term end rules

1. Active policy with `endDate` yesterday → daily → `EXPIRED`.
2. Suspended policy with `endDate` yesterday → daily → still `SUSPENDED`.
3. Inactive policy with `endDate` yesterday → daily → `EXPIRED`.
4. Attempt Activate on Suspended past end → **422**.

### 3. Post–end-date payment

1. Suspended past end with arrears A; pay `A` → debt reduced; status still Suspended; not Active.
2. Pay `A + surplus` → new Active policy (new number, same pay acct / member numbers); old remains Suspended; supersession linked.

### 4. Expiry renewal

1. Expired policy; payment within 30 days of end → new policy start = day after old end.
2. Payment after 30 days → new start = payment date.

### 5. Admin Terminate

1. Admin → Customer → Products → ⋮ → **Terminate** (same menu as Reset Start Date).
2. Mandatory description → selected policy `TERMINATED`.
3. Second open policy remains; customer not Terminated until last open policy closed.

### 6. Notifications

1. Confirm schedule keys not double-queued on second `run-daily` same UTC day.
2. SMS/outbox rows for grace/suspend/renewal templates present when messaging enabled.

## Unit tests (examples)

```bash
cd apps/api
npx jest src/utils/__tests__/policy-due-date.util.spec.ts
npx jest src/services/__tests__/policy-lifecycle*.spec.ts
```

## Lint

```bash
cd ~/Projects/microbima && pnpm lint
```
