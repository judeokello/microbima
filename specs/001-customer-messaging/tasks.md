# Tasks: Unified Customer Messaging (SMS + Email)

**Input**: Design documents from `specs/001-customer-messaging/`  
**Prerequisites**: `plan.md` (required), `spec.md` (required), `research.md`, `data-model.md`, `contracts/openapi.yaml`, `quickstart.md`  
**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Status (branch `001-customer-messaging`)**: Completed through T047. T048 is manual validation (user-run).  
**GitHub issues**: This repo does not auto-link tasks to issues. To keep issues in sync, close or label issues that correspond to T001–T033 and superseded T035 when you merge; create/label issues for remaining tasks (T034, T036–T048) if you track them in GitHub.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[US#]**: Which user story this task belongs to
- All tasks include exact file paths

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the baseline feature module structure and configuration surfaces in the API

- [x] T001 Create messaging module folder structure in `apps/api/src/modules/messaging/**` per `specs/001-customer-messaging/plan.md`
- [x] T002 Register `MessagingModule` in `apps/api/src/app.module.ts`
- [x] T003 [P] Add environment config placeholders for Africa’s Talking/SendGrid/Supabase in `apps/api/src/config/configuration.service.ts` (do not wire secrets yet)
- [x] T004 [P] Add DTO folder structure for messaging in `apps/api/src/dto/messaging/**`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: DB schema + core services required by ALL user stories

**⚠️ CRITICAL**: No user story work should begin until this phase is complete

- [x] T005 Define Prisma schema changes in `apps/api/prisma/schema.prisma` (new models: `MessagingTemplate`, `MessagingRoute`, `MessagingDelivery`, `MessagingAttachment`, `MessagingProviderEvent`, `SystemSetting`, `SystemSettingsMeta`; plus `Customer.defaultMessagingLanguage`)
- [x] T006 Create Prisma migration in `apps/api/prisma/migrations/*` (via `pnpm prisma migrate dev --name messaging_outbox`)
- [x] T007 Implement `SystemSettingsService` cache + meta `updatedAt` refresh in `apps/api/src/modules/messaging/settings/system-settings.service.ts`
- [x] T008 Implement internal settings endpoints in `apps/api/src/controllers/internal/messaging.controller.ts` (GET/PATCH `/internal/messaging/settings` per `specs/001-customer-messaging/contracts/openapi.yaml`)
- [x] T009 Implement `MessagingTemplate` CRUD service in `apps/api/src/modules/messaging/messaging-templates.service.ts`
- [x] T010 Implement template endpoints in `apps/api/src/controllers/internal/messaging.controller.ts` (GET/POST/PATCH `/internal/messaging/templates` per contract)
- [x] T011 Implement `MessagingRoute` upsert/list service in `apps/api/src/modules/messaging/messaging-routes.service.ts`
- [x] T012 Implement route endpoints in `apps/api/src/controllers/internal/messaging.controller.ts` (GET/PUT `/internal/messaging/routes` per contract)
- [x] T013 Implement `TemplateResolverService` (template key + channel + language selection with fallback) in `apps/api/src/modules/messaging/rendering/template-resolver.service.ts`
- [x] T014 Implement `PlaceholderRendererService` in `apps/api/src/modules/messaging/rendering/placeholder-renderer.service.ts`:
  - infer required placeholders by scanning template content for `{placeholder_key}` tokens
  - validate placeholder keys match `^[a-z0-9_]+$`
  - missing values → FAIL + Sentry + stored error
- [x] T015 Implement `MessagingOutboxRepository` (Prisma queries for claiming rows + status updates) in `apps/api/src/modules/messaging/messaging-outbox.repository.ts`

**Checkpoint**: Foundation ready (schema + settings + template/route config + rendering components)

---

## Phase 3: User Story 1 - Event triggers routed deliveries (Priority: P1) 🎯 MVP

**Goal**: Business events enqueue deliveries fast (non-blocking) using DB routes (SMS/email/both)

**Independent Test**: Trigger one supported event (e.g., `POLICY_PURCHASED`) and verify the API returns without waiting for sending; then verify deliveries exist for enabled channels.

- [x] T016 [US1] Define enqueue interface and payload contract in `apps/api/src/modules/messaging/messaging.types.ts` (templateKey, customerId, optional policyId, placeholder data)
- [x] T017 [US1] Implement `MessagingService.enqueue()` in `apps/api/src/modules/messaging/messaging.service.ts` (reads route + settings snapshot, creates one delivery per enabled channel)
- [x] T018 [US1] Integrate enqueue call into one real trigger point (start with policy purchase) in `apps/api/src/services/**` (choose the actual purchase completion location)
- [x] T019 [US1] Ensure missing recipient details create-and-fail delivery records (phone/email missing) in `apps/api/src/modules/messaging/messaging.service.ts`
- [x] T020 [US1] Add internal delivery list/get endpoints in `apps/api/src/controllers/internal/messaging.controller.ts` (GET `/internal/messaging/deliveries`, GET `/internal/messaging/deliveries/{deliveryId}`)

**Checkpoint**: US1 complete (deliveries are created correctly and visible in admin history endpoints)

---

## Phase 4: User Story 2 - Templates render in right language with fallback (Priority: P2)

**Goal**: Deliveries select templates by language preference with system fallback; missing templates fail clearly.

**Independent Test**: Customer `defaultMessagingLanguage=sw` with only `en` templates → delivery uses `en` and records requested/used languages.

- [x] T021 [US2] Add `Customer.defaultMessagingLanguage` read/write paths in `apps/api/src/services/customer.service.ts` and related DTOs (where customer updates are handled)
- [x] T022 [US2] Implement language selection + persistence fields on deliveries (`requestedLanguage`, `usedLanguage`) in `apps/api/src/modules/messaging/messaging.service.ts`
- [x] T023 [US2] Ensure “template missing after fallback” marks delivery as FAILED with clear reason in `apps/api/src/modules/messaging/rendering/template-resolver.service.ts`
- [x] T024 [US2] Ensure placeholder render failures are stored + reported to Sentry in `apps/api/src/modules/messaging/rendering/placeholder-renderer.service.ts`
- [x] T025 [US2] Add admin-visible error fields to delivery DTOs in `apps/api/src/dto/messaging/**` (renderError/lastError/etc.)

**Checkpoint**: US2 complete (language + fallback + render failure visibility is deterministic and auditable)

---

## Phase 5: User Story 3 - Resend a specific delivery (Priority: P2)

**Goal**: Support/Admin can resend a selected delivery (SMS or Email) with correct reuse rules and traceability.

**Independent Test**: For an event with SMS+Email deliveries, resend only SMS → only SMS resent; resend email → reuse stored attachments when available.

- [x] T026 [US3] Implement resend endpoint `POST /internal/messaging/deliveries/{deliveryId}/resend` in `apps/api/src/controllers/internal/messaging.controller.ts` with Support/Admin RBAC
- [x] T027 [US3] Implement `MessagingService.resendDelivery()` in `apps/api/src/modules/messaging/messaging.service.ts` (creates new linked delivery; does not auto-resend other channels)
- [x] T028 [US3] Implement “reuse original rendered SMS text” behavior for SMS resend in `apps/api/src/modules/messaging/messaging.service.ts`
- [x] T029 [US3] Implement “reuse original rendered email content” behavior for email resend in `apps/api/src/modules/messaging/messaging.service.ts`

**Checkpoint**: US3 complete (resend creates a new delivery linked to original with correct channel-specific reuse rules)

---

## Phase 6: User Story 4 - Admins can view history and delivery lifecycle (Priority: P3)

**Goal**: Admin/support can view delivery history (per customer, optionally by policy) and see lifecycle updates from provider notifications.

**Independent Test**: Create deliveries, send webhooks, and see delivery status + provider events reflected in history.

- [x] T030 [US4] Implement `MessagingWorker` scheduled processor in `apps/api/src/modules/messaging/messaging.worker.ts` (claim rows atomically; update status; compute retries w/ jitter)
- [x] T031 [US4] Implement provider send adapters:
  - SMS: `apps/api/src/modules/messaging/providers/sms-africas-talking.service.ts`
  - Email: `apps/api/src/modules/messaging/providers/email-smtp.service.ts` (SMTP via nodemailer; SendGrid removed)
- [x] T032 [US4] Implement Supabase attachment persistence service in `apps/api/src/modules/messaging/attachments/attachment.service.ts` (folder per delivery; expiry; local dev + Supabase staging/prod)
- [x] T033 [US4] Implement member-card filename in `apps/api/src/modules/messaging/attachments/attachment-generator.service.ts` (simplified format; full sanitization/collision optional later)
- [x] T034 [US4] Implement attachment endpoints in `apps/api/src/controllers/internal/messaging.controller.ts` (list/download for delivery attachments) per contract
- [x] ~~T035 [US4] SendGrid webhook~~ **Superseded**: SendGrid removed; email uses SMTP (no delivery webhooks).
- [x] T036 [US4] Implement public Africa’s Talking webhook controller in `apps/api/src/controllers/webhooks/messaging/africas-talking-webhook.controller.ts`:
  - store raw payload for audit
  - best-effort extraction/linking
  - always return 200 after storing, even if it cannot be mapped to a delivery
- [x] T037 [US4] Rate limiting for messaging webhooks (60/min per IP) in `apps/api/src/controllers/webhooks/messaging/**`:
  - per-IP: 60 requests/minute
  - global: 1000 requests/minute (best-effort per API instance)
  - when throttled (payload not stored), return `429 Too Many Requests` (optionally with `Retry-After`)
- [x] T038 [US4] Webhook idempotent; do not regress terminal outcomes in `apps/api/src/controllers/webhooks/messaging/**`

**Checkpoint**: US4 complete (history views + lifecycle events + worker sending are end-to-end coherent)

---

## Phase 7: Admin UI (Agent Registration Admin)

**Purpose**: Deliver the admin-facing messaging list/dashboard and customer detail messaging tab per clarified scope.

- [ ] T039 Add “Messages” nav entry in `apps/agent-registration/src/app/(main)/admin/layout.tsx` linking to `/admin/messages`
- [x] T040 Add messaging API client functions in `apps/agent-registration/src/lib/api.ts`:
  - list deliveries with filters (customer, policy, channel, status, pagination)
  - get delivery by id
  - resend delivery (Support/Admin only)
- [x] T041 Implement admin messages list/dashboard page in `apps/agent-registration/src/app/(main)/admin/messages/page.tsx`:
  - filters: customer, optional policy, channel, status
  - row fields: recipient, templateKey, requested/used language, timestamps, status, lastError/renderError
  - actions: view details, resend selected delivery/channel (Support/Admin only)
- [x] T042 Implement admin message detail page in `apps/agent-registration/src/app/(main)/admin/messages/[deliveryId]/page.tsx` (shows rendered content + lifecycle + resend action)
- [x] T043 Implement customer detail messaging tab component in `apps/agent-registration/src/app/(main)/customer/[customerId]/_components/messaging-tab.tsx` (list deliveries for that customer + resend + error visibility)
- [x] T044 Wire the Messaging tab into admin customer detail page in `apps/agent-registration/src/app/(main)/admin/customer/[customerId]/page.tsx`

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Hardening, docs, and operational readiness

- [x] T045 [P] Add seed defaults for messaging settings (language `en`, retries SMS=2 Email=5, retention history=7y attachments=90d) in `apps/api/src/modules/messaging/settings/system-settings.service.ts` (or a bootstrap script if one exists)
- [x] T046 Implement scheduled attachment retention cleanup job in `apps/api/src/modules/messaging/attachments/**`:
  - find expired attachments (`expiresAt <= now`) not yet deleted
  - delete objects from Supabase Storage
  - mark attachment records as deleted/expired for audit visibility
- [x] T047 Add documentation notes for operations/support in `specs/001-customer-messaging/quickstart.md` (keep it aligned with actual endpoints)
- [ ] T048 [Manual] Run the manual validation steps in quickstart.md and record any spec/plan deltas in spec.md/plan.md

---

## Phase 9: Dev/Staging Enhancements

**Purpose**: Improve testing ergonomics for development and staging environments

- [x] T049 [P] Make environment banner sticky at top when scrolling in `apps/agent-registration/src/components/environment-indicator.tsx`
- [x] T050 Implement messaging recipient override in dev/staging: when NODE_ENV is development or staging and policy is created via web UI, redirect SMS/email to the current logged-in user's phone/email instead of the customer's
  - Extend `EnqueueMessageRequest` in `apps/api/src/modules/messaging/messaging.types.ts` with optional `overrideRecipientPhone`, `overrideRecipientEmail`
  - Use overrides in `MessagingService.enqueue()` when provided and env is dev/staging
  - Add `messagingOverride` param to `PolicyService.createPolicyWithPayment()` and pass to `enqueuePolicyPurchaseMessage`
  - In `PolicyController.createPolicy()`, inject `@Req() req`, resolve current user email (from `req.user`) and phone (from `PartnerManagementService.getBrandAmbassadorByUserId` when user is BA), pass as override when NODE_ENV is development or staging
  - Uncomment `enqueuePolicyPurchaseMessage` call in `PolicyService.createPolicyWithPayment`

---

## Phase 10: user_metadata.phone + Messaging Override Refactor

**Purpose**: Populate and sync `user_metadata.phone` for all auth users; refactor messaging override so the web app passes override from session (no API user lookup).

**Part A: user_metadata.phone**

- [x] T051 Add `phone` to Supabase user creation in `createBrandAmbassador` in `apps/api/src/services/partner-management.service.ts` (pass `phone: brandAmbassadorData.phoneNumber` in `userMetadata`)
- [x] T052 In `createBrandAmbassadorFromExistingUser`, after creating the BA record, call `supabase.auth.admin.updateUserById` to set `user_metadata.phone` when `phoneNumber` is provided (merge with existing metadata)
- [x] T053 In `updateBrandAmbassador`, when `updateData.phoneNumber` is provided, sync to Supabase: fetch current user metadata, merge `phone`, call `updateUserById`
- [x] T054 In `updateBrandAmbassador`, when updating roles only, preserve existing `user_metadata.phone` in `updatedMetadata`
- [x] T055 Add optional `phone` to bootstrap user creation in `apps/api/src/controllers/internal/bootstrap.controller.ts` (body + `userMetadata`)
- [x] T056 Create backfill script `apps/api/scripts/backfill-user-metadata-phone.ts`: for each `brand_ambassadors` row with `phoneNumber`, update Supabase user `user_metadata.phone` (merge with existing). Document env/usage.

**Part B: Messaging override from client**

- [x] T057 Add `messagingOverride?: { phone?: string; email?: string }` to `CreatePolicyRequestDto` in `apps/api/src/dto/policies/create-policy.dto.ts`
- [x] T058 Refactor `PolicyController.createPolicy`: remove `@Req()`, `PartnerManagementService`; read `messagingOverride` from `createRequest`; use only when `NODE_ENV` is development or staging; pass to `createPolicyWithPayment`
- [x] T059 In agent-registration (e.g. `register/payment/page.tsx` and any other `createPolicy` callers): when hostname is localhost or staging, set `messagingOverride: { email: user.email, phone: user_metadata?.phone }` on the create-policy payload

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: start immediately
- **Foundational (Phase 2)**: blocks all user stories
- **US1 (P1)**: depends on Phase 2 only → MVP
- **US2/US3 (P2)**: depend on Phase 2; US3 also benefits from US1 having created deliveries
- **US4 (P3)**: depends on Phase 2; meaningful end-to-end value once US1 exists
- **Admin UI (Phase 7)**: depends on internal messaging endpoints being available (US1 + resend)
- **Polish (Phase 8)**: after desired user stories

### User Story Dependencies

- **US1**: requires Phase 2
- **US2**: requires Phase 2 and customer language field available (Phase 2)
- **US3**: requires Phase 2; most useful after US1 generates deliveries
- **US4**: requires Phase 2; worker/provider/webhooks can be built in parallel with US2/US3 after US1 exists

### Parallel Opportunities

- In Phase 2, tasks marked **[P]** can be done concurrently (different files/services).
- After Phase 2, the bulk of US2/US3/US4 can be parallelized across separate areas (rendering vs worker vs webhooks vs attachments).

---

## Parallel Example: After Foundational

```text
Developer A: US1 enqueue + deliveries list endpoints (T016–T020)
Developer B: US2 language + fallback + render error surfacing (T021–T025)
Developer C: US4 worker + providers + webhooks (T030–T038)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 + Phase 2
2. Complete US1 (Phase 3)
3. Validate via `specs/001-customer-messaging/quickstart.md` steps 1–3 (enqueue + history visibility)

### Incremental Delivery

1. US1 → enqueue + history visibility
2. US2 → deterministic language/template selection + render failure rules
3. US3 → resend per selected delivery/channel
4. US4 → worker sending + attachments + provider lifecycle via webhooks

