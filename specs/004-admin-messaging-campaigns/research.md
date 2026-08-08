# Research: Admin Messaging Campaigns

**Branch**: `004-admin-messaging-campaigns`  
**Date**: 2026-08-08  
**Spec**: [spec.md](./spec.md)

## R1 — Campaign send path vs existing outbox

**Decision**: Introduce `MessagingCampaign` + campaign dispatcher; at dispatch time expand/render/dedupe, then insert `MessagingDelivery` rows with **pre-rendered** `renderedBody` / `renderedSubject` and `templateKey` `admin_template_sms` | `admin_template_email`. Reuse existing `MessagingWorker` (skips render when body already set) and providers.

**Rationale**: Worker already supports “render if empty”; avoids forking SMS/email providers; deliveries remain visible on Customer Messages tab via `customerId`.

**Alternatives considered**:
- Call `MessagingService.enqueue()` per recipient with placeholder context — works but double-renders and couples campaigns to empty DB template bodies.
- Separate campaign sender bypassing outbox — duplicates retry/webhook/history behavior.

---

## R2 — Delay window implementation

**Decision**: On successful Send (after preflight), persist campaign with status `DELAYED` and `dispatchStartsAt = now + delay`. Do **not** create deliveries until a scheduled **CampaignDispatcher** claims due campaigns. UI countdown is display-only against `dispatchStartsAt`.

**Rationale**: Cancel-during-delay needs zero provider handoffs; creating deliveries early complicates cancel and wastes rows on failed-preflight-adjacent flows.

**Alternatives considered**:
- Create PENDING deliveries with `nextAttemptAt` in the future — cancel must race the worker; riskier.
- Client-only delay then POST dispatch — unsafe if tab closes; server must own the timer.

---

## R3 — Preflight vs Send persistence

**Decision**: `POST .../campaigns/preview` is stateless (or short-lived server compute) returning counts, sample render, skip/error CSV payloads — **no** campaign row. `POST .../campaigns` (Send) runs preflight again; on block → save `FAILED_PREFLIGHT` with renamed name `{original}_failedX`; on success → `DELAYED`.

**Rationale**: Matches clarified product rules; Send is the audit boundary.

---

## R4 — Failed-preflight name rewrite

**Decision**: On failed-preflight save, set `name` to `{requestedName}_failed{N}` where `N` is the smallest positive integer such that the new name is unique (case-insensitive). Store `requestedName` (or `originalName`) on the campaign for display/audit. Leave `requestedName` free for retry.

**Rationale**: Product clarification; preserves meaningful names for retries while keeping uniqueness.

---

## R5 — Handed-off vs receipt-confirmed counts

**Decision**:
- Add `handedOffAt` (timestamptz, nullable) set when worker successfully accepts provider API response (status → `SENT`).
- Add `receiptConfirmedAt` (timestamptz, nullable) set when provider webhook indicates delivered success (`DELIVERED` / equivalent).
- Campaign aggregates: `targetedCount` stored at dispatch; `handedOffCount` / `receiptConfirmedCount` calculated from deliveries (or denormalized counters updated by worker/webhook).

**Rationale**: Today `SENT` conflates API accept and some webhook successes; separate timestamps make dual progress counts correct without a second status enum for every case.

**Alternatives considered**: Count `MessagingProviderEvent` only — harder for email if SMTP has no receipt webhook; timestamps on delivery are simpler for aggregation.

---

## R6 — Delivery cancel status

**Decision**: Add `CANCELLED` to `MessagingDeliveryStatus`. Cancel-after-dispatch sets remaining `PENDING` (and `RETRY_WAIT` if any) to `CANCELLED`. Do not touch `PROCESSING`, `SENT`, `FAILED`.

**Rationale**: Spec requires cancel of not-yet-sent; existing enum lacks CANCELLED.

---

## R7 — Africa’s Talking bulk batching

**Decision (MVP)**: Keep one API call per delivery via existing `AfricasTalkingSmsService`. Document optional Phase-2 optimization: batch recipients that share **identical** `renderedBody` into comma-separated `to` (AT bulk API already used).

**Rationale**: Campaigns often personalize per recipient (`{first_name}`); identical-body batches are a subset. Correctness and cancel granularity matter more than MVP throughput; warn at 5k without hard cap.

**Alternatives considered**: Always bulk-batch — breaks per-delivery providerMessageId mapping unless AT returns per-number IDs carefully handled.

---

## R8 — Email HTML sanitization

**Decision**: Sanitize HTML on Send/preview sample using a server-side allowlist sanitizer (e.g. `sanitize-html`) before persist/render. Strip scripts/event handlers; allow common rich-text tags used by the editor.

