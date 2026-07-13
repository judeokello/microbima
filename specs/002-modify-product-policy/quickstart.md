# Quickstart: Modify Product & Policy Lifecycle

**Feature**: `002-modify-product-policy`

## Prerequisites

- Apply migration: `cd apps/api && npx prisma migrate deploy` (or `migrate dev` locally)
- Admin user with `registration_admin` role

## API endpoints

| Method | Path |
|--------|------|
| `POST` | `/internal/customers/:customerId/policies/:policyId/deactivate` |
| `POST` | `/internal/customers/:customerId/policies/:policyId/activate` |
| `POST` | `/internal/customers/:customerId/policies/:policyId/reset-start-date` |
| `GET` | `/internal/customers/:customerId/policies/:policyId/modify-options` |
| `POST` | `/internal/customers/:customerId/policies/:policyId/modify` |

All require Supabase bearer token and admin role.

## Manual test flow

1. Open **Admin → Customer → Products** tab.
2. Row menu (⋮): **Modify product** on an ACTIVE prepaid policy with payments.
3. Select plan, frequency, policy number option, first payment, reason → submit.
4. Confirm old policy **DEACTIVATED**, new policy **ACTIVE**, payments split correctly.
5. Open **Payments** tab — new policy should be pre-selected in dropdown (from session storage after modify).
6. Select **All policies** → Filter → confirm **Policy** column shows number + status.
7. Test **Deactivate**, **Activate** (suspended), **Reset start date**.

## TERMINATED gate

Create customer with same `idNumber` or `phoneNumber` as a TERMINATED customer → expect validation error.

## Tests

```bash
cd apps/api && npx jest src/utils/__tests__/installment-backfill.util.spec.ts
```
