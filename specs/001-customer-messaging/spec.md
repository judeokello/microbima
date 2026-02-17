# Feature Specification: Unified Customer Messaging

**Feature Branch**: `001-customer-messaging`  
**Created**: 2026-02-16  
**Status**: Draft  
**Input**: Unified customer messaging for key system events:
- Channels: SMS and Email (either or both per event)
- Templates: per template key + channel + language (English `en`, Swahili `sw` initially)
- Personalization: placeholder substitution (e.g., `{first_name}`, `{policy_number}`)
- Email attachments: zero-to-many PDFs per email delivery (including variable counts like member cards)
- Reliability: asynchronous processing, retries per channel, delivery status tracking beyond “attempted”
- Operations: audit trail per customer (optionally per policy), admin routing configuration, resend of emails

## Clarifications

### Session 2026-02-16

- Q: Delivery notification security → A: No authentication (public endpoint)
- Q: Missing placeholder values → A: Fail delivery with a clear render error; report to error monitoring and surface error in admin messaging dashboard + customer detail messaging section
- Q: Who can resend? → A: Support/Admin roles only; resend available from customer detail messaging tab and from the messaging admin list/detail view
- Q: Retention defaults → A: Message history 7 years; attachments 90 days
- Q: Resend scope → A: Resend is available for both SMS and Email, and support/admin can choose which delivery (channel) to resend (no automatic “resend both”)
- Q: Default retry limits → A: SMS max attempts = 2; Email max attempts = 5
- Q: Stored message content → A: Store full rendered content exactly as sent
- Q: Public webhook rate limiting → A: Basic rate limiting (per-IP + global)
- Q: SMS resend content → A: Reuse original rendered SMS text
- Q: Webhook rate limit thresholds → A: 60 requests/minute per IP and 1000 requests/minute global
- Q: SendGrid webhook max events per request → A: cap at 200 events per request
- Q: Webhook response behavior when unmapped → A: return 200 after storing payload even if it cannot be mapped to a delivery
- Q: Webhook throttling response → A: return 429 Too Many Requests when rate limited (payload not stored)
- Q: Retention enforcement → A: Attachments are physically deleted at expiry (90 days default) and marked expired/deleted in DB; message history is retained (no purge job in this phase)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Event triggers routed deliveries (Priority: P1)

As a customer, when I complete a key action (e.g., policy purchase, registration), I receive consistent communications via SMS, email, or both depending on system configuration.

**Why this priority**: This is the core value—customers receive confirmations/receipts/documents reliably, and the system can scale to more events without hardcoding.

**Independent Test**: Can be fully tested by triggering one supported event for a test customer and verifying that the correct deliveries are created (SMS/email/both) according to routing, without blocking the originating workflow.

**Acceptance Scenarios**:

1. **Given** routing enables SMS and Email for `POLICY_PURCHASED`, **When** a customer purchases a policy, **Then** the system creates one SMS delivery and one email delivery for that customer under the same template key.
2. **Given** routing disables SMS for `REGISTRATION_COMPLETED`, **When** registration completes, **Then** the system creates only an email delivery (and no SMS delivery).
3. **Given** a policy purchase completes, **When** messaging is triggered, **Then** the purchase workflow completes without waiting for message sending/attachments/provider responses.

---

### User Story 2 - Templates render in the right language with fallback (Priority: P2)

As a customer, I receive messages in my preferred language when available, and the system falls back to a default language when not.

**Why this priority**: Language correctness is essential to trust and comprehension, and fallback prevents missed communications due to incomplete translations.

**Independent Test**: Can be tested by configuring templates such that a preferred-language variant is missing and verifying that fallback occurs and is recorded.

**Acceptance Scenarios**:

1. **Given** a customer’s default messaging language is `sw`, **When** the `sw` email template is available for the event, **Then** the email uses `sw`.
2. **Given** a customer’s language is `sw` and the `sw` email template is missing for the event, **When** the delivery is processed, **Then** the system uses the system default language template (e.g., `en`) and records both the requested and used languages.
3. **Given** neither preferred nor default language templates exist for a required channel, **When** processing occurs, **Then** the delivery is not sent and is marked failed with a clear reason visible in history.

---

### User Story 3 - Resend a specific delivery (Priority: P2)

