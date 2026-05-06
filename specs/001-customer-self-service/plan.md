# Implementation Plan: Customer Self-Service Portal (`/self/customer`)

**Branch**: `001-customer-self-service` | **Date**: 2026-04-06 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature spec (source of truth); supporting context from `apps/api/assets/temp-user-portal-technical-decisions.md` (update for OTP—not ID—as initial secret); Google Stitch **Heritage** UI references under [design/](./design/).

## Summary

Deliver a **customer-only** area in `apps/agent-registration` under `/self/customer/**`, styled per **[design/maishapoa_heritage/DESIGN.md](./design/maishapoa_heritage/DESIGN.md)** and Stitch exports (`screen.png` + `code.html` per screen). **Auth**: Supabase; **`auth.users.id` = `customers.id`** (Admin `createUser` with explicit `id`); sign-in uses **`{07…nationalPhone}@maishapoa.customer`** + secret. **First access**: registration **OTP** is the initial Supabase password (member types it in the field labeled **PIN**); after sign-in, **force 4-digit PIN** (see **Secure Your Account** / `pin_setup_*` design) via trusted API; **invalidate OTP** by password update. **Persist** “PIN setup complete” in **application DB** (Prisma) for authoritative server logic; optional **mirror** in `user_metadata` for client UX. **Welcome SMS**: single bundled message—OTP + personal `/self/customer/:customerId` + support numbers from **`system_settings`**. **Follow-up SMS** after PIN setup: personal link only (no OTP). **Reuse** staff customer-detail tab content for self-service product routes; **narrow customer-scoped API** where partner/API-key auth is unsafe; **payments** dropdown auto-select when one plan (agent + self-service). **Security**: URL `customerId`/`productId` must match session; tampering → sign out + `/self/customer` without return URL.

## Technical Context

| Item | Detail |
|------|--------|
| **Language** | TypeScript 5.3.x |
| **Backend** | NestJS 11.x, Prisma 6.x, PostgreSQL |
| **Frontend** | Next.js (agent-registration App Router) |
| **Auth** | Supabase Auth (customer `user_metadata.roles` includes `customer`) |
| **Testing** | Jest (API); existing FE patterns |
| **Target** | Browser; interim portal until dedicated customer apps/APIs |
| **Constraints** | UTC dates; `status` in errors (not `statusCode`); migrations only (no `db push` on tracked DBs); `pnpm lint` after TS/JS changes |

## UI / Design Artifacts (implementation reference)

| Flow / screen | Design folder (Stitch) |
|---------------|------------------------|
| Generic login | `design/generic_login_heritage_with_logo/` |
| Deep-link login | `design/deep_link_login_heritage_with_logo/` |
| PIN setup (Step 2 of 2) | `design/pin_setup_heritage_with_logo/`, `design/pin_setup_screen_heritage_style/` |
| Products list | `design/products_list_heritage_with_logo/` |
| Product detail (tabs) | `design/product_detail_screen_heritage_style/`, `design/product_detail_details_heritage_with_logo/`, `design/product_detail_payments_heritage_with_logo/` |

**Guidelines**: [design/maishapoa_heritage/DESIGN.md](./design/maishapoa_heritage/DESIGN.md) — palette (primary purple, orange accents), typography (Plus Jakarta Sans + Inter), “no-line” surfaces, gradient CTAs, 4-digit PIN inputs. **Components**: Implement in React per spec (tabs, fields), not by shipping raw Stitch HTML unmodified; use HTML as visual reference only.

## Constitution Check

| Principle | Status |
|-----------|--------|
| **I. API-first** | PASS — New/extended internal endpoints for customer JWT + existing reads where safe; document in OpenAPI. |
| **II. Database** | PASS — Migrations for new columns (e.g. portal PIN flag) and `system_settings` seeds; UTC only. |
| **III. Error handling** | PASS — `ValidationException`, `ErrorCodes`, `status`, correlation IDs. |
| **IV. Code quality** | PASS — Strict TS, `??`, lint after changes. |
| **V. Workflow** | PASS — Feature branch workflow; PR review. |
| **VI. Technology** | PASS — Nest 11 / Prisma 6 / TS 5.3 per plan. |
| **VII. Security** | PASS — **Supabase Auth** for this portal is explicitly allowed under constitution v1.1.0+ for customer self-service; Authentik remains for staff/partner. Configure Supabase password policy for **four-digit chosen PIN** after OTP replacement. |
| **VIII. Monitoring** | PASS — Correlation IDs; messaging async where applicable. |

**FR-010 (staff ID updates)**: Implementation MUST **not** introduce hooks that reset portal password when national ID changes after PIN setup. **PR reviewer sign-off** confirms no such code path (or cites a follow-up change).

**Complexity**: Justified overlap (Supabase + Nest + Next) is inherent to phased customer portal; minimal net-new surface on partner-key controllers.

## Project Structure

### Documentation (this feature)

```text
specs/001-customer-self-service/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── qa-implementation.md       # Manual QA before release (SC-002–SC-006)
├── contracts/
│   └── openapi.yaml
└── design/
    ├── maishapoa_heritage/DESIGN.md
    └── …/screen.png, …/code.html
```

### Source code (expected touchpoints)

