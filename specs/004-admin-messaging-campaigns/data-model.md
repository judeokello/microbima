# Data Model: Admin Messaging Campaigns

**Branch**: `004-admin-messaging-campaigns`  
**Date**: 2026-08-08  
**Spec**: [spec.md](./spec.md)

## Overview

Extends the existing messaging outbox (`MessagingDelivery`) with campaign orchestration entities, delivery cancel/receipt fields, admin template shells, and campaign-related system settings.

## New enums

### `MessagingCampaignStatus`

| Value | Meaning |
|-------|---------|
| `DELAYED` | Send accepted; waiting for `dispatchStartsAt` |
| `DISPATCHING` | Creating/queueing deliveries |
| `COMPLETED` | Dispatch finished; no delivery failures |
| `COMPLETED_WITH_FAILURES` | Dispatch finished; ≥1 delivery `FAILED` |
| `CANCELLED` | Cancelled during delay or mid-dispatch |
| `FAILED_PREFLIGHT` | Send clicked but blocked (placeholders / zero sendable) |

### `MessagingDeliveryStatus` (extend)

Add: `CANCELLED` — not handed to provider; cancelled with campaign or equivalent.

---

## New / updated entities

### 1) `MessagingCampaign`

| Field | Type | Notes |
|-------|------|--------|
| `id` | UUID PK | |
| `name` | string | Unique case-insensitive; may be rewritten on failed preflight |
| `requestedName` | string | Name as entered by admin (before `_failedX`) |
| `channel` | `MessagingChannel` | SMS \| EMAIL |
| `templateKey` | string | `admin_template_sms` \| `admin_template_email` |
| `status` | `MessagingCampaignStatus` | |
| `bodyWithPlaceholders` | text | SMS body or email HTML (pre-sanitize snapshot) |
| `subjectWithPlaceholders` | string? | Email only |
| `audienceSnapshot` | JSON | Modes, schemeIds, packageIds, statuses, list digests, counts |
| `contentHash` | string | Hash of subject+body for idempotency |
| `audienceHash` | string | Hash of normalized audience definition |
| `targetedCount` | int | Sendable after expand/dedupe/skip at dispatch (0 if failed preflight) |
| `idempotencyKey` | string? | Optional client key; unique when set |
| `dispatchStartsAt` | timestamptz? | Set when DELAYED |
| `dispatchStartedAt` | timestamptz? | When dispatcher began |
| `completedAt` | timestamptz? | |
| `cancelledAt` | timestamptz? | |
| `cancelledBy` | string? | User id |
| `createdBy` | string | User id |
| `correlationId` | string? | |
| `preflightErrors` | JSON? | Blocking error rows for CSV |
| `preflightSkips` | JSON? | Soft-skip rows for CSV |
| `createdAt` / `updatedAt` | timestamptz | UTC |

Indexes:
- Unique lower(`name`)
- Unique (`idempotencyKey`) where not null
- `(status, dispatchStartsAt)` for dispatcher
- `(createdAt desc)` for history list
- `(contentHash, audienceHash, createdAt)` for idempotency window lookup

Relations:
- `deliveries` → `MessagingDelivery[]`
- `auditEvents` → `MessagingCampaignAuditEvent[]`

---

### 2) `MessagingCampaignAuditEvent`

| Field | Type | Notes |
|-------|------|--------|
| `id` | UUID PK | |
| `campaignId` | UUID FK | |
| `eventType` | string | e.g. `CREATED`, `FAILED_PREFLIGHT`, `DELAY_STARTED`, `CANCELLED`, `DISPATCH_STARTED`, `DISPATCH_COMPLETED` |
| `actorUserId` | string? | |
| `payload` | JSON | Snapshots / counts / reason |
| `createdAt` | timestamptz | |

---

### 3) `MessagingDelivery` (existing — additions)

| Field | Type | Notes |
|-------|------|--------|
| `campaignId` | UUID? FK → MessagingCampaign | Null for non-campaign messages |
| `handedOffAt` | timestamptz? | Provider API accepted |
| `receiptConfirmedAt` | timestamptz? | Provider delivery receipt |

Status enum adds `CANCELLED`.

Indexes: `(campaignId, status)`, `(campaignId, createdAt)`.

---

### 4) `MessagingTemplate` / `MessagingRoute` (seed)

| templateKey | channel | route |
|-------------|---------|--------|
| `admin_template_sms` | SMS | smsEnabled=true, emailEnabled=false |
| `admin_template_email` | EMAIL | smsEnabled=false, emailEnabled=true |

Bodies may be empty placeholders; campaign content comes from campaign snapshot / pre-rendered delivery rows. Not editable via Campaign Templates UI.

---

### 5) System settings (snapshot keys)

See [research.md](./research.md) R9. Must update `MessagingSettingsSnapshot`, `DEFAULT_SETTINGS`, `assignFromJson`, seed/migration, bump `system_settings_meta.updatedAt`.

---

## Audience snapshot JSON (conceptual)

```json
{
  "modes": ["SCHEME_CUSTOMERS", "SCHEME_CONTACTS", "PASTE_LIST"],
  "schemeIds": [1, 2],
  "packageIds": [10],
  "customerStatuses": ["ACTIVE"],
  "policyStatuses": ["ACTIVE", "SUSPENDED"],
  "pasteListDigest": { "count": 12, "sha256": "..." },
  "pasteList": ["...optional store for audit; prefer digest + side storage if large..."],
  "perSchemeCounts": [{ "schemeId": 1, "schemeName": "...", "recipientCount": 40 }]
}
```

**Decision**: Store full paste list in snapshot when below a safe size (e.g. 5k lines); otherwise store digest + object storage/path. MVP can store in JSON if PostgreSQL JSON size allows; cap paste lines soft-warn with audience warn.

---

## Preflight CSV row shape

```json
{
  "customerName": "Jane Doe",
  "phone": "2547...",
  "email": "jane@...",
  "customerId": "uuid|null",
  "error": "Missing placeholder: policy_number"
}
```

---

## State transitions — Campaign

```text
(Send + preflight fail) → FAILED_PREFLIGHT
(Send + ok) → DELAYED
DELAYED → CANCELLED (admin cancel)
DELAYED → DISPATCHING (dispatcher)
DISPATCHING → CANCELLED (admin cancel; pending deliveries cancelled)
DISPATCHING → COMPLETED | COMPLETED_WITH_FAILURES
```

## State transitions — Delivery (campaign)

```text
(created at dispatch) → PENDING
PENDING → PROCESSING → SENT (handedOffAt set)
PENDING | RETRY_WAIT → CANCELLED (campaign cancel)
SENT → (webhook) receiptConfirmedAt set; may stay SENT or → FAILED if undeliverable
```

---

## Validation rules

- Name required; unique case-insensitive among all campaigns.
- Channel-pure audiences.
- Customer/policy/package filters required iff `SCHEME_CUSTOMERS` mode included; ≥1 each; only active schemes/packages selectable (inactive visible).
- Non-empty SMS body; non-empty email subject + body.
- Auto `_failedX` rename only on `FAILED_PREFLIGHT`.
- English only (`requestedLanguage` / `usedLanguage` = `en` for campaign deliveries).

---

## Calculated progress

| Metric | Definition |
|--------|------------|
| Targeted | `targetedCount` at dispatch |
| Handed off | count deliveries where `handedOffAt IS NOT NULL` |
| Receipt confirmed | count where `receiptConfirmedAt IS NOT NULL` |