As a customer, I can receive key communications by SMS and/or email; as an admin/support agent, I can resend a specific prior delivery (SMS or email) when needed, without automatically resending other channels the customer may have already received.

**Why this priority**: Attachments (receipts, policy summaries, member cards) are core to the customer experience and support operations; resend reduces rework and improves service.

**Independent Test**: Can be tested by processing both an SMS and an email delivery for the same event, then resending only one of them and verifying that a new delivery record is created/linked while the other channel is not resent.

**Acceptance Scenarios**:

1. **Given** an email delivery requires multiple attachments (including variable member cards), **When** the delivery is processed, **Then** all attachments are stored and associated to that delivery for later audit/resend.
2. **Given** an email delivery exists and its attachments are still retained, **When** an admin requests resend, **Then** a new email delivery is created and sent using the original rendered content and the stored attachments, and the new delivery references the original for traceability.
3. **Given** an email delivery exists but required attachments have expired or been deleted, **When** an admin requests resend, **Then** the resend fails with a clear reason and is recorded in history.
4. **Given** an event produced both an SMS delivery and an email delivery, **When** an admin resends the SMS delivery, **Then** only a new SMS delivery is created/sent and the email is not resent.
5. **Given** a staff user without Support/Admin permissions, **When** they attempt to resend any delivery, **Then** the system denies the action and records the attempt for audit.

---

### User Story 4 - Admins can view message history and delivery lifecycle (Priority: P3)

As an admin/support agent, I can view what was sent (or attempted), when, to whom, in what language, and its delivery status; I can filter by customer and optionally by policy.

**Why this priority**: Support needs a trustworthy audit trail to resolve customer issues and to verify compliance and communications.

**Independent Test**: Can be tested by generating deliveries for a customer across multiple events (with and without policy association), then verifying history views show correct details and filters.

**Acceptance Scenarios**:

1. **Given** a customer has multiple deliveries across different events, **When** an admin views message history for the customer, **Then** all deliveries are visible with channel, recipient, template key, language requested/used, timestamps, and current delivery status.
2. **Given** some deliveries are associated to a specific policy and others are not, **When** an admin filters by policy, **Then** only deliveries for that policy are shown.
3. **Given** a provider reports delivery/bounce outcomes after sending, **When** the system receives provider delivery notifications, **Then** the delivery status is updated to reflect the lifecycle and the notification is recorded as part of the audit trail.

---

### Edge Cases