```text
apps/api/
├── prisma/
│   ├── schema.prisma                    # Customer portal fields; seed keys
│   └── migrations/
├── src/
│   ├── services/customer.service.ts     # Post-create: Auth user + OTP password + enqueue welcome
│   ├── modules/messaging/               # Templates: customer_created; new pin_complete (or equivalent)
│   └── controllers/                   # New customer-self routes + guards (Supabase JWT)

apps/agent-registration/
├── src/app/
│   └── self/customer/                   # Canonical App Router path: /self/customer/**
│       ├── layout.tsx                   # Heritage shell, logo, footer support numbers
│       └── ...
├── src/lib/supabase.ts                  # ROLES.customer, guards
└── src/middleware.ts                    # Optional: segment /self/customer
```

**Staff reference**: `apps/agent-registration/src/app/(main)/customer/[customerId]/` — patterns for tabs (`PaymentsTab`, `MemberCardsTab`, etc.).

## Architecture Overview

### Inventory (agent-registration → internal API)

- **Staff customer detail** loads data via `NEXT_PUBLIC_INTERNAL_API_BASE_URL` with **partner/JWT** patterns from `apps/agent-registration/src/lib/api.ts`.
- **Customer portal** must call **`/api/internal/customer-portal/**`** with **`Authorization: Bearer <Supabase access token>`** (no partner API key). Add `customer-portal-api` helpers (tasks T032) reusing the same origin env.

### Auth & provisioning

1. **Create customer** (existing Prisma transaction) → success → **Supabase Admin** `createUser({ id: customer.id, email: synthetic, password: initialOtp, user_metadata: { roles: ['customer'], … } })`.  
2. **initialOtp**: generated server-side; **same value** placed in welcome SMS; stored only as Auth password (or hashed in DB for audit—see research).  
3. **Synthetic email**: `normalizeNationalPhone(customer.phoneNumber)` + `@maishapoa.customer`.  
4. **First-time complete flag**: Prisma field (e.g. `portalPinSetupCompletedAt`); set only when PIN API succeeds; **refreshSession** on client after metadata/password updates if UX flags still read Supabase.

### Routes (Next.js)

- `/self/customer` — generic login  
- `/self/customer/:customerId` — deep link login (masked phone + name; server-fetched context)  
- `/self/customer/:customerId/...` — authenticated shell; mismatch → logout + generic login  
- `/self/customer/:customerId/products` — list; redirect if count === 1  
- `/self/customer/:customerId/products/:productId` — four tabs (mirror staff)

### API strategy

1. Inventory internal endpoints used by `getCustomerDetails`, payments, member cards.  
2. Add **Bearer (Supabase JWT)** validation in Nest; map `sub` → `customer.id`; reject if role not `customer` where enforced.  
3. Avoid widening partner-key controllers; add **`/internal/customer-portal/...`** (or `/v1/customer-self/...`) as needed.  
4. **PIN completion**: `POST` body `{ pin, pinConfirm }` — server validates, updates Supabase password, sets Prisma flag, enqueues follow-up SMS.

### Messaging

- Extend **`customer_created`** template + placeholders: `otp`, `customer_specific_weblogin`, `medical_support_number`, `general_support_number` (resolved from `SystemSetting`).  
- New template (e.g. **`portal_pin_setup_complete`**) with personal link + non-sensitive copy.  
- Seed keys: `medical_support_number`, `general_support_number` (JSON `value` shape per existing `SystemSettingsService`).

## Phase 0 – Research

See [research.md](./research.md) — resolves OTP/password model, first-time flag storage, template keys, OTP policy defaults.

## Phase 1 – Backend & contracts

- [ ] Prisma: portal first-PIN completion field + migration; seed `system_settings`.  
- [ ] OTP generation + Auth user create on customer create; idempotent/retry handling.  
- [ ] Messaging: template updates + new follow-up template; worker placeholder resolution.  
- [ ] Nest: customer-portal auth guard + PIN completion endpoint + scoped read endpoints.  
- [ ] OpenAPI: document new routes ([contracts/openapi.yaml](./contracts/openapi.yaml)).  
- [ ] Backfill script: customers without Auth user / incomplete setup.

## Phase 2 – Frontend

- [ ] `/self/customer` layout: Heritage design tokens; logo asset; footer legal + support lines.  
- [ ] Generic + deep-link login (Stitch reference).  
- [ ] PIN setup screen (4+4 digits, security tip, Complete Setup).  
- [ ] Session + role gate; forced PIN route before main app.  
- [ ] Products list + redirect; product detail tabs (compose existing components with customer API client).  
- [ ] `PaymentsTab`: auto-select single package-plan (shared with staff).  
- [ ] Staff login: must not land in customer shell as default (middleware or post-login redirect).

## Phase 3 – QA & ops

- [ ] Test matrix: OTP login, PIN change, stale OTP rejected, tampered URL, single-product redirect, SMS bodies.  
- [ ] Runbook: Auth create failure; message failures; backfill.

## Risks

| Risk | Mitigation |
|------|------------|
| SMS length | Shorten copy; encoding; critical payload OTP + link + numbers. |
| Stale JWT after PIN | `refreshSession()` mandatory. |
| Partner API misuse | Dedicated JWT guards; never trust URL alone. |
| Stitch vs shadcn | Implement Heritage styling in Tailwind/theme; don’t paste HTML wholesale. |

## Deliverables

- [plan.md](./plan.md) (this file)  
- [research.md](./research.md), [data-model.md](./data-model.md), [quickstart.md](./quickstart.md), [contracts/openapi.yaml](./contracts/openapi.yaml)  
- **Next**: `/speckit.tasks` → `tasks.md`
