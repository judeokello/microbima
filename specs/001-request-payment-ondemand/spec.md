# Feature Specification: On-Demand Payment Request

**Feature Branch**: `001-request-payment-ondemand`  
**Created**: 2026-04-03  
**Status**: Draft  
**Input**: User description: "Add post-registration payment request from Customer Details > Payments with installment/custom amount options, phone validation, realtime status updates, table refresh/insert, and browser notifications."

## Clarifications

### Session 2026-04-03

- **Q:** For on-demand payment outcomes, how should **pending**, **processing**, **failed**, **cancelled**, and **timeout** appear in the payments transactions table versus **success**? **→ A:** **Option C** — Row visibility and updates MUST **match the existing payments transaction report behavior** used for **comparable flows** (same rules as **onboarding payment** / existing customer payments STK behavior), not a new parallel rule.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Trigger Payment Request from Customer Payments (Priority: P1)

As an operations user viewing a customer's payment transactions for a selected package, I can request payment directly from that page so I do not need to leave context or use a separate payment workflow.

**Why this priority**: This is the core business action and primary value of the feature.

**Independent Test**: Can be tested by filtering to a package, opening the request dialog, submitting a valid request, and confirming the request is accepted and tracked from the same screen.

**Acceptance Scenarios**:

1. **Given** a customer detail page with a package selected in the payments section, a resolvable **prepaid** policy for that context (see FR-016, FR-020, FR-021), and the payments **package-plan** filter is not empty, **When** the user views payment actions, **Then** a `Request payment` action is visible and enabled.
2. **Given** the customer's policy is linked to a **postpaid** scheme, **When** the user views payment actions, **Then** `Request payment` is disabled and the user sees an explanation that STK-style on-demand prompts are not available for postpaid schemes.
3. **Given** a **prepaid** customer whose payments **package-plan** dropdown has **no options**, **When** the user views the payments area, **Then** an on-screen message instructs them to **contact an administrator** to recover policy details for this customer, and `Request payment` is not offered as a usable action (FR-021).
4. **Given** the user clicks enabled `Request payment`, **When** the dialog opens, **Then** the user is presented with two mutually exclusive request options and a prefilled payment phone number field.
5. **Given** the user submits a valid request, **When** the request is accepted, **Then** the dialog shows request submission feedback and payment status tracking begins.
6. **Given** a customer and selected package with a resolvable policy, **When** a request is created, **Then** the request is linked to that package's single customer policy and subsequent payment records for this request are linked to the same policy.

---

### User Story 2 - Choose Installments or Custom Amount (Priority: P1)

As an operations user, I can either request a payment based on installment count or enter a custom amount so that the request matches the customer's payment arrangement.

**Why this priority**: Amount determination is required for every request and has direct payment impact.

**Independent Test**: Can be tested by creating one request using installment mode and another using custom amount mode and confirming each mode enforces its own input rules.

**Acceptance Scenarios**:

1. **Given** installment mode is selected and installment amount (policy premium) is positive, **When** the user selects a value from 1 to 5, **Then** the UI displays the computed requested amount as selected installments multiplied by the installment amount in KES.
2. **Given** a **prepaid** policy exists but **installment amount / premium** is missing or empty, **When** the user opens the request dialog, **Then** installment mode is unavailable, **custom amount** mode is available, and a **Sentry** warning is recorded for the data anomaly (FR-022).
3. **Given** custom amount mode is selected, **When** the user enters an amount, **Then** installment selector inputs are disabled or hidden and only custom amount is used for the request.
4. **Given** the user switches modes, **When** the switch completes, **Then** only the active mode's inputs are considered in validation and submission.

---

### User Story 3 - Track Outcomes Without Losing Context (Priority: P2)

As an operations user, I receive realtime status updates and notifications so I can continue working even if the dialog is closed while still knowing whether payment succeeded or failed.

**Why this priority**: Reduces missed outcomes and follow-up delays after request submission.