- Customer has no email address and the route enables email: an email delivery is created and immediately marked failed with a clear “missing recipient” reason.
- Customer has no phone number and the route enables SMS: an SMS delivery is created and immediately marked failed with a clear “missing recipient” reason.
- Routing enables neither SMS nor Email for an event: no deliveries are created; the event is still considered handled.
- Template exists but cannot be rendered because required data is missing: delivery fails before sending with a clear render failure reason.
- The same delivery notification is received multiple times: status updates are idempotent and do not corrupt history.
- Delivery notification endpoints are public: the system rejects malformed notifications with clear validation outcomes and remains resilient under abusive/invalid traffic patterns.
- Delivery notification endpoints apply basic throttling to reduce abuse risk (rate limiting per IP plus a global cap).
- Delivery notification handlers may not be able to map a provider payload to a delivery immediately: the system still stores the raw payload for audit and returns a success response.
- Attachments exist but one cannot be retrieved during sending: delivery fails and is eligible for retries according to email retry policy.
- Policy-linked message is triggered but policy reference is unavailable at that moment: delivery is still recorded for the customer with `policyId = null`. If a policy reference becomes available later, the system may link the delivery to the policy by setting `policyId`; otherwise it remains “not policy-bound” in history.
- Customers with unsupported language codes: system uses the default language and records the fallback.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support customer messaging deliveries over two channels: SMS and Email.
- **FR-002**: System MUST define a stable **template key** for each business event type (e.g., `POLICY_PURCHASED`, `REGISTRATION_COMPLETED`) used to select templates and routing.
- **FR-003**: System MUST allow admins to configure routing per template key to send SMS, Email, or both, and routing changes MUST take effect without redeploying the system.
- **FR-003a**: Routing configuration endpoints MUST be protected by RBAC: only **Admin** users may create/update routes.
- **FR-003b**: If routing enables neither SMS nor Email for an event, the system MUST create **no** delivery records and the event is still considered handled. This “no-op due to routing” outcome does not appear in customer messaging history in this phase.
- **FR-004**: System MUST support message templates scoped by template key, channel, and language code (ISO language codes; `en` and `sw` initially).
- **FR-005**: System MUST store each customer’s default messaging language as an ISO language code and use it when selecting templates for customer-targeted messages.
- **FR-006**: When a preferred-language template is missing, system MUST fall back to the system default messaging language template; when both are missing, system MUST mark the delivery as failed with a clear, operator-visible reason.
- **FR-007**: System MUST support placeholder substitution in templates using customer/event/policy data at send time.
- **FR-007a**: Placeholders MUST use the form `{placeholder_key}` and placeholder keys MUST match `^[a-z0-9_]+$`.
- **FR-007b**: The set of required placeholders for a delivery MUST be inferred by scanning the selected template content (SMS body; Email subject/body/text body) for `{...}` tokens, and each required placeholder MUST have a value at render time.
- **FR-007c**: Placeholder values MUST come only from an explicit render context provided at enqueue time as a flat map `placeholderValues: Record<string, string | number | boolean | Date>`. The system MUST NOT read arbitrary customer/policy fields for placeholder substitution unless they are explicitly provided in `placeholderValues`.
- **FR-007d**: Optional placeholders are NOT supported in this phase. All `{placeholder_key}` tokens found by scanning the selected template content are treated as required placeholders for that delivery.
- **FR-008**: If required data for placeholder rendering is missing, system MUST NOT send the delivery and MUST record a clear render-failure reason (consistent across SMS and Email).
- **FR-008a**: A placeholder value is considered missing if the key is absent from `placeholderValues`, or if the value is `null`/`undefined`, or if it is a string that becomes empty after trimming whitespace. Values like `0` and `false` MUST be treated as present (not missing).
- **FR-008b**: Placeholder values that are present but invalid MUST be handled deterministically:
  - If a placeholder value cannot be rendered to a string safely (e.g., unsupported type), the delivery MUST fail as a render error (same visibility and monitoring rules as missing placeholders).
  - If a placeholder value is a `Date`, it MUST be rendered using an agreed formatting rule (documented during implementation) and MUST use UTC.
  - The system MUST NOT silently “guess” or apply ad-hoc sanitization rules to placeholder values beyond basic string conversion; if formatting rules are not defined for a placeholder, the delivery MUST fail with a clear render error.
- **FR-009**: Placeholder render failures MUST be reported to centralized error monitoring and MUST be visible to admins/support in the messaging admin dashboard and in the customer detail messaging history (including the error reason).
- **FR-009a**: A “clear render error” MUST include, at minimum, all of the following fields recorded on the delivery record:
  - `errorMessage`: human-readable explanation (e.g., “Missing placeholder values”)
  - `missingPlaceholderKeys`: array of placeholder keys that were required but missing (e.g., `["policy_number", "premium"]`)
  - `templateKey`, `channel`, `requestedLanguage`, `usedLanguage`
  - `failedAt`: timestamp of when the render failure was determined
  - `deliveryId`: the internal delivery identifier
- **FR-009b**: Render failures MUST be visible to Support/Admin users in both:
  - the admin messages list/dashboard (per-delivery row), and
  - the customer detail messaging history view (per-delivery row and detail)
- **FR-009c**: Render failures MUST be reported to centralized error monitoring and MUST include, at minimum, `deliveryId`, `templateKey`, `channel`, `customerId` (if present), and `correlationId` (if present).
- **FR-009d**: For any delivery failure (render failure, provider send failure, attachment failure, template missing), the system MUST:
  - record a structured failure reason on the delivery record (machine-readable code + human message),
  - include `deliveryId`, `templateKey`, `channel`, `attemptCount`, `customerId` (if present), `policyId` (if present), and `correlationId` (if present) in monitoring events,
  - and ensure the same fields are visible to Support/Admin in the delivery detail view.