**Rationale**: Admin-composed HTML is stored and emailed; XSS to recipients/admin preview is a real risk.

---

## R9 — System settings keys

**Decision**: Extend `MessagingSettingsSnapshot` + `system_settings` seed:

| Snapshot field | Default | Notes |
|----------------|---------|--------|
| `campaignConfirmThreshold` | `20` | Typed name confirmation |
| `campaignSmsDelaySeconds` | `120` | 2 minutes |
| `campaignEmailDelaySeconds` | `180` | 3 minutes |
| `campaignIdempotencyWindowMinutes` | `10` | name+body+audience guard |

Large-audience warn threshold **5000** is a product constant (not a setting) unless ops later asks to configure it.

**Rationale**: Aligns with system-settings-snapshot workspace rule.

---

## R10 — Idempotency

**Decision**:
1. Client may send `Idempotency-Key` header on Send; store on campaign; duplicate key returns existing campaign.
2. Additionally reject create when another non-failed-preflight campaign exists with same case-insensitive **requested** name + same content hash + same audience hash within `campaignIdempotencyWindowMinutes`.
3. Same campaign id cancel/send are naturally idempotent.

**Rationale**: Spec requires campaign-id and name+body+audience window guards.

---

## R11 — Audience expansion & dedupe

**Decision**: Pure functions in `campaign-audience.service.ts`:
1. Expand modes → candidates `{ phone|email, customerId?, policyId?, schemeId?, placeholderValues }`.
2. Soft-skip missing/invalid channel addresses.
3. Render with `PlaceholderRendererService`; collect blocking missing keys.
4. Dedupe key = `normalize(address) + '\n' + hash(renderedSubject + '\n' + renderedBody)`.
5. Deterministic sample = first sendable candidate after stable sort (customerId, policyId, address).

**Rationale**: Matches spec; keeps dispatcher thin.

---

## R12 — Non-prod redirect

**Decision**: Reuse `getNonProdMessagingTag` / creator redirect helpers from messaging module when resolving SMS/email recipients for customer-linked candidates at **dispatch enqueue** time (same as `MessagingService.enqueue`).

**Rationale**: Spec FR-040; avoid divergent non-prod behavior.

---

## R13 — RBAC & UI placement

**Decision**:
- API: `registration_admin` for compose/send/cancel/template write; `registration_admin` **or** `customer_care` for campaign list/detail/CSV download.
- UI in `apps/agent-registration`: `/admin/campaigns` (compose + history), `/admin/messaging-templates` (edit non-admin templates). Keep `/admin/messages` for delivery history.

**Rationale**: Spec roles; existing admin shell is `registration_admin`-gated — customer care needs an accessible history route (extend layout allowlist for campaigns history only, or shared support shell pattern already used elsewhere).

**Note**: Today `admin/layout.tsx` is admin-only. Plan must grant customer_care access to **Campaigns → History** (and not Compose/Templates). Implementation options: (a) nested route groups with role gates, or (b) move history under a support-accessible path. Prefer role gates inside `/admin/campaigns` with layout updated to allow `customer_care` for that segment only.

---

## R14 — Admin template shells

**Decision**: Seed `MessagingTemplate` + `MessagingRoute` for `admin_template_sms` (SMS, en, empty/minimal body) and `admin_template_email` (EMAIL, en, empty body/subject). Routes: SMS-only / Email-only respectively. UI never saves campaign copy back to these rows; they exist for routing/consistency and delivery `templateKey`.

**Rationale**: Spec + existing route-based worker assumptions if any code path still resolves templates.

---

## R15 — Concurrent template edits

**Decision**: Last-write-wins with `updatedAt` / `updatedBy` audit on `MessagingTemplate`. No optimistic locking in MVP.

**Rationale**: Low contention admin surface; defer conflict UI.

---

## R16 — Analyze remediations (2026-08-08)

**Decision**: Folded into Spec/Plan/Tasks: FR-010a HTML sanitize; empty HTML = stripped text length 0; sample sort (customerId, policyId, address); ValidationException/`status`/correlationId; phone 254… + email lowercase; TipTap; immutable after Send; SC-001 excludes delay wait; optional Idempotency-Key; EMAIL receiptConfirmed may stay 0; inactive scheme/package + test-user + 5k warn covered in T006/T020; UI TDD out of scope.

**Rationale**: Close HIGH/MEDIUM/LOW analyze findings before `/speckit.implement`.

## Unresolved → resolved

All Technical Context unknowns for this feature are resolved above; no remaining NEEDS CLARIFICATION for planning.
```