# Feature Specification: Admin Messaging Campaigns

**Feature Branch**: `004-admin-messaging-campaigns`  
**Created**: 2026-08-08  
**Status**: Draft  
**Input**: User description: "Admin messaging campaigns from docs/proposals/admin-messaging-campaigns.md — compose/send SMS and email campaigns to scheme customers, scheme contacts, and pasted lists with placeholders, preview, safety delay/cancel, campaign audit; separate template edit/save for non-campaign templates."  
**Intake source**: [docs/proposals/admin-messaging-campaigns.md](../../docs/proposals/admin-messaging-campaigns.md)

## Clarifications

### Session 2026-08-08

- Q: What must the admin type for send confirmation when recipient count is at or above the threshold? → A: The exact campaign name
- Q: When preflight finds blocking errors, is a campaign history record saved? → A: Only if the admin clicks Send and preflight fails then; preview CSVs are session-only until Send
- Q: What does “delivered” mean on campaign progress? → A: Show both handed-off-to-provider count and receipt-confirmed count
- Q: Maximum sendable recipients per campaign? → A: Warn at 5,000; allow send (no hard cap in MVP)
- Q: Campaign status when some messages fail at the provider? → A: Terminal status “Completed with failures” when dispatch finished and any delivery failed
- Q: Empty campaign content allowed? → A: Require non-empty SMS body; non-empty email subject and body (block preview/send if empty)
- Q: Malformed pasted phones/emails? → A: Soft-skip invalid paste lines; continue if ≥1 sendable remains
- Q: Inactive schemes in audience pickers? → A: Show both active and inactive; inactive not selectable
- Q: Campaign name after failed preflight? → A: Rename failed-preflight campaign to `{original}_failedX` (X auto-incrementing) so the original name can be reused
- Q: Inactive packages in the package filter? → A: Show both; only active packages selectable

### Session 2026-08-08 (analyze remediations)

- Q: Empty rich-text email body definition? → A: Empty if plain text after stripping tags/entities trims to length 0
- Q: Deterministic preview sample order? → A: Sort sendable by (customerId, policyId, normalizedAddress) nulls last; take first
- Q: Campaign API error shape? → A: Use ValidationException, ErrorCodes, `status` (not statusCode), correlationId
- Q: Phone/email normalization? → A: Phone via existing util to 254…; email trim + lowercase
- Q: UI automated tests for pills/colors? → A: API/domain TDD only; UI via Independent Test + quickstart
- Q: Edit campaign during DELAYED? → A: Immutable after Send; cancel + recreate only
- Q: Rich-text editor library? → A: TipTap
- Q: HTML sanitization as product requirement? → A: Yes — server-side sanitize before persist/send (FR-010a)
- Q: SC-001 timing vs send delay? → A: 5-minute clock is compose → preview → confirm → DELAYED created; excludes waiting out the delay and dispatch
- Q: Idempotency-Key header? → A: Optional client header; same key returns existing campaign; still enforce name+body+audience window
- Q: Email receipt-confirmed count without provider receipts? → A: May remain 0 for EMAIL when no delivery-receipt webhook; handed-off still increments

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Compose and send an SMS campaign (Priority: P1)

As a registration admin, I open Campaigns → Compose on the SMS tab, write an ad hoc message (with optional placeholders), select one or more audience modes (schemes, scheme contacts, pasted phones), preview who will receive it and how it will look for a sample recipient, confirm if the audience is large, then send. The campaign waits for a short configurable delay so I can cancel if I made a mistake, then messages go out. Each customer-linked send appears on that customer’s Messages history.

**Why this priority**: Core value of the feature—safe, auditable bulk SMS to real audiences.

**Independent Test**: Create an SMS campaign to one scheme with a short body and `{first_name}`; complete preview and send; verify delay, deliveries, and customer Messages tab entry for a linked customer.

**Acceptance Scenarios**:

