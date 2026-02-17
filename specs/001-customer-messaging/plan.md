# Implementation Plan: Unified Customer Messaging (SMS + Email)

**Branch**: `001-customer-messaging` | **Date**: 2026-02-16 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/001-customer-messaging/spec.md`  
**Related**: [research.md](./research.md), [data-model.md](./data-model.md), [quickstart.md](./quickstart.md), [contracts/openapi.yaml](./contracts/openapi.yaml)

## Summary

Implement a unified, asynchronous customer messaging capability in `apps/api` that can send **SMS** and/or **Email** for key system events using **DB-managed templates** (template key + channel + language), **DB-managed routing**, **placeholder rendering**, **Supabase Storage attachments for email**, **delivery status tracking** (including provider webhooks), **auditable message history** (per customer and optional policy), and **Support/Admin resend** (per selected delivery/channel).

Core architectural choice: **Postgres outbox table + scheduled worker** (no Redis/Bull).

## Technical Context

**Language/Version**: TypeScript 5.3.x, Node.js >= 18  
**Primary Dependencies**: NestJS 11.x (`apps/api`), Prisma 6.x, `@nestjs/schedule`, `@sentry/nestjs`, Supabase JS client  
**Storage**: PostgreSQL (Prisma), Supabase Storage for PDF attachments (private bucket)  
**Testing**: Jest (NestJS testing patterns), Prisma test DB (integration tests)  
**Target Platform**: Linux server (API behind gateway), multi-instance deployment  
**Project Type**: Monorepo (pnpm + turbo), backend-focused change in `apps/api`  
**Performance Goals**:
- New deliveries become visible in admin history quickly (target: < 1 minute after event).
- Worker processes batches continuously; avoid long “pending” backlogs under normal load.
**Constraints**:
- Asynchronous processing; business workflows must not block on sending/rendering/attachments.
- No Redis/Bull/BullMQ.
- Webhooks are public (no auth) but must be rate-limited, validated, and idempotent.
**Scale/Scope**: Transactional communications for core events first; extendable to more events/languages/templates over time.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **API-first**: All functionality exposed via REST endpoints (internal admin + public webhooks).
- **Database standards**: Use Prisma migrations (no `db push`); store timestamps in UTC.
- **Error handling**: Use standardized error responses (`status`, `ErrorCodes`, `ValidationException` for validation).
- **Monitoring**: Use Sentry for failures; use correlation IDs for tracing.
- **Security**: RBAC-protect internal endpoints; webhooks are public by product decision and must be mitigated with rate limiting, validation, and idempotency.

## Project Structure

### Documentation (this feature)

```text
specs/001-customer-messaging/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── openapi.yaml
```

### Source Code (repository root)

```text
apps/api/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
└── src/
    ├── modules/
    │   └── messaging/
    │       ├── messaging.module.ts
    │       ├── messaging.service.ts               # enqueue + resend + query history
    │       ├── messaging.worker.ts                # scheduled outbox processor
    │       ├── rendering/
    │       │   ├── template-resolver.service.ts
    │       │   └── placeholder-renderer.service.ts
    │       ├── providers/
    │       │   ├── sms-africas-talking.service.ts
    │       │   └── email-sendgrid.service.ts
    │       ├── attachments/
    │       │   ├── attachment.service.ts          # upload/list/download; expiry checks
    │       │   └── attachment-builders/           # per templateKey attachment builders
    │       └── settings/
    │           ├── system-settings.service.ts     # cached reads + meta updatedAt marker
    ├── controllers/
    │   └── internal/
    │       └── messaging.controller.ts            # history + resend + template/route/settings CRUD
    └── controllers/
        └── webhooks/
            └── messaging/
                ├── sendgrid-webhook.controller.ts
                └── africas-talking-webhook.controller.ts
    └── services/
        └── supabase.service.ts                    # existing storage client
