# Data Model: Unified Customer Messaging

**Branch**: `001-customer-messaging`  
**Created**: 2026-02-16  
**Spec**: [spec.md](./spec.md)

## Overview

This feature introduces a DB-managed messaging system with:
- Templates (per template key + channel + language)
- Routes (template key → enabled channels)
- Deliveries (outbox table / message history)
- Attachments (email delivery attachments stored in Supabase Storage)
- Provider events (webhook events for delivery lifecycle)
- System settings (DB-managed + cached reads using a meta `updatedAt` marker)

## Entities

### 1) `Customer` (existing)

Add:
- `defaultMessagingLanguage` (string, ISO code; examples: `en`, `sw`)

Notes:
- Used to select templates; fallback to system default language.

---

### 2) `MessagingTemplate`

Represents a template body for a given business template key, channel, and language.

Key fields:
- `id`
- `templateKey` (string; e.g., `POLICY_PURCHASED`)
- `channel` (enum: `SMS`, `EMAIL`)
- `language` (string; ISO code)
- `subject` (string, optional; email-only)
- `body` (string; SMS text or email HTML)
- `textBody` (string, optional; email text alternative)
- `placeholders` (string[] or JSON; optional; declarative list of required placeholders)
- `isActive` (boolean)
- `createdAt`, `updatedAt`, `createdBy`, `updatedBy`

Constraints:
- Unique: `(templateKey, channel, language)`

---

### 3) `MessagingRoute`

Admin-configurable mapping from `templateKey` to enabled channels.

Key fields:
- `id`
- `templateKey` (string; unique)
- `smsEnabled` (boolean)
- `emailEnabled` (boolean)
- `isActive` (boolean)
- `createdAt`, `updatedAt`, `createdBy`, `updatedBy`

---

### 4) `MessagingDelivery` (Outbox + History)

A single delivery attempt to one recipient on one channel.

Key fields:
- `id`
- `templateKey`
- `channel` (`SMS` | `EMAIL`)
- `customerId` (nullable; required for customer-targeted messages)
- `policyId` (nullable)
- `recipientPhone` (nullable; SMS)
- `recipientEmail` (nullable; Email)
- `requestedLanguage` (string; from customer)
- `usedLanguage` (string; selected after fallback)
- `renderedSubject` (string, nullable)
- `renderedBody` (string; store final rendered content exactly as sent)
- `renderedTextBody` (string, nullable)
- `renderError` (string, nullable)
- `status` (enum; see “Status lifecycle”)
- `attemptCount` (int)
- `maxAttempts` (int; derived from system settings snapshot at enqueue time or channel default)
- `nextAttemptAt` (datetime)
- `lastAttemptAt` (datetime, nullable)
- `lastError` (string, nullable)
- `providerMessageId` (string, nullable; SendGrid/Africa’s Talking identifier when available)
- `correlationId` (string, nullable)
- `originalDeliveryId` (nullable; for resend tracing)
- `createdAt`, `updatedAt`, `createdBy`, `updatedBy`

Recommended indices:
- `(status, nextAttemptAt)`
- `(customerId, createdAt)`
- `(policyId, createdAt)`
- `(providerMessageId)` (when populated)

---

### 5) `MessagingAttachment`

Attachments for a single email delivery.

Key fields:
- `id`
- `deliveryId` (FK → `MessagingDelivery`)
- `fileName` (stored/display name; includes member-card naming requirement where applicable)
- `mimeType` (e.g., `application/pdf`)
- `storageBucket`
- `storagePath` (must be under folder `/{deliveryId}/...`)
- `sizeBytes` (optional)
- `checksum` (optional)
- `expiresAt` (datetime)
- `deletedAt` (datetime, optional; set when retention cleanup deletes from storage)
- `createdAt`

Constraints:
- `(deliveryId, fileName)` unique (optional but helpful to avoid duplicates)

---

### 6) `MessagingProviderEvent`

Stores webhook events for audit and status updates.

Key fields:
- `id`
- `provider` (enum: `AFRICAS_TALKING`, `SENDGRID`)
- `deliveryId` (nullable; link when resolvable)
- `providerEventId` (string, nullable; e.g., SendGrid `sg_event_id`)
- `providerMessageId` (string, nullable; e.g., SendGrid `sg_message_id`)
- `eventType` (string; e.g., `delivered`, `bounce`, `sent`)
- `occurredAt` (datetime; provider timestamp)
- `payload` (JSON; raw payload stored for audit)
- `createdAt`

Constraints:
- Unique when possible: `(provider, providerEventId)` where `providerEventId` is present

---

### 7) `SystemSetting` + `SystemSettingsMeta`

DB-managed settings with cached reads based on a meta `updatedAt` marker.

`SystemSetting` key fields:
- `key` (string; unique)
- `value` (string/JSON)
- `updatedAt`, `updatedBy`

`SystemSettingsMeta` key fields:
- `id` (singleton)
- `updatedAt`

Behavior:
- Any settings write updates both the setting and `SystemSettingsMeta.updatedAt`.
- Application periodically checks meta `updatedAt` to refresh in-memory cache.

## Status lifecycle (suggested)

Enum `MessagingDeliveryStatus`:
- `PENDING` (created; awaiting processing)
- `PROCESSING` (claimed by worker)
- `WAITING_FOR_ATTACHMENTS` (email only; attachments generation/upload pending)
- `SENT` (provider accepted the message)
- `FAILED` (final failure; no more retries)
- `RETRY_WAIT` (failed attempt but scheduled for retry at `nextAttemptAt`)
- `CANCELLED` (optional; if business event is reverted)

Notes:
- Provider lifecycle events may further refine “delivered/bounced/dropped”; store those in `MessagingProviderEvent` and optionally maintain a separate `deliveryOutcome` field if needed.