1. **Given** I am a registration admin on Campaigns → Compose (SMS), **When** I enter a unique campaign name and message body and select at least one audience mode, **Then** I can run preview and see total recipient count and a sample rendered message.
1a. **Given** the SMS body is empty (or email subject/body is empty on Email), **When** I attempt preview or send, **Then** the action is blocked with a clear validation error.
2. **Given** scheme customers are included in the audience, **When** I have not selected at least one customer status, one policy status, and one package, **Then** preview/send is blocked until those filters are set.
3. **Given** preview shows a sendable count at or above the confirmation threshold (default 20), **When** I attempt to send without typing the exact campaign name, **Then** send is refused until I type the exact campaign name to confirm.
4. **Given** I confirm send, **When** the SMS delay window is active (default 2 minutes), **Then** I see a countdown and can cancel the campaign before any provider handoff.
5. **Given** the delay elapses without cancel, **When** dispatch runs, **Then** one message delivery is created per unique phone + resolved message content, and customer-linked deliveries appear on the Customer Messages tab.
6. **Given** a pasted phone matches a customer, **When** the campaign is sent, **Then** the delivery is linked to that customer; if not matched, the delivery is still sent without a customer link.

---

### User Story 2 - Compose and send an email campaign (Priority: P1)

As a registration admin, I use the Email tab to compose an HTML email with a subject (placeholders allowed), select email-appropriate audiences (schemes, scheme contacts, pasted emails—not phones), preview, confirm if needed, and send after an email-specific delay (default 3 minutes).

**Why this priority**: Same campaign capability for email; channel purity avoids mixing phones and emails.

**Independent Test**: Send an email campaign to scheme contacts with subject and HTML body; verify skips for contacts without email, soft-skip report, and successful deliveries for those with email.

**Acceptance Scenarios**:

1. **Given** I am on the Email compose tab, **When** I look for phone-list audience, **Then** it is not available; pasted email list is available.
2. **Given** I compose subject and HTML body with placeholders, **When** I preview, **Then** I see a sample rendered subject/body with color-linked resolved placeholders and recipient counts.
3. **Given** some audience members have no email, **When** I preview or send, **Then** they appear on the soft-skip report/CSV and do not block the campaign if at least one sendable recipient remains.
4. **Given** every recipient is soft-skipped, **When** I try to send, **Then** send is blocked with a clear message and skipped CSV.
5. **Given** the same normalized email would receive identical resolved content from overlapping audience modes, **When** the campaign dispatches, **Then** only one email is sent to that address.

---

### User Story 3 - Preflight blocks bad data with downloadable CSV (Priority: P1)

As a registration admin, if any intended recipient cannot resolve a required placeholder (or pasted identity lacks data needed for those placeholders), the whole campaign is blocked before any messages are created for sending. I download a CSV listing who failed and why so data can be fixed and the campaign retried.

**Why this priority**: Prevents partial/incorrect mass communication and makes data gaps actionable.

**Independent Test**: Include `{policy_number}` with an audience member who has no matching policy under filters; verify block, no deliveries created for sending, error CSV columns, and that soft skips alone do not trigger the same hard block path.

**Acceptance Scenarios**:

1. **Given** at least one candidate fails placeholder resolution, **When** I preview, **Then** no campaign history record is saved, no deliveries are created for sending, and I can download an error CSV in the compose session (name, phone and/or email, customer ID, error).
2. **Given** at least one candidate fails placeholder resolution and I chose campaign name `Spring Promo`, **When** I click Send, **Then** a failed-preflight campaign record is saved renamed to `Spring Promo_failed1` (or next free `_failedX`), with downloadable error CSV on campaign detail, no deliveries are created for sending, error monitoring receives recreate/troubleshoot detail, and the name `Spring Promo` remains available for a retry; soft skips do not create such alerts.
3. **Given** only soft skips (e.g. missing email) and at least one valid recipient, **When** I send, **Then** the campaign proceeds and soft-skip CSV remains available on campaign detail.

---

### User Story 4 - Cancel during delay or after dispatch starts (Priority: P2)

As a registration admin (not only the creator), I can cancel a campaign during the delay countdown or after dispatch has started so that remaining not-yet-handed-off messages are cancelled, while messages already handed to the provider are left alone.

**Why this priority**: Primary safety net against accidental sends.

**Independent Test**: Start a campaign, cancel during delay (no deliveries sent); start another, allow dispatch to begin, cancel, and verify only not-yet-sent items are cancelled.

**Acceptance Scenarios**:

1. **Given** a campaign is in the delay window, **When** any registration admin cancels, **Then** no provider sends occur for that campaign.
2. **Given** dispatch has started, **When** any registration admin cancels, **Then** remaining not-yet-sent deliveries are cancelled and already-handed-off deliveries are unchanged.
3. **Given** a cancelled campaign, **When** I view campaign history, **Then** cancel time and cancelling admin are visible in the audit trail.
4. **Given** dispatch has finished and at least one delivery failed while others succeeded or were cancelled, **When** I view the campaign, **Then** its terminal status is “Completed with failures”.

