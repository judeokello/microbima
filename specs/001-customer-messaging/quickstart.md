# Quickstart: Unified Customer Messaging (Dev + Manual Validation)

**Branch**: `001-customer-messaging`  
**Created**: 2026-02-16  
**Spec**: [spec.md](./spec.md)  
**Contracts**: [contracts/openapi.yaml](./contracts/openapi.yaml)

## Prerequisites

- API running locally from `apps/api`
- Postgres available (local/dev)
- Environment variables set for:
  - SendGrid sending (API key, from address)
  - Africa’s Talking SMS sending (username + API key)
  - Supabase Storage (URL + service key + bucket for attachments)
  - Sentry DSN (optional in dev, but errors should still be capturable)

## 1) Seed minimal configuration (admin/system)

1. Create system settings:
   - Default messaging language: `en`
   - Retry defaults: SMS = 2, Email = 5
   - Retention defaults: history = 7 years, attachments = 90 days
2. Create a route for `POLICY_PURCHASED`:
   - SMS enabled = true
   - Email enabled = true
3. Create templates:
   - `POLICY_PURCHASED` + `SMS` + `en`
   - `POLICY_PURCHASED` + `EMAIL` + `en` (subject + HTML)

## 2) Prepare a test customer

1. Ensure a customer exists with:
   - phone number
   - email
   - `defaultMessagingLanguage = sw` (to exercise fallback if `sw` templates are missing)

## 3) Trigger deliveries (non-blocking)

1. Trigger the business action (or call the internal “enqueue test” hook used for dev) to enqueue deliveries for `POLICY_PURCHASED`.
2. Verify:
   - API request completes without waiting for message sending (asynchronous)
   - Two deliveries created: one SMS + one email

## 4) Run/observe the scheduled worker

1. Wait for the scheduled worker tick (or trigger it manually in dev).
2. Verify:
   - Worker claims `PENDING` rows safely (no double-processing if two instances run)
   - Deliveries transition through `PROCESSING` → `SENT` (or `RETRY_WAIT`/`FAILED`)
   - On missing placeholder values, delivery becomes `FAILED` with a render error and is reported to Sentry.

## 5) Validate language fallback behavior

1. With customer language `sw` and only `en` templates present:
2. Verify delivery records show:
   - requestedLanguage = `sw`
   - usedLanguage = `en`

## 6) Validate webhooks (idempotent + rate-limited)

### SendGrid event webhook

1. Send a test email and obtain webhook events (or replay a sample payload).
2. POST an array of events to:
   - `POST /webhooks/messaging/sendgrid/events`
3. Verify:
   - Provider events stored (raw payload)
   - Delivery status updated appropriately
   - Re-sending the exact same payload does not duplicate events or regress status (idempotent)

### Africa’s Talking SMS delivery notification webhook

1. Configure callback URL in Africa’s Talking dashboard (or replay a sample payload).
2. POST payload (form or JSON) to:
   - `POST /webhooks/messaging/africas-talking/sms`
3. Verify:
   - Raw payload stored
   - Any derived status/message ID fields update the delivery where possible
   - Duplicates are handled idempotently

## 7) Validate attachments + resend (email)

1. Process an email delivery with attachments.
2. Verify attachments are stored under folder `{deliveryId}/...` in Supabase Storage.
3. From the customer detail messaging tab (Support/Admin only), click **Resend** on the email delivery.
4. Verify:
   - New delivery created linked to original
   - Reuses stored attachments (no regeneration)
5. Simulate attachment expiry (set `expiresAt` in past / delete object) and resend again:
   - Resend fails with clear “attachments expired/missing” reason.

## 8) Validate resend (SMS)

1. From the customer detail messaging tab, click **Resend** on an SMS delivery.
2. Verify:
   - New SMS delivery created linked to original
   - Resent SMS uses the original rendered SMS text (no re-render)
   - Only the selected delivery/channel is resent (no automatic resend of email)

