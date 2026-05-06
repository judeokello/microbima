# Research: Customer Self-Service Portal

**Feature**: `001-customer-self-service`  
**Date**: 2026-04-06  
**Spec source of truth**: [spec.md](./spec.md) — **OTP** first sign-in (not national ID); bundled welcome; follow-up SMS with personal link.

## R1 — Initial secret: OTP vs national ID

**Decision**: **Registration OTP** is the **initial Supabase password** for the new Auth user. Member enters it in the field labeled **PIN** until they set a 4-digit PIN; **no ID number** on the portal (FR-009).

**Rationale**: Matches clarified spec and SMS-first onboarding; `signInWithPassword` continues to work with synthetic email + OTP; **replacing password** with chosen PIN automatically invalidates OTP for sign-in (FR-008, Session 2026-04-06).

**Alternatives considered**: ID as password (superseded). Separate OTP table + custom verify endpoint only — adds complexity without benefit if Supabase password = OTP until rotation.

## R2 — Source of truth for “first-time PIN replacement complete”

**Decision**: Add a **Prisma field** on `Customer`, e.g. **`portalPinSetupCompletedAt DateTime?`** (null = not completed). Update **only** in the trusted PIN-completion service after Supabase password update succeeds.

**Rationale**: Server-side messaging, audits, and Nest guards can read DB without Admin `getUserById` for every request; aligns with spec “persisted per portal user / customer-scoped record” (FR-006).

**Alternatives considered**: **`user_metadata` only** — valid for client; awkward for pure server workflows and reconciliation. **Dual write** (DB + metadata) — optional if client prefers JWT flag; DB remains authoritative.

## R3 — Supabase `user_metadata` fields (optional mirror)

**Decision**: Keep **`roles: ['customer']`**; optionally set **`InitialPasswordReset: false`** until PIN complete then **`true`**, for parity with earlier tech notes—**only if** client reads from session without extra API round-trip. **Authoritative flag**: Prisma `portalPinSetupCompletedAt`.

**Rationale**: Avoid conflicting “two sources”; spec FR-007 requires session to reflect completion—`refreshSession` after PIN API covers JWT if metadata updated.

## R4 — OTP generation and policy (defaults for implementation)

**Decision**: **Numeric OTP** (length **6** unless product prefers 4—**confirm with stakeholders**); **single use** implied by password rotation to the chosen PIN. **OTP expiry**, wrong-attempt **rate limits**, and **resend** flows are **explicitly out of scope** for this iteration per [spec.md](./spec.md) clarifications (Session 2026-04-04); do not implement TTL enforcement, lockout, or self-serve resend unless the spec is updated.

**Rationale**: Chosen PIN replaces OTP server-side; optional Supabase project settings may still apply globally but are not a feature deliverable here.

**Alternatives considered**: 4-digit OTP — possible but smaller search space; prefer **6 for SMS OTP** and **4 for chosen PIN** to distinguish UX.

## R5 — `system_settings` value shape

**Decision**: Follow **`SystemSetting`** model (`key` string, **`value` Json**). Store scalar phone as JSON string or `{ "raw": "0746907934" }` consistent with **`SystemSettingsService`** existing reads.

**Rationale**: Schema uses `Json` for `value`; seed/migration must match how `MessagingWorker` resolves keys.

**Action**: Inspect `system-settings.service.ts` + seed patterns before migration.

## R6 — Messaging template keys

**Decision**: Extend **`customer_created`** placeholders: `otp` (or `one_time_pin`), `customer_specific_weblogin` (full URL or path + base URL from env), `medical_support_number`, `general_support_number`. Add **`portal_pin_setup_complete`** (or equivalent) for post-PIN SMS—**personal** `/self/customer/:customerId` only (Session 2026-04-07).

**Rationale**: FR-015, FR-018; single bundled welcome (Session 2026-04-06).

## R7 — Customer API authentication in Nest

**Decision**: Validate **Supabase JWT** (JWKS or shared secret per project config); **`sub` = `customers.id`**; ensure `roles` includes `customer`; **no partner API key** required for these routes.

**Rationale**: Constitution API-first; keeps partner surface unchanged.

**Alternatives considered**: Next.js BFF-only — centralizes auth but duplicates business rules; **hybrid**: Next calls Nest with Bearer from session cookie/storage.

## R8 — Heritage UI vs existing shadcn

**Decision**: Implement **new layout + tokens** under `/self/customer` per DESIGN.md; **reuse tab logic/data hooks** from staff customer page where possible; **do not** merge Heritage theme into entire agent-registration app.

**Rationale**: Interim customer-only shell; limits regression risk on staff UI.

## R9 — Forgot PIN

**Decision**: **Out of scope** (spec scope boundaries) — document in runbook / support.

---

_All NEEDS CLARIFICATION items from an earlier tech note (ID-as-password) are **resolved** in favor of the feature spec + OTP model._
