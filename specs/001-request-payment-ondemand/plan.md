# Implementation Plan: On-Demand Payment Request (Post Onboarding)

**Branch**: `001-request-payment-ondemand` | **Date**: 2026-04-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-request-payment-ondemand/spec.md`.

## Summary

Add **Request payment** on the admin customer **Payments** tab in `apps/agent-registration` (`payments-tab.tsx`): after **Package - Plan** is selected and payments are loaded, **prepaid** policies open a modal (installments 1-5 times installment amount, or custom amount; phone rules FR-008). **Postpaid**: disable with explanation; show **prepaid/postpaid** pill beside **Category / plan** in policy summary (`policy-detail-view.tsx` or equivalent). Reuse **`/payment-status`** WebSocket and **wsToken** like onboarding. Backend: internal endpoint validates customer-policy, prepaid, amounts (1-70000 KES), creates **`policy_payments`** placeholder `PENDING-STK-*`, calls **`MpesaStkPushService.initiateStkPush`**. Extend **policy detail** API with scheme billing mode. Payment grid follows **existing** `getCustomerPayments` / onboarding parity (FR-011 Option C). See [research.md](./research.md) for CORS, mapping, and Sentry.

## Technical Context

**Language/Version**: TypeScript 5.3.x, Node.js 18+

**Primary Dependencies**: NestJS 11, Prisma 6, Next.js (agent-registration), Socket.IO, Sentry

**Storage**: PostgreSQL (policies, policy_payments, mpesa_stk_push_requests, scheme.isPostpaid)

**Testing**: API Jest; repo lint via pnpm

**Target Platform**: API on Fly.io; browser admin (agent-registration)

**Project Type**: Turbo monorepo: `apps/api`, `apps/agent-registration`

**Performance Goals**: Match spec SC (e.g. status feedback within seconds of events)

**Constraints**: UTC dates; Prisma migrations only; errors use `status` and `ValidationException`; STK amount 1-70000 per existing DTO

**Scale/Scope**: Per-customer admin actions; reuse STK jobs

## Constitution Check

Gates: API-first (pass); migrations not db push (pass); error standards (pass); Sentry (pass); RBAC (pass); WS JWT scoped (pass).

Re-check after design: resolve `PaymentStatusGateway` CORS if admin origin differs from `AGENT_REGISTRATION_URL` ([research.md](./research.md) R1).

## Project Structure

### Documentation (this feature)

```text
specs/001-request-payment-ondemand/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/openapi.yaml
├── spec.md
└── checklists/requirements.md
```

### Source code

```text
apps/api/src/
  controllers/internal/customer.controller.ts
  services/customer.service.ts
  services/mpesa-stk-push.service.ts
  gateways/payment-status.gateway.ts
  dto/customers/

apps/agent-registration/src/
  app/(main)/customer/[customerId]/_components/payments-tab.tsx
  app/(main)/customer/[customerId]/_components/policy-detail-view.tsx
  hooks/usePaymentStatus.ts
  lib/api.ts
```

**Structure Decision**: Implement in `apps/api` and `apps/agent-registration` only for this feature.

## Complexity Tracking

No constitution violations table required.

## Phase 0 and Phase 1 outputs

| Artifact | Path |
|----------|------|
| Research | [research.md](./research.md) |
| Data model | [data-model.md](./data-model.md) |
| Contracts | [contracts/openapi.yaml](./contracts/openapi.yaml) |
| Quickstart | [quickstart.md](./quickstart.md) |

## Suggested next command

`/speckit.tasks`