- **FR-010**: System MUST enqueue message deliveries asynchronously so that originating business workflows are not blocked by message processing and sending.
- **FR-010a**: Enqueueing deliveries MUST NOT perform template rendering, attachment generation/upload, or provider API calls before returning control to the triggering workflow.
- **FR-010b**: The enqueue operation MUST create the delivery record(s) in the database before returning, and MUST complete in under 250ms (p95) under normal operating conditions.
- **FR-010c**: The worker MUST be safe to run with multiple concurrent instances. A given delivery MUST NOT be processed (sent) by more than one worker instance for the same attempt. Claiming work MUST be atomic such that at-most-one worker can transition a delivery from an eligible state into a processing state at a time.
- **FR-011**: System MUST create an auditable delivery record for each attempted message to a single recipient on a single channel, including the template key, channel, recipient, requested language, used language, timestamps, and current status.
- **FR-011a**: Each delivery record MUST include a `correlationId` field when available from the triggering workflow. This `correlationId` MUST also be included in monitoring events (when present) and SHOULD be used to link provider events and operator investigations.
- **FR-012**: System MUST support associating a delivery record to a customer and optionally to a policy, and MUST support messages not bound to any policy.
- **FR-013**: System MUST provide an admin-facing way to view message history per customer, and optionally filter by policy.
- **FR-013a**: Internal messaging history access MUST be protected by RBAC:
  - Support and Admin users MAY list/view delivery history and delivery details (including rendered content and provider outcomes/events).
  - Only Admin users MAY create/update/delete templates, routes, and system messaging settings.
- **FR-013b**: Access to rendered content and attachments is restricted to Support/Admin users only in this phase. The feature does not provide customer self-service access to message history or attachment downloads.
- **FR-014**: System MUST record the final rendered message content for each delivery exactly as sent (sufficient for support to understand what was communicated).
- **FR-014a**: For SMS deliveries, the system MUST store the final rendered SMS body exactly as sent to the provider (as a single string), and it MUST be retrievable in admin history views.
- **FR-014b**: For Email deliveries, the system MUST store exactly as sent:
  - `renderedSubject` (string)
  - `renderedBody` (the HTML content as a string)
  - `renderedTextBody` (the plain-text alternative as a string, if present)
- **FR-014d**: Email HTML content MUST be HTML-minified before being sent to the email provider, and the system MUST store the post-minification HTML as `renderedBody` (i.e., the stored `renderedBody` is the exact HTML string submitted to the provider). Minification MUST be deterministic and MUST be limited to whitespace/comment removal (no semantic transformations that change the rendered meaning of the HTML).
- **FR-014c**: The stored rendered content MUST be the source of truth for resend behavior:
  - Email resends MUST reuse the stored rendered subject/body/text exactly (no re-render).
  - SMS resends MUST reuse the stored rendered SMS text exactly (no re-render).
- **FR-015**: System MUST support email deliveries with zero, one, or multiple attachments.
- **FR-016**: System MUST persist attachments for each email delivery so that resends can reuse the exact files without regeneration while attachments remain retained.
- **FR-016a**: Attachments MUST be stored in private object storage (not publicly accessible). If object storage is degraded/unavailable at send time:
  - transient storage errors (timeouts/5xx) MUST be treated as retryable send failures (eligible for retries),
  - but missing objects (e.g., storage reports “not found” for a required attachment) MUST be treated as non-retryable (“poison”) for that delivery.
- **FR-017**: Attachments MUST be grouped by delivery identifier in storage, and member card filenames MUST follow: `<member-firstname>-<member-lastname>-<memberNumber>-member-card.pdf`, with filename-safe sanitization.
- **FR-018**: System MUST support configurable retention for message history and attachments. By default, message history MUST be retained for 7 years and attachments MUST be retained for 90 days; attachments MUST have an expiry concept that prevents resend when required files are no longer available.
- **FR-018a**: When an attachment reaches expiry, the system MUST physically delete it from object storage and MUST mark it expired/deleted in the attachment record so admin history can still show that attachments expired.
- **FR-018b**: Message history retention (7 years default) is a policy requirement; message history purge is NOT required for this phase.
- **FR-018c**: Retention periods MUST be measured from unambiguous timestamps:
  - attachment retention (90 days default) is measured from `attachment.createdAt` (the time the attachment record/storage object was created).
  - message history retention (7 years default) is measured from `delivery.createdAt`.
- **FR-018d**: Attachment expiry enforcement MUST be operationally robust:
  - Once an attachment is considered expired, it MUST be treated as unavailable for resend immediately (even if physical deletion is still pending due to a transient storage error).
  - If physical deletion from object storage fails due to a transient error, the system MUST retry deletion on a later cleanup run and MUST surface “expired (deletion pending)” vs “expired (deleted)” distinctly in admin/support views.