**Independent Test**: Can be tested by submitting a request, closing the dialog, simulating status changes, and confirming both in-page updates and browser notifications are delivered.

**Acceptance Scenarios**:

1. **Given** a submitted payment request, **When** status changes occur, **Then** the payments section updates status in realtime using the same behavior pattern as onboarding payment tracking.
2. **Given** a status update, **When** it is communicated in UI or notifications, **Then** it uses one of the standardized states: pending, processing, success, failed, cancelled, timeout, with **pending** vs **processing** meaning the same as on the **onboarding payment** flow (FR-023).
3. **Given** the dialog is closed after submission, **When** a final or intermediate status arrives, **Then** a browser notification is shown if browser notification permission exists.
4. **Given** browser notification permission is not yet granted, **When** a user submits and opts in, **Then** the app requests permission and uses notifications only after permission is granted.
5. **Given** a status-driven update for an on-demand payment, **When** the backend state changes, **Then** the payments transactions list reflects it **the same way** the report does today for **comparable** onboarding/STK payment flows (FR-011): which states produce or update rows, and when, is **not new product policy** for this feature.

---

### User Story 4 - See Prepaid vs Postpaid in Policy Summary (Priority: P1)

As an operations user, I can see at a glance whether the selected policy is prepaid or postpaid so I understand why on-demand payment may or may not be available.

**Why this priority**: Postpaid policies must not receive STK prompts; users need a clear visual cue next to plan/category.

**Independent Test**: Open customer detail with policy summary visible; confirm pill beside category/plan matches scheme billing mode.

**Acceptance Scenarios**:

1. **Given** the policy summary card is shown with a **plan name** (Category / plan row), **When** the user views that row, **Then** a pill appears immediately to the right of the plan name labeled **prepaid** or **postpaid** according to the policy's scheme billing mode.

---

### User Story 5 - Missing Package / Policy: Contact Administrator (Priority: P2)

As an operations user, when a **prepaid** customer has no usable package in the payments filter or no resolvable policy for payment linkage, I see a clear instruction to involve an administrator rather than an in-product recovery flow.

**Why this priority**: Keeps this feature focused; policy recovery stays outside this spec (FR-021).

**Independent Test**: Open a prepaid customer whose payments package-plan dropdown is empty or whose selected context has no policy; confirm only the admin-contact message and no completed on-demand request.

**Acceptance Scenarios**:

1. **Given** a **prepaid** customer and the payments **package-plan** dropdown has **no options**, **When** the user views the payments area, **Then** an on-screen message tells them to **contact an administrator** to recover policy details for this customer.
2. **Given** a selected package context where no policy can be resolved, **When** the user would otherwise request payment, **Then** the same **contact administrator** messaging applies and no payment request is created (FR-021).

---

### Edge Cases