---

### User Story 5 - View campaign history and audit (Priority: P2)

As a registration admin or customer care user, I browse campaigns that were sent or attempted, open a campaign to see audience snapshot, content (including pre-render body with placeholders), counts, status, and audit events, and download error/skip CSVs when present.

**Why this priority**: Accountability and support without granting compose rights to customer care.

**Independent Test**: As customer care, open Campaigns → History, open a completed campaign, verify read-only access and no compose/send controls.

**Acceptance Scenarios**:

1. **Given** I am customer care, **When** I open Campaigns → History, **Then** I can list and view campaign detail and CSVs but cannot compose or send.
2. **Given** a campaign was sent, **When** I open its detail, **Then** I see name, channel, content snapshot with placeholders, audience segmentation, creator, timing, targeted count, handed-off-to-provider count, and receipt-confirmed count.
3. **Given** Send was attempted and preflight had errors or skips, **When** I open that campaign’s detail, **Then** the corresponding CSVs are downloadable; preview-only preflight without Send does not create a history row.

---

### User Story 6 - Edit existing system templates (not campaigns) (Priority: P2)

As a registration admin, I use a separate Templates experience to select a non-campaign system template, edit its content, and save. I cannot send a campaign from that experience. Campaign compose never offers event/system template keys for bulk send—only the two ad hoc campaign shells.

**Why this priority**: Needed operational control over automated-message copy, kept strictly separate from bulk send to avoid misuse.

**Independent Test**: Edit a non-campaign template and save; verify campaign compose still only allows the ad hoc SMS/email campaign shells and Templates UI never offers campaign send.

**Acceptance Scenarios**:

1. **Given** I am in Templates, **When** I list templates, **Then** campaign ad hoc shells are not listed for editing as saveable campaign templates.
2. **Given** I select a system template, **When** I edit and save, **Then** subsequent automated messages using that template use the updated content.
3. **Given** I am in Campaigns → Compose, **When** I compose a campaign, **Then** I can only send via the SMS or email ad hoc campaign shells, and those compositions are not saved back as reusable template content (audit/campaign store the snapshot instead).

---

### User Story 7 - Deduped multi-scheme and multi-policy messaging (Priority: P3)

As a registration admin, when I select multiple schemes I reach the union of members. A person matching multiple policies under my filters becomes one candidate per matching customer–policy pair; after resolving placeholders, identical messages to the same phone or email are sent once, while different resolved content is sent separately (e.g. scheme- or policy-specific copy).

**Why this priority**: Correctness for overlapping memberships without accidental double-identical spam.

**Independent Test**: Member in two schemes with identical resolved SMS → one send; same member with differing resolved content (e.g. different policy numbers in body) → two sends.

**Acceptance Scenarios**:

1. **Given** multi-scheme union audience and a body with no differing per-scheme/policy values for a member, **When** dispatch runs, **Then** that phone/email receives one message.
2. **Given** a customer has two policies matching filters and the body includes policy-specific placeholders that resolve differently, **When** dispatch runs, **Then** two messages are sent to that customer’s channel address.
3. **Given** overlapping scheme-customer and scheme-contact modes resolve to the same address and identical content, **When** dispatch runs, **Then** only one send occurs (no extra exclusivity rule beyond address + content sameness).

---

### Edge Cases