- **FR-019**: Admins MUST be able to resend a prior delivery (SMS or Email), which MUST create a new delivery record linked to the original for traceability.
- **FR-020**: Resend MUST be performed for a specific selected delivery (channel) and MUST NOT automatically resend other channels that may have been delivered for the same event.
- **FR-021**: When resending an email, the resend MUST reuse the original rendered content and stored attachments when available; if required attachments are unavailable/expired, resend MUST fail with a clear recorded reason.
- **FR-021b**: If an attachment record exists but the underlying storage object is missing at resend time, the resend MUST fail with a clear “attachment missing in storage” reason and MUST be treated as non-retryable (“poison”).
- **FR-021a**: When resending an SMS, the resend MUST reuse the original rendered SMS text from the original delivery.
- **FR-022**: Only Support/Admin roles MUST be able to perform resend actions, and resend MUST be available from both (a) the customer detail messaging history view and (b) the admin messaging list/detail view.
- **FR-023**: System MUST track delivery lifecycle beyond “attempted send” by ingesting delivery notifications from providers via a public endpoint (no authentication) and updating delivery status accordingly.
- **FR-023c**: Provider delivery notifications/events MUST be recorded as provider events linked to the internal delivery where possible. Provider events MUST NOT change the meaning of internal status terms (e.g., internal `SENT` still means “provider accepted”), but provider events MUST be visible in history as the delivery lifecycle outcome (e.g., delivered/bounced/dropped).
- **FR-023d**: Provider lifecycle events (e.g., delivered, bounce, dropped) MUST be recorded as provider events and MUST extend delivery history rather than replace internal send-attempt status. Internal status MUST continue to represent processing/send-attempt state (e.g., `SENT` = provider accepted the send request), while provider events represent downstream delivery outcomes; both MUST be visible to operators.
- **FR-023e**: If a provider event is received but cannot be mapped to an internal delivery (e.g., delivery has not yet recorded a provider message ID), the system MUST still store the raw provider event for audit and MUST return success. The event MUST be retained with a “unmapped” state for operator investigation and potential later linkage.
- **FR-023f**: Webhook ingestion MUST be idempotent. The system MUST deduplicate provider events using a stable provider-supplied event identifier when available (e.g., SendGrid `sg_event_id`). If a provider does not supply a unique event id, the system MUST define and use a deterministic derived dedupe key (documented per provider) so that replayed notifications do not create duplicate provider-event records or duplicate delivery updates.
- **FR-023g**: Provider events MUST be mapped into a consistent “provider outcome” view for operators, without changing the meaning of internal statuses:
  - Terminal provider outcomes MUST include at minimum: `DELIVERED`, `BOUNCED`, `DROPPED`.
  - Non-terminal/diagnostic provider outcomes MUST include at minimum: `PROCESSED`, `DEFERRED`, `UNKNOWN`.
  - Terminal outcomes MUST be clearly visible in delivery history and delivery detail views, and MUST not be confused with the internal `SENT`/`FAILED` processing statuses.
- **FR-023h**: Provider webhook payload storage MUST follow data-minimization rules while preserving auditability:
  - The system MUST store the provider webhook request body for audit, but MUST NOT store request headers, query strings, or any authentication/signature secrets.
  - Application logs MUST NOT print raw webhook payloads at info/warn/error levels (to avoid unintended PII leakage); only structured metadata (e.g., deliveryId, provider, eventId, correlationId) may be logged.
- **FR-023i**: Malformed webhook payloads MUST be rejected deterministically:
  - If the request body fails validation (wrong shape/required fields missing), the system MUST return `400 Bad Request`.
  - Malformed webhook payloads MUST NOT be stored as provider events.
- **FR-023j**: Out-of-order provider events MUST be handled safely:
  - Provider events MUST be stored append-only as they are received.
  - The operator-visible “provider outcome” MUST be computed deterministically such that terminal outcomes (e.g., `DELIVERED`, `BOUNCED`, `DROPPED`) are never replaced/regressed by later-arriving non-terminal outcomes (e.g., `PROCESSED`, `DEFERRED`).
