# Implementation Plan: Modify Product & Policy Lifecycle

**Branch**: `002-modify-product-policy` | **Date**: 2026-07-09 | **Spec**: [spec.md](./spec.md)

## Summary

Admin-only policy lifecycle on Customer Detail → Products: **Modify product** (deactivate + create new same package, optional payment migration, installment backfill), **Deactivate**, **Activate** (SUSPENDED→ACTIVE), **Reset start date**. Schema adds `DEACTIVATED`, `EntityStatusChange` audit, policy supersession, partial unique index, `PaymentStatus.OUTSTANDING`. Payments UX: enriched policy labels for **all** policies, Policy column on unfiltered payments, auto-select new policy after modify. TERMINATED registration gate. Agent gets read-only Products tab.

## Technical Context

**Stack**: NestJS 11, Prisma 6, Next.js (agent-registration), PostgreSQL

**Key files today**:

- Products tab: `apps/agent-registration/.../products-tab.tsx`
- Payments tab: `apps/agent-registration/.../payments-tab.tsx`
- Onboarding payment UI: `apps/agent-registration/.../register/payment/page.tsx`
- Policy create/activate: `apps/api/src/services/policy.service.ts`
- Premium math: `apps/api/src/utils/premium-statement-math.ts`
- Customer policies API: `apps/api/src/services/customer.service.ts`

## Constitution Check

| Gate | Status |
|------|--------|
| Prisma migrations (no db push) | Required |
| UTC dates | Required |
| ValidationException + ErrorCodes | Required |
| Admin RBAC on lifecycle endpoints | Required |
| Sentry on unexpected failures | Required |

## Implementation Phases

### Phase 1 — Schema & core services (API)

1. Migration: enums, `EntityStatusChange`, Policy/Customer fields, partial unique index, `OUTSTANDING` payment status.
2. `EntityStatusChangeService` — write records, optional list by customer.
3. `PolicyLifecycleService` (or extend `PolicyService`):
   - `deactivatePolicy`
   - `activatePolicy` (SUSPENDED only)
   - `resetPolicyStartDate`
   - `modifyPolicy` (orchestrates transaction)
   - `backfillMissedInstallmentPlaceholders`
   - `resolveCustomerStatusAfterPolicyChange`
4. TERMINATED gate in `CustomerService.createCustomer`.
5. Internal controller routes + DTOs + Swagger.

**Tests**: unit tests for coupling rules, backfill algorithm, partial unique constraint behavior.

### Phase 2 — Modify options & payment migration

1. `GET modify-options`: plans (JSON pricing + DB plan ids), schemes for package, completed payments list for picker.
2. Postpaid migration guard (`postpaidSchemePaymentItem` check).
3. `paymentAcNumber` transfer logic.
4. Policy number keep vs generate.

### Phase 3 — Admin UI

1. Extract shared **ProductPaymentForm** from `register/payment/page.tsx` (plan, frequency, scheme, read-only category).
2. `ModifyProductDialog` — payment picker, policy number choice, reason.
3. `DeactivatePolicyDialog`, `ActivatePolicyDialog`, `ResetStartDateDialog`.
4. Products tab row menu (admin `basePath` only) + `isAdmin` guard.
5. Post-modify: refresh products/payments; pass `selectedPolicyId` to Payments tab (query param or shared state).

### Phase 4 — Payments UX

1. Enrich `getCustomerPolicies` `displayText` for **all** policies (FR-020).
2. Extend `getCustomerPayments` with policy sub-object when unfiltered; add Policy column in `payments-tab.tsx`.
3. Auto-select new policy after modify.

### Phase 5 — Agent Products tab

1. Add Products tab to `apps/agent-registration/.../customer/[customerId]/page.tsx` (read-only `ProductsTab`).

### Phase 6 — Member cards API (minimal)

1. Add `status` to `MemberCardsByPolicyItemDto` for future inactive label.

## Shared component strategy

```
register/payment/page.tsx
  └── uses ProductPaymentForm (extracted)

admin/modify-product-dialog.tsx
  └── uses ProductPaymentForm + payment picker + policy number + reason
```

Family category: compute from dependant counts using same logic as onboarding (`member_only`, `up_to_5`, `up_to_8`).

## Risk & mitigations

| Risk | Mitigation |
|------|------------|
| Partial unique index + Prisma | Raw SQL in migration; document in schema comments |
| `paymentAcNumber` unique transfer | Null out old in same tx before insert new |
| Backfill + migrated payment date mismatch | Window-based “covered” check (data-model algorithm) |
| Dropdown label clutter | Consistent format; dates only when available |

## Out of scope (this branch)

- Add Product
- Auto-SUSPEND lifecycle job
- Member card red inactive text
- Portal TERMINATED gate (spec FR-040 — separate PR if not exists)
- Status history admin UI page (API optional)

## Verification

- [ ] Modify with cadence change: `missedPayments` count > 0 when financially behind
- [ ] Both policies in dropdown with distinct labels
- [ ] Unfiltered payments show Policy column
- [ ] TERMINATED id/phone blocked on create
- [ ] Agent Products tab read-only
- [ ] `pnpm lint` clean