- Audience is only scheme contacts and/or pasted lists: customer status, policy status, and package filters are hidden and not required.
- Scheme contact has two phones (SMS): both are candidates; each may resolve to a customer when possible.
- Scheme contact is also a customer: link customer when phone/email matches; email may go to both contact email and customer email only when normalized addresses differ.
- Test users are included in scheme-customer audiences.
- Campaign name must be globally unique forever (case-insensitive), including cancelled campaigns.
- Failed-preflight campaigns are renamed to `{original}_failedX` (`X` auto-incrementing) so the original name can be reused for a corrected retry.
- Accidental double submit: same campaign identity, or same name + body + audience within the idempotency window (default 10 minutes), must not create a duplicate send.
- Typed confirmation (when required) means typing the exact campaign name.
- Preview preflight CSVs are session-only; a campaign history row (including failed-preflight) is created only when the admin clicks Send.
- At or above 5,000 sendable recipients, show a large-audience warning; do not hard-block send in this release.
- After dispatch finishes with any delivery failures, campaign status is “Completed with failures” (not a generic Completed-only or total Failed).
- Non-production environments: customer-linked campaign messages continue to follow the existing redirect-to-creator behavior.
- Dependants and beneficiaries are not selectable audiences.
- Hand-picking individual scheme members is out of scope.
- Email attachments on campaigns are out of scope.
- Campaign language is English only for this release.
- Empty SMS body, or empty email subject/body, blocks preview and send.
- Malformed pasted phone/email lines are soft-skipped (not a whole-campaign block) unless no sendable recipients remain.
- Scheme pickers show active and inactive schemes; only active schemes can be selected for a campaign audience.
- Package pickers show active and inactive packages; only active packages can be selected for campaign filters.
- Email body emptiness: strip HTML tags and decode entities, then trim; length 0 ⇒ empty (blocks preview/send).
- Preview sample: among sendable candidates, sort by customerId ASC (nulls last), policyId ASC (nulls last), normalized address ASC; take first.
- Phones normalized with existing MSISDN util (canonical `254…`); emails trimmed and lowercased before match, dedupe, and recipient storage.
- After successful Send, campaign content and audience are immutable; admin may cancel and create a new campaign only.
- Optional `Idempotency-Key` on Send returns the existing campaign for the same key; name+body+audience window still applies.
- EMAIL receipt-confirmed count may stay 0 when the email provider does not emit delivery receipts; handed-off count still applies.

## Requirements *(mandatory)*

### Functional Requirements

#### Access & surfaces

- **FR-001**: Registration admins MUST be able to access Campaigns → Compose, Campaigns → History, and Templates.
- **FR-002**: Customer care MUST be able to access Campaigns → History (read-only) and MUST NOT compose, send, cancel, or edit templates.
- **FR-003**: Campaign compose MUST present separate SMS and Email channel experiences with channel-pure audiences (phones only on SMS; emails only on Email).
- **FR-004**: Templates experience MUST be separate from campaign compose and MUST NOT offer campaign send.

#### Campaign compose & content

- **FR-005**: SMS campaigns MUST use only the ad hoc SMS campaign shell; email campaigns MUST use only the ad hoc email campaign shell.
- **FR-006**: Ad hoc campaign content (SMS body; email subject and HTML body) MUST NOT be saved as reusable template content; the campaign and audit MUST store the snapshot that was sent/attempted.
- **FR-007**: Users MUST be able to insert placeholders from a catalog into the composer as removable pills.
- **FR-008**: Placeholder catalog MUST include standard customer fields and, when policy context exists, policy fields (e.g. policy number, product name).
- **FR-009**: Email compose MUST require an editable subject; placeholders MUST be allowed in subject and body; subject MUST NOT be pre-filled for ad hoc campaigns.
- **FR-009a**: SMS campaigns MUST require a non-empty body. Email campaigns MUST require a non-empty subject and a non-empty body. An email body is empty when, after stripping HTML tags and decoding entities, the trimmed plain text length is 0 (e.g. `<p></p>`, `<p><br></p>`, `&nbsp;` count as empty). Preview and send MUST be blocked with a clear validation error when required content is empty.
- **FR-010**: Email compose MUST support rich text / HTML body editing (TipTap in the admin portal).
- **FR-010a**: Before persist/preview-render/send, email HTML MUST be sanitized server-side with an allowlist that strips scripts and event handlers while allowing common rich-text tags.
- **FR-011**: SMS compose MUST show character and segment counts for display only (no maximum enforcement, no warning threshold).
- **FR-012**: Campaign language for compose/send in this release MUST be English only (`requestedLanguage` / `usedLanguage` = `en` on campaign deliveries).
- **FR-013**: Campaign name MUST be required and globally unique forever (case-insensitive), including cancelled campaigns.
- **FR-013a**: When Send is blocked by failed preflight, the saved campaign MUST be renamed by appending `_failedX` to the original name, where `X` is an auto-incrementing integer (starting at 1) chosen so the resulting name remains unique (e.g. `Spring Promo_failed1`, then `Spring Promo_failed2` on a later failure of another attempt that used the same original name). The original name MUST then be available for a new campaign.

#### Audience & filters

