# MicroBima Master Document

*The Complete Technical & Product Blueprint*

**Status:** Updated — Aug 27, 2025
**Docs Set:** 1) `docs/microbima_master_document.md` (this file)  •  2) `docs/microbima_blueprint_document.md` (AI IDE & Analytics Blueprint)

---

## 1. Introduction

MicroBima is a modern, API‑first micro‑insurance core designed for flexible products, fast onboarding, and robust partner integrations. This master doc is the **single source of truth** for product flows, core modules, security, and engineering conventions. The companion **AI IDE & Analytics Blueprint** specifies Cursor rules, SDK generation, and analytics wiring.

---

## 2. Vision & Goals

* Digitize micro‑insurance operations for individuals and groups in Africa.
* Deliver role‑specific portals (customers, brokers/agents, providers, partners).
* Support flexible premium schedules (daily/weekly/monthly/custom) and arrears logic.
* Expose safe **Public APIs** for partners while isolating **Internal APIs** for portals.
* Provide developer‑friendly onboarding, docs, and SDKs.

---

## 3. Personas & Roles

* **Customers** – buy/manage policies; view dependents, payments, claims.
* **Brokers/Agents** – onboard customers, view commissions, manage sales.
* **Providers/Hospitals** – verify coverage, submit/manage claims.
* **Partners (Insurtechs)** – integrate via Public APIs for policy ops.
* **Internal** – Ops, Finance, Admin, Underwriters, Product/Engineering.

---

## 4. System Architecture (High‑Level)

```
microbima/
  apps/
    backend/            # NestJS (Internal/Public modules)
    admin-dashboard/    # Next.js (Ops/Admin)
    customer-portal/    # React Native
    provider-portal/    # Next.js
    broker-portal/      # Next.js
  packages/
    sdk/                # OpenAPI‑generated TS client + types
    ui/                 # Shared UI lib
    core/               # Shared domain logic (client‑safe)
  openapi/              # microbima.yaml (if not served by backend)
  infra/                # Kong, Authentik, Docker/Fly
  docs/                 # This doc + Blueprint + ADRs
```

**Key choices:** NestJS + Prisma + PostgreSQL; **Kong** at edge; **Authentik** as IAM (loosely coupled); **OpenAPI contract‑first**; **Cursor rules** to enforce SDK use.

---

## 5. Core Modules & Functionalities

> This section captures the operational modules you expected (onboarding, products, claims, etc.) and is authoritative for scope & acceptance.

### 5.1 Onboarding Module

**Objectives:** register individuals and groups; allow partner onboarding via API; enforce KYC, dependents, and plan selection.

**A. Individual Customers (Customer/Broker Portal)**

* Capture personal details, contacts, ID/KYC; dependents/beneficiaries.
* Assign **Policy ID** + **Plan ID**; configurable pre‑activation/grace rules.
* Optionally allow activation before first payment (per product config).

**B. Group/Corporate Customers (Broker/Agent Portal)**

* Register **Group ID**; negotiated rates; enroll members under the group.
* Member roster import (CSV/API); group‑level invoices & statements.

**C. Partners (Public API)**

* Onboard principal members + dependents via partner credentials.
* All partner traffic goes through **Kong** with OIDC scopes; policies auto‑assigned IDs.
* Webhooks/callbacks for enrollment confirmations.

**Outputs/Artifacts:** customer record, policy record, dependents/beneficiaries, KYC docs, audit trail.

### 5.2 Product & Plan Management

**Objectives:** define products, plans, benefits, eligibility, pricing, and payment schedules.

* Define **Products** → **Plans** (Silver/Gold, etc.) with benefits & limits.
* Configure waiting periods, exclusions, provider networks, and eligibility rules.
* Price books per channel (direct, broker, partner) and per group negotiated rates.
* Versioning: immutable plan versions; policies reference a specific version.
* Feature flags for staged rollouts.

### 5.3 Payments & Billing

**Objectives:** flexible frequency, reconciliation, and policy state transitions.

* Frequencies: **daily, weekly, monthly, quarterly, annually, custom intervals**.
* Rails: **MPESA (STK/Paybill)**, bank, cards, broker collections.
* Webhooks for confirmations; idempotency keys; retry logic.
* Arrears engine → **Suspended** after grace window; **Terminated** after threshold.
* Broker/partner bulk reconciliation endpoints.

