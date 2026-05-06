# Quickstart: Customer Self-Service Portal

**Feature**: `001-customer-self-service`  
**Ordered work**: [tasks.md](./tasks.md) (implement through **T045** for smoke; **T046** + [checklists/qa-implementation.md](./checklists/qa-implementation.md) before release sign-off).

## Prerequisites

- Monorepo deps installed (`pnpm install`)
- PostgreSQL + migrations applied (`apps/api` — **no** `db push` on tracked DBs; use Prisma migrate per constitution)
- Supabase project with **Admin** API key for the API app; configure the project so **four-digit chosen PINs** are allowed after first-time setup (constitution v1.1.0 — customer portal uses **Supabase Auth**)
- Env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, public anon key for `apps/agent-registration`, and a **portal base URL** for message links (e.g. `NEXT_PUBLIC_PORTAL_ORIGIN` on Next and/or `PORTAL_PUBLIC_URL` on the API — see **T001** env templates when added)

## Implement + run locally

1. **Migrate**: Add `Customer.portalPinSetupCompletedAt`; seed `system_settings` for **FR-016** support numbers.  
2. **API**: Customer creation → OTP → Supabase **`createUser`** with `id: customer.id` → enqueue `customer_created` with placeholders (**T009**). **Idempotent / safe replay** for provisioning failures (**T010**, **FR-005**).  
3. **API**: PIN completion + login **context** (`GET`, uniform **200** body for unknown `customerId`, no enumeration) + portal status; customer-scoped reads behind Supabase JWT guard (**T016–T018**, **T033**). Mask pattern for deep-link phone: **`07•••••` + last 4 digits** ([DESIGN.md §7](./design/maishapoa_heritage/DESIGN.md#phone-masking-customer-portal)).  
4. **Agent-registration**: App Router under **`apps/agent-registration/src/app/self/customer/`** — Heritage [layout](./design/maishapoa_heritage/DESIGN.md), generic login, deep-link login, PIN setup, products list/detail per [design/](./design/).  
5. **Lint**: `pnpm lint` at repo root after TS/JS changes.

## Manual smoke test

Use this as a **fast path** after local bring-up; for evidence against **SC-002–SC-006**, run the full **[qa-implementation.md](./checklists/qa-implementation.md)** checklist (**T046**).

1. Create a test customer via the existing API/partner flow.  
2. Confirm **one** primary welcome (SMS or dev log/outbox) includes **OTP** + personal `/self/customer/:customerId` link + **both** support numbers (**FR-005a**).  
3. Open **`/self/customer`**, sign in with **`07…`** phone + **OTP** in the **PIN** field.  
4. Complete **4-digit PIN** setup (with confirmation); then **`refreshSession`** (or equivalent) so status reflects completion.  
5. Confirm **follow-up** notification (personal link, **no** OTP in copy) and that **OTP** no longer signs in; **chosen PIN** works.  
6. Open **`/self/customer/:customerId/products/...`** (after list/redirect behaviour exists) and verify tabs; tamper **`customerId` / `productId`** → session rules and generic `/self/customer` without a bad return URL (**FR-011** / **FR-012**).

**Out of scope for this iteration** (do not expect product behaviour): OTP **expiry**, attempt **limits**, OTP **resend**; dedicated **retry/monitoring** for failed follow-up SMS. See [spec.md](./spec.md) clarifications (Session 2026-04-04).

## Design references

- Guidelines: [design/maishapoa_heritage/DESIGN.md](./design/maishapoa_heritage/DESIGN.md)  
- Screens: `design/*/screen.png` and `code.html` for visual parity only (implement in React, not raw HTML paste)

## Related

- [spec.md](./spec.md) — requirements and success criteria  
- [contracts/openapi.yaml](./contracts/openapi.yaml) — draft internal routes (finalise after Nest paths exist, **T043**)  
- [plan.md](./plan.md) — architecture and constitution check