- User tries to submit without selecting either installment or custom amount mode.
- User enters a phone number that is not exactly 10 digits or does not start with `01` or `07`.
- **Postpaid** policy or scheme: `Request payment` disabled entirely; no STK on-demand path (FR-018).
- **Prepaid** policy with **missing or empty** installment amount / premium: installment mode MUST be unavailable; **custom amount** MUST remain available (FR-022). A **Sentry warning** MUST fire when the dialog **opens** in this state and again when staff **submit** a custom-amount request; implementation MAY dedupe or throttle if the same session would otherwise produce noisy duplicates.
- Installment amount invalid (e.g. non-numeric anomaly) on prepaid: installment mode blocked; treat per FR-022 if the practical case is empty premium, otherwise block submit until data is correct.
- User selects installment mode but posting rules forbid it — validation prevents submit.
- **Prepaid** customer, **empty** package-plan dropdown on payments — show **contact administrator** message only; no in-feature recovery (FR-021).
- No policy for selected package (inconsistent data) — same **contact administrator** messaging; no payment request (FR-021).
- User closes the dialog before final status arrives and browser notifications are blocked or denied.
- Duplicate status events arrive for the same request; list should not duplicate transaction records.
- Request is initiated for one package but user changes package filter before status completion.
- Status **timeout** or **cancelled**: UI and notifications reflect standardized taxonomy (FR-019).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a `Request payment` action in the customer detail payments area after transactions are filtered to a specific package, subject to FR-020.
- **FR-002**: System MUST open a request dialog when enabled `Request payment` is selected.
- **FR-003**: System MUST provide exactly two mutually exclusive request methods in the dialog: installment-based request and custom amount request.
- **FR-004**: System MUST provide installment count options limited to whole-number values from 1 to 5.
- **FR-005**: System MUST display calculated requested amount in KES for installment mode as `selected installment count x installment amount (policy premium / installment size)` before submission, when installment path is allowed.
- **FR-006**: System MUST allow user entry of a custom requested amount in custom amount mode.
- **FR-007**: System MUST prepopulate the payment phone number with the customer's current phone number.
- **FR-008**: System MUST allow editing the phone number and validate it using existing registration phone rules: exactly 10 digits, starts with `01` or `07`, and maximum input length of 10 characters.
- **FR-009**: System MUST prevent request submission until all active mode fields and the phone field are valid.
- **FR-010**: System MUST publish payment request status updates to the customer payments view in realtime using the same status update behavior model used for onboarding payment.
- **FR-023**: System MUST use the same **pending** vs **processing** (and progression between states) as the **onboarding payment** experience; labels FR-019 apply, but when to show **pending** versus **processing** MUST match onboarding semantics.
- **FR-011**: System MUST keep the payment transactions list consistent with backend state after request outcomes without requiring manual page reload. **Which** states appear as rows, **when** rows are created or updated, and **how** in-progress vs terminal outcomes are shown MUST **match existing customer payments / onboarding payment** transaction report behavior for **comparable STK-linked policy payments** (clarification Session 2026-04-03, Option C)—this feature MUST NOT introduce a divergent grid rule.
- **FR-012**: System MUST support browser notifications for payment status changes when permission is granted.
- **FR-013**: System MUST request browser notification permission when needed before sending notifications.
- **FR-014**: System MUST show notification content that includes request outcome using the standardized status vocabulary (FR-019).
- **FR-015**: System MUST ensure failed transaction outcomes remain clearly visible to the user until user dismissal through either browser notification behavior (where supported) or persistent in-app status messaging.
- **FR-016**: System MUST resolve the target policy from the selected package context such that **at most one policy per customer per package** applies at all times; this rule holds historically and for all existing records.
- **FR-017**: System MUST link each on-demand payment request to the resolved policy and persist resulting payment receipt/transaction records against that same policy.
- **FR-018**: System MUST block `Request payment` when the policy (or package context) is **postpaid**; STK-style on-demand collection MUST NOT be available for postpaid schemes or postpaid policies.
- **FR-019**: System MUST use a single standardized status vocabulary end-to-end for this flow in UI and notifications: **pending**, **processing**, **success**, **failed**, **cancelled**, **timeout**.
- **FR-020**: In the **Policy summary** section (customer detail), System MUST show a pill immediately to the right of the **plan name** for the policy (the **Category / plan** value in UI; typically `product.planName` with category context) with text **prepaid** or **postpaid** matching the scheme/policy billing mode, so staff understand why the action may be disabled.
- **FR-021**: When a **prepaid** customer's payments **package-plan** filter has **no options**, or when no policy can be resolved for the payments context requiring linkage, System MUST show an **on-screen message** instructing staff to **contact an administrator** to recover policy details for the customer. System MUST **not** implement admin-recovery-style or equivalent in-product policy creation in this feature.
- **FR-022**: When a **prepaid** policy exists but **installment amount / premium** is **missing or empty** (or **premium is zero**), System MUST **disable installment** mode, MUST **allow custom amount** requests, and MUST send **warning-level events to Sentry** when: (a) **policy detail is fetched** for that prepaid policy (server-side, e.g. `getCustomerPolicyDetail`), (b) staff **open** the request dialog in that state, and (c) they **submit** a custom-amount request—so the data gap can be tracked and corrected; implementation MAY dedupe or throttle repeated warnings in the same session to limit noise.

