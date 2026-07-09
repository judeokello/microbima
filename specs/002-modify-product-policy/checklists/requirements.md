# Requirements Checklist: Modify Product & Policy Lifecycle

**Feature**: `002-modify-product-policy`  
**Date**: 2026-07-09

Use this checklist during spec review and before marking the feature complete.

## Scope

- [ ] Modify Product in scope; Add Product explicitly out of scope
- [ ] Admin-only lifecycle actions on admin Customer Detail → Products
- [ ] Agent customer page has read-only Products tab only

## Schema

- [ ] `DEACTIVATED` on PolicyStatus and CustomerStatus
- [ ] `PaymentStatus.OUTSTANDING` for backfilled installments
- [ ] `EntityStatusChange` table is source of truth for reasons
- [ ] `Policy.deactivatedAt`, `Customer.deactivatedAt` denormalized
- [ ] `supersedesPolicyId` / `supersededByPolicyId` on Policy
- [ ] Partial unique index on `(customerId, packageId)` for non-terminal statuses only

## Modify product

- [ ] Dialog mirrors onboarding payment form; pricing from `insurance-pricing.json`
- [ ] Family category read-only from dependants
- [ ] May change plan, scheme, frequency, cadence
- [ ] Same `packageId` required; deactivate old before create new
- [ ] Payment migration: first selected + subsequent; source policy only
- [ ] Postpaid linked payments: migration blocked; PENDING_ACTIVATION plan/scheme-only allowed
- [ ] `paymentAcNumber` reused (transferred in transaction)
- [ ] Policy number: required Keep Existing / Generate New
- [ ] No STK on modify
- [ ] Installment placeholder backfill runs after modify
- [ ] SUSPENDED source: modify blocked until activated
- [ ] DEACTIVATED / TERMINATED source: modify blocked

## Deactivate / Activate / Reset

- [ ] Deactivate: mandatory reason; ACTIVE, SUSPENDED, PENDING_ACTIVATION
- [ ] Customer coupling: ACTIVE only counts; PENDING_ACTIVATION fallback; else DEACTIVATED
- [ ] Activate: SUSPENDED→ACTIVE only; mandatory reason
- [ ] Reset start date: ACTIVE or SUSPENDED; mandatory reason; payments not moved

## TERMINATED

- [ ] No lifecycle actions on TERMINATED customer/policy
- [ ] Registration gate on idNumber and phoneNumber

## Payments UX

- [ ] Enriched dropdown labels for **all** policies (not only modified pairs)
- [ ] Unfiltered payments: Policy column (number + status)
- [ ] Auto-select new policy after modify
- [ ] Payments on deactivated policy remain visible when filtered to that policy

## Premium math

- [ ] Expected uses new premium + cadence + startDate
- [ ] Paid sums migrated amounts (historical values)
- [ ] After backfill, missed count aligns with missed amount for modify scenarios

## Audit

- [ ] Every manual action writes `EntityStatusChange`
- [ ] Modify metadata includes cadence/plan/scheme deltas
- [ ] Future PAYMENT_LIFECYCLE auto-suspend spec documented

## API & standards

- [ ] Admin RBAC on all lifecycle endpoints
- [ ] UTC date handling
- [ ] ValidationException + ErrorCodes
- [ ] Prisma migration (not db push)
- [ ] Unit tests for coupling + backfill

## Deferred (documented, not blocking)

- [ ] Member card red inactive label UI
- [ ] Portal TERMINATED access gate
- [ ] Messaging for deactivated customers
- [ ] Status history admin UI