- **FR-014**: SMS audience modes MUST include scheme customers (one or more schemes), scheme contacts, and pasted phone list; modes MUST be combinable.
- **FR-015**: Email audience modes MUST include scheme customers (one or more schemes), scheme contacts, and pasted email list; modes MUST be combinable; phone list MUST NOT be available on Email.
- **FR-016**: Multi-scheme selection MUST use the union of enrolled customers across selected schemes (then dedupe per FR-022).
- **FR-017**: Scheme customer selection MUST be whole-scheme only (no individual member picker).
- **FR-017a**: Scheme pickers MUST list both active and inactive schemes for visibility, but inactive schemes MUST NOT be selectable for campaign audiences.
- **FR-018**: When scheme-customer (customer–policy) audience is included, customer status, policy status, and package filters MUST each require at least one selected value before preview/send; when that audience is not included, those filters MUST be hidden and not required.
- **FR-018a**: Package pickers MUST list both active and inactive packages for visibility, but inactive packages MUST NOT be selectable for campaign filters.
- **FR-019**: Test users MUST be included when scheme-customer audiences are used.
- **FR-020**: Scheme contacts without a usable channel address MUST be soft-skipped; SMS MUST consider both phone fields when present.
- **FR-021**: Pasted phones/emails MUST resolve to a customer when identity matches; if not matched, send MAY proceed without a customer link.
- **FR-021a**: Invalid paste lines (unparseable/malformed phone or email) MUST be soft-skipped with a reason on the soft-skip report/CSV and MUST NOT block the campaign when at least one sendable recipient remains. If every recipient is invalid or otherwise skipped, FR-026 applies (block send).
- **FR-021b**: Before match, dedupe, and recipient storage, phones MUST be normalized via the existing MSISDN utility to canonical `254…` form, and emails MUST be trimmed and lowercased.

#### Expansion, dedupe, skip, block

- **FR-022**: When customer–policy audience is included, the system MUST expand to one candidate per matching customer–policy pair under selected filters, then dedupe by normalized channel address plus sameness of fully resolved content.
- **FR-023**: Identical resolved content to the same phone (SMS) or email (Email) MUST result in a single send; differing resolved content MUST result in separate sends.
- **FR-024**: Missing or unresolvable required placeholders for any candidate MUST block the entire campaign (no messages created for sending), produce a downloadable error CSV, and alert error monitoring with recreate/troubleshoot context.
- **FR-025**: Soft skips (missing channel address) MUST NOT block the campaign when at least one sendable recipient remains; they MUST appear on a soft-skip report/CSV and MUST NOT alert error monitoring.
- **FR-026**: If zero sendable recipients remain after skips, send MUST be blocked with a clear message and skipped CSV.
- **FR-027**: Error and soft-skip CSVs MUST be downloadable during compose preview (session-only, no campaign history row). After the admin clicks Send, CSVs MUST also be available on the saved campaign detail (including failed-preflight campaigns when Send was blocked).
- **FR-027a**: A campaign history record MUST be created when the admin clicks Send. If preflight then fails (blocking errors or zero sendable recipients), the record MUST be saved in a failed-preflight state with no deliveries for sending. Preview alone MUST NOT create a campaign history record.
- **FR-028**: CSV rows MUST include customer name (when known), phone and/or email, customer ID (when known), and the specific error or skip reason.

#### Preview & safety

