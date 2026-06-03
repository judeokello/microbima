# Implementation Plan: Customer Self-Service Portal (`/self/customer`)

**Branch**: `001-customer-self-service` (suggested) | **Date**: 2026-04-04 | **Spec**: [spec.md](./spec.md)

## Summary

Add a **customer-only** self-service area in `apps/agent-registration` under `/self/customer`, backed by **Supabase Auth** with `user_metadata.roles` including `customer`. Use **`customers.id` as `auth.users.id`** and synthetic email `{nationalPhone}@maishapoa.customer`. On **customer creation** (existing flow that enqueues welcome messaging), **create the Auth user** after the customer row exists; on failure, **retry/compensate**. First-time users sign in with **ID number** as password until they set a **4-digit PIN**; `InitialPasswordReset` in `user_metadata` gates the PIN screen; server updates metadata + password; client **refreshes session**. Deep links `/self/customer/:customerId` show phone + name and reduce fields appropriately. **Reuse** existing customer detail tab components and APIs where possible; add **minimal** customer-scoped API surface only if internal partner-scoped endpoints cannot be used safely. **Align** payments package-plan dropdown: **auto-select** when only one plan (agent + self-service). Extend **welcome SMS** template and **system_settings** for support numbers. Provide a **backfill script** for legacy customers (Auth user + metadata). Enforce **URL/session consistency** with logout + redirect to `/self/customer` and **no return URL** on tampering.

## Technical Context

**Language/Version**: TypeScript (monorepo standards)  
**Primary Dependencies**: Next.js (agent-registration), NestJS API, Prisma, Supabase JS + Admin patterns  
**Storage**: PostgreSQL; Supabase Auth (`auth.users`)  
**Testing**: Jest (API); existing frontend patterns  
**Target Platform**: Browser (self-service); existing deployment targets  
**Constraints**: UTC for server dates; standardized errors for new API routes; `pnpm lint` after TS/JS changes; avoid `db push` for tracked DBs  
**Scale/Scope**: All customers over time; interim web portal ahead of dedicated customer apps

## Constitution Check *(align with MicroBima rules)*

- **API-first / reuse**: Prefer reuse of read models and internal endpoints via a thin **customer JWT** or BFF pattern; avoid sprawling changes to partner-key APIs document per decision log when adding customer-specific routes.
- **Database standards**: Migrations for `system_settings` keys/seeds; no schema column for `supabaseUserId` (identity = UUID match).
- **Error handling**: New endpoints use `status` (not `statusCode`), `ValidationException` / `ErrorCodes` as appropriate, correlation IDs.
- **Security**: Never trust `customerId`/`productId` from URL without server-side binding to session principal (`auth.uid()` / API lookup).
- **Timezone**: UTC on server; display formatting per UI conventions.

## Architecture Overview

### Auth model

| Concern | Decision |
|--------|----------|
| Auth user id | Same UUID as `customers.id` |
| Sign-in | `signInWithPassword({ email: syntheticEmail, password })` |
| Synthetic email | `{canonicalNationalPhone}@maishapoa.customer` |
| Roles | `user_metadata.roles = ['customer']` |
| First-time flag | `user_metadata.InitialPasswordReset` boolean |
| After PIN set | Server: `updateUser` password + metadata; Client: `refreshSession()` |

### Route graph (app router)

- `/self/customer` — generic login  
- `/self/customer/:customerId` — contextual login / landing after auth  
- `/self/customer/:customerId/products` — list; redirect if count === 1  
- `/self/customer/:customerId/products/:productId` — tabbed detail (mirror agent)

### Middleware / guards

- Layout or middleware: if path starts with `/self/customer`, require session with `customer` role; redirect unauthenticated users to appropriate login route (generic vs contextual).
- On data load: if API returns forbidden/not-found for `customerId`–`productId` binding, **clear session** (if policy requires) and redirect per spec.

### API strategy

1. **Inventory** existing internal customer/detail/payments/member-card endpoints and auth (API key vs Bearer).  
2. **Prefer**: session (Supabase JWT) forwarded to Nest with validation + mapping `sub` → `customer.id` for authorization.  
3. **Add** narrow endpoints only when reuse would require partner context leakage or unsafe shortcuts.  
4. Document each new route in OpenAPI/Swagger per project norms.

### Messaging

- Update template `customer_created` (or pipeline) placeholders: link, `medical_support_number`, `general_support_number`.  
- Resolver reads `system_settings` by key; values stored without braces.  
- Migration/seed: keys `medical_support_number` = `0113569606`, `general_support_number` = `0746907934` (confirm exact key names with existing `system_settings` conventions).

## Phase 0 – Discovery

- [ ] Map current `dashboard/customer/[customerId]` and product route structure to self-service URLs.  
- [ ] List APIs used by Customer Details, Products, Payments, Member cards tabs.  
- [ ] Confirm placeholder mechanism for SMS/email templates and `system_settings` access in API.  
- [ ] Confirm Supabase password policy for PIN (4-digit) and migration window for ID-as-initial-password.

## Phase 1 – Backend

- [ ] Customer creation: after successful DB insert, invoke Supabase Admin `createUser` with `id: customer.id`, synthetic email, initial password from `idNumber`, `user_metadata: { roles: ['customer'], InitialPasswordReset: false, ... }`. Error handling + retry/logging.  
- [ ] Endpoint(s) for PIN setup: validate session, enforce 4-digit PIN, update Auth password + `InitialPasswordReset: true` (server only).  
- [ ] Customer-scoped data endpoints OR adapter on existing services: verify `auth.uid() === customerId` for reads.  
- [ ] `system_settings` migration + seed for support numbers; template text updates + new placeholders.  
- [ ] Backfill script: list customers without Auth row (detection strategy TBD), create users, set metadata.  

## Phase 2 – Frontend (`apps/agent-registration`)

- [ ] Route tree under `app/.../self/customer/...` with isolated layout (customer branding if needed).  
- [ ] Login forms: generic vs `:customerId` variant; labels Phone number / PIN; server fetch for display context on deep link (minimal PII exposure).  
- [ ] Post-login: read `InitialPasswordReset` from session; show PIN setup flow; on success call API then `refreshSession()`.  
- [ ] Products list + redirect rule; product detail layout reusing tab components from agent customer detail.  
- [ ] Payments tab: share component or prop to auto-select single package-plan; apply to agent `payments-tab` and self-service.  
- [ ] Middleware: role `customer` only for `/self/customer`; redirect internal roles away (exact behaviour TBD — at minimum do not show self-service as default for staff).

## Phase 3 – QA & Ops

- [ ] E2E or integration checklist: login, PIN, tampered URL, single-product redirect, SMS content.  
- [ ] Runbook: Auth creation failure after customer insert; backfill execution.  
- [ ] Monitoring: log correlation IDs on new endpoints.

## Dependencies & Risks

| Risk | Mitigation |
|------|------------|
| Duplicate Auth create on retries | Idempotent create or catch “already exists” and align metadata |
| Stale JWT after metadata update | Mandatory `refreshSession()` after PIN |
| Reusing partner APIs unsafely | Customer-specific guard or small new controller |
| Enumeration via deep link | Uniform errors + rate limits on contextual login helpers if any public pre-auth API |

## Deliverables

- Working `/self/customer/**` experience meeting spec acceptance scenarios  
- Provisioning + PIN API + session refresh behaviour  
- Template + settings updates  
- Backfill script + short operations note  
- Tasks file for Speckit (`tasks.md`) generated from this plan

---

**Next step after paste**: Run Speckit task breakdown to produce `tasks.md`, `data-model.md` deltas (settings keys only), and contracts for any new endpoints.