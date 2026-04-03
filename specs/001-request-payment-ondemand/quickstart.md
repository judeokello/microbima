# Quickstart: On-Demand Payment Request (Dev)

## Prerequisites

- PostgreSQL with migrations applied (`apps/api`)
- Env for M-Pesa STK (or disabled flag off for real calls)
- `apps/agent-registration` pointed at internal API (`NEXT_PUBLIC_INTERNAL_API_BASE_URL`)
- Staff user with access to **admin customer** routes and **customer detail**

## Flow to exercise

1. Open **Admin** customer detail: `/admin/customer/{customerId}` (or equivalent customer route with **Payments** tab).
2. Select **Package - Plan** and run filter so the payments table loads.
3. Confirm **prepaid** shows **Request payment**; **postpaid** shows disabled + pill on policy summary.
4. Open modal: test installments vs custom; phone `0712345678` style.
5. Submit: browser should receive **wsToken** + **stkPushRequestId**; open Socket.IO to **`{API_ORIGIN}/payment-status`** with auth token; subscribe `subscribe-payment`.
6. Complete or cancel on handset; verify table refreshes like **onboarding** parity.
7. **Empty policies list**: confirm **contact administrator** message (FR-021).
8. **Missing premium**: open dialog → Sentry warning in dev (or mock).

## Tests to add (suggested)

- API: orchestration endpoint — postpaid 422; amount bounds; happy path creates placeholder + STK row (mock Daraja).
- Optional: WS subscribe unauthorized token mismatch (existing gateway tests pattern).

## Lint

After TS/JS edits: `pnpm lint` from repo root.