```

**Structure Decision**: Implement a dedicated `MessagingModule` inside `apps/api` with clear subfolders for worker, providers, rendering, attachments, webhooks, and settings. Reuse existing cross-cutting infrastructure (Sentry, correlation ID middleware, RBAC decorators/guards, Supabase service).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Public webhook endpoints without auth | Product decision: delivery notifications must be ingested and endpoints are public | “Signed webhooks / allowlists” rejected by clarified requirement; mitigations are rate limiting + strict validation + idempotency + audit logging |

## Phase 0: Outline & Research (completed)

See [research.md](./research.md) for decisions, rationale, and codebase conventions to reuse.

## Phase 1: Design & Contracts

### Data Model

See [data-model.md](./data-model.md). Key additions:
- Customer: `defaultMessagingLanguage` (ISO code)
- New models: templates, routes, deliveries (outbox/history), attachments, provider events, system settings + meta marker.

### API Contracts

See [contracts/openapi.yaml](./contracts/openapi.yaml). Endpoints include:
- Internal admin/support: list deliveries, get delivery, resend a delivery, list/download attachments.
- Public webhooks: SendGrid events, Africa’s Talking SMS notifications.

### Module boundaries (NestJS)

- **MessagingModule**: orchestrates enqueue, resend, querying, and worker processing.
- **Worker (`MessagingWorker`)**: scheduled processor that claims deliveries atomically and executes rendering + provider sending.
- **Rendering**:
  - `TemplateResolverService`: selects template by key/channel/language with fallback rules.
  - `PlaceholderRendererService`: renders `{placeholder_key}` values where keys match `^[a-z0-9_]+$`; required placeholders are inferred by scanning template content for `{...}` tokens. Missing values fail the delivery and are sent to Sentry.
- **Providers**:
  - `SendGridEmailService`: send email (HTML + optional text) and capture provider IDs.
  - `AfricasTalkingSmsService`: send SMS and capture provider IDs.
- **Attachments**:
  - `MessagingAttachmentService`: upload/list/download, enforce expiry (90 days default), and validate folder-per-delivery layout.
  - Attachment builders per template key (e.g., registration welcome: policy summary + member cards).
- **Webhooks**:
  - Webhook controllers accept public payloads, apply rate limiting, persist raw provider events, dedupe, and update delivery lifecycle fields.
- **System settings**:
  - `SystemSettingsService`: DB-managed settings with in-memory cache; refresh based on meta `updatedAt`.

## Delivery lifecycle and worker algorithm

### Status states

Use an enum similar to:
- `PENDING` → eligible for claim
- `PROCESSING` → claimed by worker
- `WAITING_FOR_ATTACHMENTS` → email needs attachments built/uploaded
- `RETRY_WAIT` → failed attempt but scheduled for retry at `nextAttemptAt`
- `SENT` → provider accepted send request
- `FAILED` → final failure (max attempts reached or non-retryable failure)

### Claiming rows safely (multi-instance)

Worker tick:
- Runs every `workerPollIntervalSeconds` (configurable via system settings).
- Claims up to `workerBatchSize` deliveries where:
  - status in (`PENDING`, `RETRY_WAIT`) and `nextAttemptAt <= now`
  - ordered by `nextAttemptAt`, `createdAt`
- Claim is done inside a transaction with row locks (e.g., `FOR UPDATE SKIP LOCKED`) and updates rows to `PROCESSING` + sets `lastAttemptAt`.
- Processing concurrency within a worker instance is limited by `workerMaxConcurrency` (configurable via system settings).

### Processing per delivery

For each claimed delivery:
1. Validate recipient exists (phone for SMS, email for email); if missing → mark `FAILED` with clear reason.
2. Resolve template (requested language → default language fallback); if missing → mark `FAILED`.
3. Render placeholders:
   - If any required placeholder value is missing → mark `FAILED` and capture to Sentry; surface in admin UI.
4. Email attachments:
   - If required and not already persisted → build/upload and create attachment rows.
   - If attachments cannot be built or uploaded → set `RETRY_WAIT` (retryable) or `FAILED` (non-retryable) based on error type.
5. Call provider send API:
   - On success: set `SENT`, record `providerMessageId` (if returned).
   - On error: compute nextAttemptAt using exponential backoff + jitter, increment attemptCount; set `RETRY_WAIT` or `FAILED` after max attempts.

### Backoff and jitter

Backoff is exponential with jitter and configured per channel in system settings. Defaults:
- SMS max attempts: 2
- Email max attempts: 5

## Provider webhooks: idempotency + audit

### Common rules

- Endpoints are public (no auth).
- Apply basic rate limiting (per-IP + global):
  - per-IP: 60 requests/minute
  - global: 1000 requests/minute
  - **Note**: “global” is best-effort per API instance unless a shared counter store is introduced later.
- When rate limited (payload not stored), return `429 Too Many Requests` (provider can retry later).
- Validate payload shape; reject malformed input with safe errors.
- Persist raw payload into `MessagingProviderEvent.payload` for audit.
- Webhook handlers MUST return success once payload is stored, even when it cannot be mapped to a delivery.
- Deduplicate events:
  - Prefer SendGrid `sg_event_id` as unique key when present.
  - For Africa’s Talking, store raw payload and derive a best-effort dedupe key based on provider docs during implementation.

### SendGrid lifecycle mapping (examples)

Use `event` to update outcomes:
- `processed` → provider accepted
- `delivered` → delivered to receiving server
- `bounce`/`dropped` → terminal failure outcomes
- `deferred` → temporary failure (does not necessarily change `SENT`, but appended as provider event)

### SendGrid payload constraints

- SendGrid webhook body is an array of event objects.
- Enforce a cap of **200 events per request**:
  - if the request exceeds the cap, store the raw payload for audit, return success, and skip processing.

## Admin/support capabilities

- History list:
  - filter by customer
  - optional filter by policy
  - filter by channel/status
- Resend:
  - Support/Admin only
  - Resend is per selected delivery/channel (no auto resend both)
  - Email resend reuses original rendered content + stored attachments (fails clearly if attachments expired/missing)
  - SMS resend reuses the original rendered SMS text (no re-render)

## Observability and error handling

- Record correlation IDs on deliveries and provider events.
- Report failures to Sentry:
  - render failures (missing placeholders)
  - provider send errors (after categorization)
  - webhook parsing/storage errors (non-fatal where possible)
- Use standardized error response formats for internal endpoints.

## Testing strategy (Jest + integration)

- **Unit tests**:
  - template selection fallback (requested → system default)
  - placeholder rendering (missing values cause failure)
  - backoff computation (deterministic bounds with jitter)
  - resend logic (new delivery linked; channel-specific)
- **Integration tests** (Postgres):
  - row claiming is safe across simulated parallel workers (no double-processing)
  - webhook idempotency (duplicate SendGrid events do not create duplicates)
  - attachment expiry blocks resend
- **Contract tests**:
  - validate webhook endpoints accept expected shapes and store raw payload

## Retention enforcement (attachments vs history)

- **Attachments (default 90 days)**:
  - Attachments expire via `expiresAt`.
  - A scheduled cleanup job deletes expired attachment objects from Supabase Storage and marks attachment records as deleted/expired for audit visibility.
  - Admin UI continues to show the delivery and attachment metadata, but download/resend fails clearly due to expiry.
- **Message history (default 7 years)**:
  - No purge job is required in this phase; deliveries remain queryable for support and audit.

## Rollout and migration notes

- Add Prisma migration for new models + `Customer.defaultMessagingLanguage`.
- Default settings seeded as part of migration or bootstrap script:
  - default language `en`
  - retries: SMS 2, Email 5
  - retention: history 7 years, attachments 90 days