- **FR-029**: Preview MUST show total sendable recipient count after expansion/dedupe/skip rules, per-scheme recipient count pills when schemes are selected, and a deterministic sample render for the first fitting (sendable, not soft-skipped) recipient. Selection MUST sort candidates by `customerId` ASC (nulls last), then `policyId` ASC (nulls last), then normalized address ASC, and take the first.
- **FR-030**: Preview MUST highlight resolved placeholder values with colors matched to the corresponding pills in the composer.
- **FR-031**: If sendable count is at or above the configurable confirmation threshold (default 20), the admin MUST type the exact campaign name to confirm before send.
- **FR-031a**: If sendable count is at or above 5,000, the UI MUST show a large-audience warning. Send remains allowed (no hard cap in this release) subject to FR-031 confirmation rules.
- **FR-032**: After confirm, SMS campaigns MUST wait a configurable delay (default 2 minutes) and email campaigns a configurable delay (default 3 minutes), with visible countdown, before dispatch.
- **FR-032a**: After Send succeeds (campaign is `DELAYED` or later), campaign content and audience MUST be immutable. The admin MAY cancel and create a new campaign; there is no edit-in-place during the delay.
- **FR-033**: Any registration admin MUST be able to cancel during the delay window (no provider handoff) and after dispatch has started (cancel remaining not-yet-sent only; already-handed-off unchanged).
- **FR-033a**: When dispatch has finished and at least one delivery failed (provider rejection or send failure) while the campaign is otherwise done, the campaign terminal status MUST be “Completed with failures”. Full success MUST be “Completed”; cancel-with-no-handoffs or cancel-after-partial-handoff MUST remain distinguishable as cancelled (with progress counts reflecting what was handed off).
- **FR-034**: The system MUST prevent accidental double-send for the same campaign identity, and for the same name + body + audience within a configurable idempotency window (default 10 minutes). Clients MAY send an optional `Idempotency-Key` header on Send; a repeated key MUST return the existing campaign without creating a second dispatch. The name+body+audience window still applies.
- **FR-034a**: Campaign APIs MUST use the platform standardized error envelope: `ValidationException` for validation/preflight errors, reuse existing `ErrorCodes` where applicable, `status` (not `statusCode`), and `correlationId` on error responses.

#### History, deliveries, templates, settings

- **FR-035**: Each campaign MUST persist audience segmentation snapshot, content snapshot (with placeholders), template/shell identity, creator, key timestamps, status, and audit events sufficient to answer who sent what to which audience definition and when.
- **FR-036**: Individual message deliveries from a campaign MUST appear in the existing per-customer Messages history when linked to a customer.
- **FR-037**: Campaign progress MUST show targeted count, handed-off-to-provider count (successfully accepted by the SMS/email provider), and receipt-confirmed count (provider delivery receipt indicates reached device/inbox). Both progress counts MUST be visible on campaign detail. For EMAIL, when no delivery-receipt webhook/signal exists, receipt-confirmed MAY remain 0 while handed-off still increments on successful provider accept.
- **FR-038**: Templates experience MUST allow registration admins to edit and save existing non-campaign system templates; saving MUST update content used by automated messages for that template.
- **FR-039**: Confirmation threshold, SMS delay, email delay, and idempotency window MUST be configurable via existing system settings mechanisms with the stated defaults.
- **FR-040**: In non-production environments, customer-linked campaign messages MUST continue to follow the existing recipient-redirect behavior used for other customer messages.
- **FR-041**: Campaign email attachments are out of scope for this release.

### Key Entities

- **Campaign**: Named bulk send attempt on one channel (SMS or email), created when Send is clicked, with ad hoc content snapshot, audience definition snapshot, status lifecycle (including delayed, dispatching, completed, completed with failures, cancelled, failed preflight), targeted / handed-off / receipt-confirmed counts, and audit trail.
- **Audience definition**: Combinable modes (scheme customers, scheme contacts, pasted list), selected schemes/packages/statuses when applicable, and list digests.
- **Campaign candidate / delivery**: A single intended or actual send to one channel address, optionally linked to customer and policy, with resolved content; subject to skip, block, dedupe, cancel, or send.
- **Preflight report**: Blocking errors and soft skips exportable as CSV at preview and on campaign detail.
- **System message template**: Editable automated-message content (non-campaign); distinct from ad hoc campaign shells.
- **Placeholder**: Named token in content replaced from customer/policy/support data for preview and send.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A registration admin can complete compose → preview → confirm → successful Send that creates a `DELAYED` SMS campaign for a single scheme in under 5 minutes of active work for audiences under the confirmation threshold. The 5-minute clock excludes waiting out the configured send delay and excludes dispatch/provider delivery time.
- **SC-002**: 100% of campaigns with any unresolvable required placeholder are blocked with zero provider handoffs for that attempt, and an error CSV is available in the same session.
- **SC-003**: 100% of customer-linked campaign deliveries are visible on the corresponding Customer Messages history within normal UI refresh after send.
- **SC-003a**: Campaign detail exposes both handed-off-to-provider and receipt-confirmed counts; for a fixture with known provider acceptances and receipts, both counts match the fixture within normal UI refresh after statuses update.
- **SC-004**: Customer care can open campaign history and detail without access to compose/send controls in 100% of role-permission checks.
- **SC-005**: For a fixture where the same address would receive identical resolved content twice from overlapping audience modes, exactly one delivery is handed to the provider.
- **SC-006**: For a fixture where one customer has two matching policies and policy-specific placeholders differ, exactly two deliveries are handed to the provider for that address.
- **SC-007**: Cancelling during the delay window results in zero provider handoffs; cancelling after dispatch starts leaves already-handed-off messages unchanged and prevents remaining not-yet-sent handoffs.
- **SC-007a**: A fixture campaign with mixed successful and failed deliveries ends in status “Completed with failures” once dispatch is finished.
- **SC-008**: Soft-skipped recipients (missing email/phone) never generate error-monitoring alerts, while blocking preflight failures always do.
- **SC-009**: Duplicate send attempts matching the same campaign identity or the same name + body + audience within the idempotency window do not create a second dispatch.
- **SC-010**: Audit on a completed or cancelled campaign answers who composed/sent/cancelled, what content (with placeholders) was used, which audience definition applied, and key timestamps, without needing engineering database access.

