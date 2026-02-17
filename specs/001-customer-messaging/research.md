# Research Notes: Unified Customer Messaging

**Branch**: `001-customer-messaging`  
**Created**: 2026-02-16  
**Spec**: [spec.md](./spec.md)

## Decisions (resolved)

### 1) Queueing model: DB-backed outbox + scheduled worker (no Redis)

- **Decision**: Use a Postgres-backed outbox table for message deliveries and a scheduled worker (`@nestjs/schedule`) that claims and processes rows in batches.
- **Rationale**: Matches the constraint “no Bull/BullMQ/Redis”; leverages existing `ScheduleModule.forRoot()` already used elsewhere in `apps/api`.
- **Alternatives considered**:
  - Redis queue (Bull/BullMQ): rejected due to explicit constraint.
  - Inline sending during business workflows: rejected (must be asynchronous and non-blocking).

### 2) Concurrency safety for multi-instance workers

- **Decision**: Claim deliveries atomically in Postgres using a transaction with row-level locking semantics (e.g., `FOR UPDATE SKIP LOCKED`) and update status to `PROCESSING` in the same transaction.
- **Rationale**: Prevents double-processing across multiple API instances without Redis.
- **Alternatives considered**:
  - “SELECT then UPDATE” without locking: rejected due to race conditions.
  - Application-level locks: rejected (not reliable across instances).

### 3) Retry/backoff strategy

- **Decision**: Store `attemptCount`, `nextAttemptAt`, `lastError`, `lastErrorAt` per delivery; compute **exponential backoff with jitter** per channel policy.
- **Default max attempts** (from clarifications): SMS = 2, Email = 5.
- **Rationale**: Aligns with reliability requirement while minimizing SMS duplicate annoyance.
- **Alternatives considered**:
  - Uniform retry across channels: rejected (channel-specific policies required).

### 4) Webhook security posture and abuse protection

- **Decision**: Webhook endpoints are **public (no authentication)**, but enforce **basic rate limiting** (per-IP + global cap) and strict input validation/idempotency.
- **Rationale**: Matches clarified product decision; rate limiting reduces outage risk.
- **Alternatives considered**:
  - Signed webhooks / allowlists: rejected by clarification (but can be added later as hardening).

### 5) Idempotency and event deduplication

- **Decision**: Persist raw provider webhook payloads and deduplicate provider events using provider event identifiers when present (e.g., SendGrid `sg_event_id`), plus a “best-effort” dedupe key when not.
- **Rationale**: Providers retry; duplicates must not corrupt delivery status.

### 6) Sentry reporting and admin surfacing of failures

- **Decision**: Rendering failures (missing placeholders) and processing failures are captured to Sentry and also recorded in delivery history for admin views (messaging dashboard + customer detail messaging tab).
- **Rationale**: Required by clarifications and constitution observability principles.

### 7) Attachments storage: Supabase Storage (private)

- **Decision**: Store PDF attachments in Supabase Storage under a folder per delivery ID (outbox/delivery ID), consistent with spec. Keep bucket private and serve downloads through RBAC-protected API endpoints.
- **Rationale**: Existing `SupabaseService` and Supabase Storage usage patterns exist in `apps/api` (e.g., M-Pesa statements). Private storage avoids exposing PII documents publicly.
- **Alternatives considered**:
  - Public buckets: rejected (data protection risk).
  - Pre-signed URLs everywhere: optional future enhancement; not required for initial plan.

### 8) Content storage in history

- **Decision**: Store full rendered content exactly as sent (clarified), and restrict access via RBAC (Support/Admin only).
- **Rationale**: Support/audit need to see exactly what was communicated.

## Provider payload research notes

### SendGrid Event Webhook

- **Source**: SendGrid Event Webhook Reference (`https://docs.sendgrid.com/for-developers/tracking-events/event`)
- **Useful fields**:
  - `event` (delivered/bounce/deferred/dropped/processed/open/click/etc.)
  - `sg_event_id` (recommended dedupe key)
  - `sg_message_id` (message identifier; may be absent for some async bounces)
  - `email`, `timestamp`, `reason`, `status`
- **Implication**: We should store the full array of event objects and map relevant delivery lifecycle transitions based on `event`.

### Africa’s Talking SMS delivery notifications

- **Source**: Africa’s Talking docs referenced in spec, but the site is not reliably fetchable in this environment (cookie/JS gate).
- **Plan**:
  - Implement webhook handler that stores the raw payload (form or JSON) and attempts to extract message identifiers and status using provider documentation during implementation.
  - Keep schema flexible: store raw payload + derived normalized fields (when extractable).

## Existing codebase conventions to reuse (apps/api)

- **Scheduling**: `ScheduleModule.forRoot()` is already used; patterns exist for registering cron jobs and generating correlation IDs for scheduled work.
- **Sentry**: `@sentry/nestjs` is already configured globally; use it for worker/send failures and render failures.
- **Correlation IDs**: `CorrelationIdMiddleware` exists and is global; for worker runs, generate a correlation ID per batch and record it on deliveries/events for traceability.
- **Supabase**: `SupabaseService` exists and is used for Storage uploads in some flows.
- **RBAC**: Guards/decorators exist (`@AdminOnly`, role-based checks). Use to protect internal admin messaging endpoints and attachment downloads.
- **Error codes**: Central `ErrorCodes` enum exists; prefer reuse when defining new messaging errors.