### Key Entities *(include if feature involves data)*

- **Payment Request**: A user-initiated instruction to collect payment for a customer/package context; includes request method (installments/custom), requested amount, phone number, and current status (FR-019).
- **Policy**: The customer's insurance policy within a package context; uniquely one per customer-package combination (including historically); canonical link for on-demand requests and receipts.
- **Scheme billing mode**: Business classification (**prepaid** vs **postpaid**) determining whether STK-style on-demand collection is allowed.
- **Payment Request Option Set**: The currently active input mode and values used to derive request amount; includes installment count (1-5) and computed amount or direct custom amount.
- **Payment Status Event**: A status change notification for a payment request; uses FR-019 vocabulary; includes timestamp and link to customer/package transaction context.
- **Customer Payment Transaction Row**: A report record shown in the payment transactions table; inclusion and refresh rules follow the same behavior as comparable existing flows (FR-011).

### Assumptions

- Users can only trigger this feature for customers and packages they are already authorized to view in the payments section.
- The customer detail payments page supports package-level transaction filtering before this feature is used.
- **One policy per customer per package** has always been true and all existing data conforms.
- Existing registration phone validation behavior is the source of truth and is reused without changing rule thresholds.
- Browser notifications may have user-agent-specific limits for persistence; when true persistence is not supported, persistent in-app status messaging satisfies visibility requirements for non-success outcomes.
- **Postpaid** policies never receive this STK on-demand payment feature; **prepaid** policies may when other preconditions pass.
- **Pending** vs **processing** timings and copy align with the existing **onboarding payment** UX (FR-023).
- Policy **recovery** (admin recovery or similar) is **out of scope** for this feature; staff are directed to an **administrator** via on-screen messaging only (FR-021).

### Planning notes *(for /speckit.plan — not stakeholder acceptance)*

- **Transaction list**: Implementation MUST align row lifecycle with existing **onboarding / comparable STK policy payment** reporting (FR-011, Clarification Option C). Planning still maps concrete entities (`policy_payments`, `mpesa_stk_push_requests`, etc.) to columns and FR-019 display labels.
- **Sentry** (FR-022): Planning should define the warning payload (e.g. customer id, policy id, package context) so engineering can implement once without ambiguity.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of valid payment requests are submitted from the customer payments page in under 45 seconds from dialog open.
- **SC-002**: 100% of submitted requests show a visible status update (in-page and/or browser notification when permitted) within 5 seconds of each backend status event.
- **SC-003**: Payment transactions list behavior for on-demand requests (including **success** and any **pending/processing/failed/cancelled/timeout** rows the comparable onboarding flow would show) appears without manual page reload and **matches** that comparable flow (FR-011).
- **SC-004**: Invalid phone numbers are blocked from submission with validation feedback in 100% of tested invalid-format cases.
- **SC-005**: At least 90% of pilot users report they can complete and monitor a prepaid payment request without navigating away from the customer detail payments section.
- **SC-006**: 100% of postpaid policies show **postpaid** in the policy summary pill and have `Request payment` disabled with a visible reason.
- **SC-007**: 100% of tested **prepaid** customers with an **empty** payments package-plan dropdown see the **contact administrator** message and do not complete an on-demand request in-product (FR-021).
- **SC-008**: 100% of cases where staff **open** the request dialog while **prepaid premium/installment amount is missing** generate a **Sentry** warning; 100% of **submissions** in that same anomaly also generate a **Sentry** warning unless deduplication policy applies (FR-022).