## Assumptions

- Admins understand scheme, package, and status filters; whole-scheme selection is sufficient for MVP.
- Placeholder values come from stored business data (not wall-clock “now” tokens), so content sameness is stable for dedupe.
- “Handed off to provider” means the message has left the internal pending queue toward the SMS/email provider; those cannot be recalled.
- Existing Customer Messages history remains the place to inspect per-customer deliveries; campaign history is the place to inspect bulk sends.
- Default confirmation threshold (20), SMS delay (2 minutes), email delay (3 minutes), and idempotency window (10 minutes) are acceptable starting points and remain configurable.
- English-only campaign copy is acceptable until a later localization iteration.
- Intake document `docs/proposals/admin-messaging-campaigns.md` remains the detailed decision log; this spec is the Spec Kit source of truth for planning.
- Automated TDD for this feature covers API/domain (Jest). UI pill/color/compose layout acceptance is via Independent Tests and quickstart unless a frontend test harness is added later.
- Campaign endpoints follow constitution error-handling (`ValidationException`, `ErrorCodes`, `status`, correlation IDs).
- Preview loading/empty UI states follow existing admin app patterns (spinner/empty message); no unique campaign loading FR.
- Accessibility follows existing admin app patterns; no new campaign-specific a11y FR in this release.
- Admin compose is desktop-primary; dedicated mobile/responsive layout requirements are not specified this release.
- Placeholder picker catalog is the set implemented in `campaign-placeholders.ts` (customer + policy keys per FR-008); Spec lists categories/examples, not an exhaustive frozen enum.
- Campaign list default sort is `createdAt` descending; filters are channel/status/page as in OpenAPI.
- Preview/send rate limiting for large audiences is deferred (5k warn remains the product control).
- Paste list size is not hard-capped beyond the 5k sendable-recipient warning.
- Audience snapshot / paste-list retention follows existing messaging content retention settings; no extra campaign-specific redaction FR.
- Settings changes (delay/threshold/idempotency window) apply to newly created campaigns; in-flight DELAYED campaigns keep the delay already stamped on `dispatchStartsAt`.
- Dispatcher crash/recovery uses the same cron reclaim of `DELAYED`/`DISPATCHING` rows; no separate runbook FR this release.
- Countdown UI displays time remaining until `dispatchStartsAt` (UTC instant) in the admin’s local timezone.
- “Normal UI refresh” for SC-003/SC-003a means the next successful poll/navigation after status updates (qualitative; no hard SLA).
- Provider credentials and Africa’s Talking/SMTP config are existing platform concerns, not defined by this feature.
- SMS marketing consent / opt-out compliance is out of scope for this feature (ops/policy outside Spec).
- Feature flags / gradual rollout are not required for this feature’s MVP.
- Migration rollback follows standard Prisma/migration ops practice; no feature-specific rollback FR.

## Out of Scope

- Hand-picking individual members within a scheme
- Dependants / beneficiaries as audience types
- Sending campaigns using existing automated event template identities
- Saving ad hoc campaign copy back onto campaign shells as reusable templates
- Email attachments on campaigns
- Non-English campaign compose/send
- Changing how automated events are triggered (except by editing non-campaign template content in Templates)
- New campaign-specific accessibility or mobile layout requirements beyond existing admin app conventions
- Preview/send API rate limiting (deferred)
- SMS/email marketing consent and opt-out compliance workflows
- Feature-flagged gradual rollout of campaigns
```