- **FR-023k**: The webhook endpoint MUST NOT return success unless the payload was stored successfully. If provider-event storage fails (e.g., database unavailable), the endpoint MUST return `500 Internal Server Error` so the provider can retry later.
- **FR-023l**: Provider-specific dedupe and mapping assumptions MUST be documented:
  - For SendGrid: use `sg_event_id` when present; cap processing at 200 events/request per `FR-023b`.
  - For Africa’s Talking: if a stable provider-supplied event id is not available, the system MUST define a derived dedupe key based on stable payload fields (documented during implementation) and MUST still store raw payloads for audit.
- **FR-023a**: Delivery notification endpoints MUST enforce basic rate limiting (per-IP and global) to reduce abuse risk while remaining available for legitimate provider callbacks.
- **FR-023b**: Delivery notification endpoints MUST enforce these constraints:
  - per-IP rate limit: 60 requests/minute
  - global rate limit: 1000 requests/minute
  - SendGrid webhook request payload: if it contains more than 200 event objects, the system MUST store the raw payload for audit, MUST NOT process it further, and MUST still return success
  - when a webhook payload is stored successfully but cannot be mapped to an existing delivery, the endpoint MUST return success and retain the event for later investigation
  - the endpoint MUST return success for any request where the payload was stored successfully; the endpoint MUST return `429 Too Many Requests` **only** when a request is rejected due to rate limiting and the payload was **not** stored
- **FR-024**: System MUST support configurable retry policies per channel (independent limits and timing behavior per channel). By default, SMS max attempts MUST be 2 and Email max attempts MUST be 5. After max attempts, delivery MUST become failed and remain visible in history.
- **FR-024a**: A delivery is eligible for a retry attempt only when all of the following are true:
  - `status` indicates it is waiting for retry (e.g., retry-wait state),
  - `attemptCount` is less than `maxAttempts`,
  - and the current time is at or after `nextAttemptAt`.
- **FR-024b**: Retry delay MUST be computed using exponential backoff with bounded jitter per channel:
  - Each channel MUST define `baseRetryDelaySeconds` and `maxRetryDelaySeconds` via system settings.
  - For attempt number `n` (starting at 1 for the first retry), the retry delay before applying jitter is:
    - `delay = min(maxRetryDelaySeconds, baseRetryDelaySeconds * 2^(n-1))`
  - Jitter MUST be applied such that the final delay is within:
    - `[delay, delay + baseRetryDelaySeconds]`
  - The system MUST record the computed `nextAttemptAt` for each scheduled retry.
- **FR-024c**: The system MUST classify send failures into retryable vs non-retryable categories:
  - **Retryable**: transient/network/provider-availability errors (timeouts, 5xx, rate limit responses where the provider indicates retry is appropriate).
  - **Non-retryable (“poison”)**: permanent errors where retry will not succeed without data/config changes (e.g., invalid recipient address/number format rejected by provider, missing/expired required attachment for email resend, missing required placeholder values, missing template after fallback).
- **FR-024d**: For non-retryable (“poison”) failures, the delivery MUST be marked `FAILED` immediately (no retry), with a clear recorded reason. For retryable failures, the delivery MUST enter `RETRY_WAIT` until eligible, and MUST become `FAILED` once `attemptCount >= maxAttempts`.
- **FR-024e**: Retry scheduling MUST use a consistent time source to avoid clock-skew issues. The system MUST compute eligibility (“now”) using the same authoritative time source used to set and compare `nextAttemptAt` (e.g., database time) and all retry timestamps MUST be stored in UTC.
- **FR-025**: System MUST support centrally managed system settings relevant to messaging (including default messaging language and per-channel retry configuration) and MUST apply changes reliably without redeploy.
- **FR-025a**: The system MUST support configurable worker processing controls for messaging deliveries, including:
  - `workerPollIntervalSeconds` (how frequently the worker checks for eligible deliveries)
  - `workerBatchSize` (maximum number of deliveries claimed per poll cycle)
  - `workerMaxConcurrency` (maximum number of deliveries processed concurrently per worker instance)
- **FR-025b**: Default values MUST be defined for these controls and must be changeable without redeploy.
- **FR-025c**: Retry limits and retry timing parameters MUST be sourced from system settings. Defaults MUST be: `smsMaxAttempts = 2` and `emailMaxAttempts = 5`. Updating these settings MUST change worker behavior for subsequent attempts without redeploy, and each delivery MUST record `attemptCount` and the configured `maxAttempts` used for eligibility decisions.
- **FR-025d**: Default worker processing control values MUST be:
  - `workerPollIntervalSeconds = 5`
  - `workerBatchSize = 50`
  - `workerMaxConcurrency = 10`