### 5.4 Policy Lifecycle Management

**States:** **Active** (benefits on), **Suspended** (missed payment), **Terminated** (prolonged non‑payment), **Canceled** (user/company).
**Transitions:** governed by payments, grace periods, and manual ops actions.
**Visibility:** providers can view eligibility; customers see status and dues.

### 5.5 Claims Management (Provider‑led)

* Provider verifies coverage, initiates claim, uploads evidence.
* Workflow: triage → documentation → adjudication → approval/reject.
* SLA tracking (turnaround time); notifications to stakeholders.
* Future: automated adjudication & fraud heuristics.

### 5.6 Commissions (Brokers/Agents)

* Referral tracking; default \~10% (configurable) commission on annualized premium.
* Payout schedules: weekly/monthly/90‑day hold; clawbacks on early cancellations.
* Statements, balances, and exports per agent.

### 5.7 Notifications

* Channels: SMS, Email, WhatsApp (consented).
* Triggers: payment confirmations, arrears reminders, policy activation/suspension, claim updates.
* Bulk alerts to brokers/agents; provider updates.

### 5.8 Partner Developer Portal (Edge)

* Runs atop **Kong** with OIDC.
* Capabilities: partner onboarding, API docs (OpenAPI), keys/tokens, SDK links, usage analytics, sandbox.

---

## 6. Data Model (Conceptual)

**Core entities:** Customer, Group, Policy, Plan, Product, Dependent, Beneficiary, Provider, Claim, Payment, Invoice, Commission, Partner App, Webhook, User/Role.
**Identifiers:** Policy ID, Plan ID, Group ID; partner apps receive Client ID/Secret and scopes.

---

## 7. API Strategy & Contract

* **Internal API**: portals & internal ops; private network; JWT from IAM.
* **Public API**: partners via **Kong**; OIDC scopes; quotas/rate limits.
* **OpenAPI**: single contract (served by backend or `openapi/microbima.yaml`).
* **SDK**: generated TypeScript client + types in `packages/sdk`; clients must import from `@microbima/sdk`.

---

## 8. Identity, Access & Security

* **IAM:** Authentik (OIDC/OAuth2), user federation/identity brokering.
* **Authorization:** scope‑based + role claims; backend enforcement.
* **Gateway security:** Kong OIDC, WAF, rate limiting/quotas; request correlation IDs.
* **Secrets:** env‑vars; no secrets in code.
* **Auditing:** immutable logs for key events; provider actions recorded.

---

## 9. Observability & Analytics

* **Product analytics:** PostHog (events, funnels, feature flags, session replay).
* **BI:** Metabase (read‑only Postgres) dashboards: premiums, active policies, claims TAT, churn.
* **Errors/Perf:** Sentry; **Tracing:** OpenTelemetry.

*Event taxonomy*: `domain.action` (e.g., `policy.issued`, `claim.submitted`, `payment.failed`).

---

## 10. Deployment & Environments

* **Fly.io** per app; private networking for backend↔DB↔IAM.
* Migrations via Prisma in CI before rollout; blue/green or rolling deploys.
* Separate public vs internal surfaces; Kong at edge.

---

## 11. Engineering Conventions

* TS strict; ESLint/Prettier; commit hooks; unit/e2e tests.
* PR checks: build, lint, test, OpenAPI validation, SDK generation.
* Generated code (`packages/sdk/src/gen`) committed initially to simplify builds.
* Cursor rules live in `.cursor/rules/microbima.md` (see Blueprint).

---

## 12. Roadmap

**MVP**: onboarding (individual), payments + policy state machine, provider coverage checks, partner enrollment endpoints, analytics baseline.
**v1**: claims flows, broker commissions, group onboarding & pricing, SSO brokering for partners, more dashboards.

---

## 13. ADRs

* ADR‑0001: Contract‑first SDK (OpenAPI → `@microbima/sdk`).
* ADR‑0002: Analytics stack (PostHog + Metabase).
* ADR‑0003: IAM: Authentik now; keep swap path to Keycloak.
* ADR‑0004: Internal vs Public API topology; rate‑limit at edge.

---

## 14. Acceptance & Handover

* This doc + the **AI IDE & Analytics Blueprint** must be present in `docs/`.
* CI validates OpenAPI + SDK build; PRs must pass.
* Dev Portal content aligns with Public API scope.

---

**End of Document**