- **FR-025e**: Updates to system messaging settings (stored in the system settings tables and cached in memory) MUST take effect system-wide within **2 minutes** without redeploy.
- **FR-025f**: The system MUST make the system-settings cache refresh interval directly configurable via system settings:
  - setting key: `systemSettingsCacheRefreshSeconds`
  - default: `60`
  - constraint: `systemSettingsCacheRefreshSeconds` MUST be `<= 120` to satisfy the propagation SLA in **FR-025e**.
- **FR-025g**: Updating `systemSettingsCacheRefreshSeconds` MUST take effect without redeploy (i.e., the system can tighten/loosen the refresh interval at runtime).
- **FR-026**: If a routed channel is enabled but the customer lacks the required contact detail (phone for SMS, email address for email), system MUST create the delivery and mark it failed immediately with a clear “missing recipient” reason.

## Delivery Status Terminology (Canonical)

- **Delivery (internal)**: MicroBima’s internal record representing one attempted message to one recipient on one channel (SMS or Email).
- **SENT (internal status)**: The delivery was successfully submitted to the provider (provider accepted the send request). SENT does NOT mean the customer received the message.
- **FAILED (internal status)**: The delivery will not be attempted again (max attempts reached or non-retryable failure).
- **RETRY_WAIT (internal status)**: The delivery failed an attempt but is scheduled for retry at `nextAttemptAt`.
- **Provider event (external)**: A webhook/notification from a provider reporting lifecycle outcomes (e.g., delivered, bounced, dropped). Provider events are appended to the delivery’s history and may update a separate “provider outcome” view but do not change the meaning of internal statuses.
- **Stakeholder note**: “SENT” in MicroBima means the provider accepted the send request. It does NOT guarantee the customer received the message. Receipt outcomes are represented by provider events (e.g., delivered/bounced/dropped) which are shown alongside the delivery.

### Key Entities *(include if feature involves data)*

- **Template Key**: Stable identifier representing a business message type (e.g., policy purchased, registration completed).
- **Message Template**: A language-specific and channel-specific template for a template key, containing text and placeholders.
- **Route (Messaging Route)**: Admin-configurable mapping for a template key that determines which channels are enabled.
- **Delivery**: One attempted message to one recipient on one channel, with language selection outcome, rendered content representation, timestamps, and status.
- **Delivery Notification (Provider Event)**: A recorded lifecycle update received after sending (e.g., delivered, bounced), linked to a delivery.
- **Attachment**: A file associated with an email delivery, with metadata (name, type, expiry) and a link to where it is stored.
- **System Messaging Settings**: System-wide defaults (e.g., default language, retry policies) that can be changed by admins and take effect without redeploy.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For supported events, deliveries are created according to routing configuration and visible in admin history within 1 minute of the triggering event.
- **SC-002**: Routing changes made by admins take effect system-wide within 5 minutes without any redeploy.
- **SC-002a**: System messaging settings changes made by admins (e.g., retry policy values, worker controls, default messaging language) take effect system-wide within **2 minutes** without any redeploy.
- **SC-003**: For customers with configured language preferences, at least 95% of customer-targeted deliveries use the preferred language when a matching template exists; otherwise they use the system default language and record the fallback.
- **SC-004**: Originating business workflows (e.g., policy purchase, registration) complete without waiting for message sending/attachment generation/provider callbacks.
- **SC-005**: Admins can locate and view a customer’s message history (including channel, recipient, template key, languages, timestamps, and status) in under 30 seconds for typical customer records.
- **SC-006**: Email resend succeeds when attachments are still retained and fails with a clear reason when attachments have expired or are missing; both outcomes are recorded for audit.
- **SC-006a**: Admins can choose which delivery to resend (SMS or Email) from message history, without automatically resending other channels for the same event.
- **SC-007**: Admins can identify and understand render failures (e.g., missing placeholder data) from the messaging admin dashboard and customer detail history without needing developer access.
- **SC-008**: By default, attachments remain available for resend for 90 days; after expiry, resend is blocked and clearly indicates “attachments expired/missing” in admin views.
