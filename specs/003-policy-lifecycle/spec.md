# Feature Specification: Policy Lifecycle & Status Rules

**Feature Branch**: `003-policy-lifecycle`  
**Created**: 2026-07-10  
**Status**: Draft  
**Input**: User description: "I want to build a policy lifecycle process" with starter document *Mfanisi Go Policy Lifecycle & Status Rules* (policy term, statuses, grace, waiting periods, renewal, blacklist, daily automation, and notification templates).

## Clarifications

### Session 2026-07-10

- **Q:** On renewal/reactivation to Active, same policy vs new record, and how is the cover term set? **→ A:** **Option D (refined):** Suspension restore stays on the **same** policy (original start/end unchanged). When a policy has **finished its cycle** (term ended), renewal creates a **new policy record**; the old policy is marked **EXPIRED**; payments for the new period link to the new policy; `supersedesPolicyId` / `supersededByPolicyId` link the pair. Within vs after 30 days after expiry changes new-policy **start date** (and formerly waiting-period intent in the starter doc; waiting periods are out of scope for this feature).
- **Q:** What is the new policy’s start date on expiry renewal? **→ A:** **Option A:** Both within-30-day and after-30-day renewals create a **new policy record**. Within 30 days: new start = **day after old end** (continuous cover). After 30 days: new start = **payment date**. End date follows the 12-month term rule from that start.
- **Q:** What starts the grace / suspension clock? **→ A:** **Option B:** Overdue is measured from the policy’s **next unpaid expected premium due date** on its payment schedule (daily/weekly/monthly/etc.), not a fixed calendar month or “days since last payment” alone.

### Session 2026-07-11

- **Q:** What happens on “blacklist” / abuse permanent close? **→ A:** **Option D (refined):** No separate Blacklisted status. Before claims-processor integration, permanent restriction is **manual admin only**. Admin action lives in the same policy actions menu as **Reset Start Date**, with a confirmation popup and **mandatory description**. Sets the **selected policy** to **TERMINATED**; customer Terminated only per multi-policy rule (see later clarification). Starter-doc “blacklisted” maps to system **Terminated** (existing registration gate). Automatic default+utilization blacklist is **out of scope** until claims integration.
- **Q:** Are waiting periods / service-access evaluation in scope? **→ A:** **Option D:** Waiting periods are **entirely out of scope** for this feature. This feature covers **status transitions only** (plus related dates, notifications, renewal/supersession, and admin Terminate). Benefit eligibility / waiting-period enforcement is deferred (e.g., with claims integration).
- **Q:** Terminate when the customer has multiple policies? **→ A:** **Option C:** Terminate **only the selected policy**. Customer becomes **Terminated** only if they have **no remaining** Active, Pending Activation, or Suspended policies; otherwise customer status is recalculated from remaining open policies (same coupling idea as deactivate in 002).
- **Q:** Inactive policy whose term end date also passes? **→ A:** **Option A (refined):** Inactive + end date passed → **Expired** (renewal/new-policy rules then apply). **Suspended** + end date passed → stays **Suspended** (no automatic status change at term end). **Terminated** + end date passed → stays **Terminated**. Active/Grace + end date passed without renewal → **Expired**.
- **Q:** On expiry renewal, policy number and payment account number? **→ A:** **Option B (refined):** Generate a **new policy number**; **reuse** `paymentAcNumber` and **member numbers** on the new policy.
- **Q:** Can a Suspended (or any) policy be restored to Active after end date? **→ A:** **No.** After end date a policy **cannot** return to Active (member treatment would not be valid; **admin Activate is also blocked**). Payments after end date still **collect premium debt** on the existing policy first; **any amount above outstanding debt** creates a **new** renewal policy (new policy number; reuse pay account + member numbers; supersession). Future claims-based rule (if no utilization, after one month all payment → new policy; before that → old debt) is **deferred** until claim data exists.
- **Q:** After end date, does Suspended → Inactive (>30 days) still run? **→ A:** **No** auto Suspended → Inactive after end date. **Refined (Session 2026-07-11 remediation):** Suspended past end **stays Suspended while premium debt remains**. When the customer **finishes paying outstanding premium debt** on that Suspended-past-end policy, status becomes **EXPIRED** (still never Active). Surplus above debt still creates a **new** renewal policy. If they never finish paying debt, status stays **Suspended** forever (analytics).

### Session 2026-07-11 — Analysis remediation

- **Q:** I1 job service ordering? **→ A:** Pending reminders wired via messaging/lifecycle helpers in US1; `PolicyLifecycleJobService` created in Foundational as stub / fully implemented in US6.
- **Q:** U4 pending D0 welcome template? **→ A:** Keep existing `customer_created` only; do **not** add a separate pending-activation welcome template. Day 3 / Day 7 reminders are new.
- **Q:** U1 restore amount formula? **→ A:** Use **ceil(daysNeeded / paymentCadenceDays) × installmentAmount** for 14-day upfront and one-month (~31 days) amounts.
- **Q:** Post–end Suspended when debt cleared? **→ A:** Suspended past end + debt fully paid → **EXPIRED**; unpaid debt remaining → stay **Suspended**.
- **Q:** A1 end time-of-day vs FR-001? **→ A:** Keep existing util: end = start + 1 year − 1 day at the **same time of day** as start (e.g. 10:15 → 10:15). Do not force 23:59:59.
- **Q:** U3 prepaid vs postpaid? **→ A:** Lifecycle rules (grace, suspend, inactive, expire, renew, payments) apply to **both prepaid and postpaid**.
- **Q:** C3 partial restore messaging? **→ A:** `ValidationException` only; no dedicated “amount too low” SMS.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Activate policy on first payment (Priority: P1)

A newly registered customer has a policy in **Pending Activation**. When their first premium payment is received, the policy becomes **Active**, cover dates are set for a full 12-month term, and they receive confirmation.

**Why this priority**: Without activation, no cover exists; this is the entry point of the entire lifecycle.

**Independent Test**: Create a customer/policy without payment; record first payment; confirm status Active, start/end dates correct, and activation messages sent.

**Acceptance Scenarios**:

1. **Given** a policy in Pending Activation with no completed premium, **When** the first qualifying premium payment is received, **Then** the policy status becomes Active and the customer is notified that cover is active.
2. **Given** activation on date D at time T, **When** start and end dates are assigned, **Then** cover begins at D+T and ends at the same clock time T on the calendar day before the one-year anniversary of D (existing date util).
3. **Given** a policy still in Pending Activation, **When** day 3 / day 7 after creation elapse without first payment, **Then** activation reminder messages are sent (day 0 welcome is covered by existing `customer_created`, not a new template).

---

### User Story 2 - Grace period while cover remains active (Priority: P1)

An Active policyholder misses a premium due date on their payment schedule. For up to 14 days after that unpaid expected due date they remain **Active** (grace overlay), receive escalating reminders, and keep cover for lifecycle purposes.

**Why this priority**: Protects members briefly after a missed payment and drives collection before suspension.

**Independent Test**: Set an Active policy with a due date in the past by 1–14 days; run the daily lifecycle check; confirm grace overlay and correct reminder on the matching day.

**Acceptance Scenarios**:

1. **Given** an Active policy whose **next unpaid expected premium due date** (from the policy’s payment schedule) is overdue by 1–14 days, **When** the daily status check runs, **Then** the policy remains Active but is marked internally as in Grace Period.
2. **Given** a policy in Grace Period, **When** the due date, day 7, day 10, or day 13 of overdue elapses, **Then** the corresponding premium reminder is sent (due-date, overdue, urgent, final-before-suspension).
3. **Given** a policy in Grace Period, **When** the member pays the outstanding premium before day 15 of overdue, **Then** grace ends, the policy stays Active, and cover continues without suspension.

---

### User Story 3 - Suspend for non-payment and restore on arrears (Priority: P1)

If premium remains unpaid after 14 days of grace, the policy becomes **Suspended** and cover is treated as stopped for lifecycle purposes. Paying all arrears plus 2 weeks of upfront premium restores Active cover.

**Why this priority**: Core collection enforcement and the primary path back to cover after missed payments.

**Independent Test**: Advance overdue past 14 days → Suspended; pay arrears + 14 days premium → Active again with reactivation message.

**Acceptance Scenarios**:

1. **Given** an Active (grace) policy with premium overdue more than 14 days, **When** the daily status check runs, **Then** status becomes Suspended and a suspension notice is sent.
2. **Given** a Suspended policy, **When** day 1 / day 7 / day 13 of suspension elapse without restoration, **Then** suspension notice / arrears reminder / final-before-inactive reminders are sent.
3. **Given** a Suspended policy **before** its end date, **When** the member pays all outstanding arrears plus 2 weeks of premium at the policy’s rate, **Then** status becomes Active and a reactivation message is sent.
4. **Given** a Suspended (or Inactive) policy **on or after** its end date, **When** an admin or payment flow would otherwise activate it, **Then** the policy does **not** become Active.

---

### User Story 4 - Move to Inactive / Expired after prolonged suspension or term end (Priority: P1)

A policy becomes **Inactive** when it remains Suspended for more than 30 days (mid-term non-payment path). When the **policy term ends** without renewal, the policy becomes **Expired**. Renewal after a finished cycle always creates a **new** policy record; mid-term reactivation from Inactive stays on the **same** policy. Within vs after 30 days after expiry changes the **new policy start date** only (waiting-period effects are out of scope).

**Why this priority**: Closes the non-payment and expiry paths and defines how members return to cover.

**Independent Test**: Leave a policy Suspended >30 days → Inactive (same policy restore on payment); expire a term → Expired; renew within vs after 30 days and verify new policy, start dates, and supersession links.

**Acceptance Scenarios**:

1. **Given** a Suspended policy overdue (or suspended) for more than 30 days, **When** the daily status check runs, **Then** status becomes Inactive and an inactive notification is sent.
2. **Given** an Active or Grace policy whose end date has passed without renewal, **When** the daily status check runs, **Then** status becomes **Expired**.
3. **Given** a Suspended policy whose end date has passed, **When** the daily status check runs (including after >30 days suspended), **Then** status remains **Suspended** forever (no Inactive/Expired auto-transition after end date).
4. **Given** an Inactive policy whose end date has passed, **When** the daily status check runs, **Then** status becomes **Expired**.
5. **Given** a Terminated policy whose end date has passed, **When** the daily status check runs, **Then** status remains **Terminated** (no change).
6. **Given** an Inactive policy from prolonged non-payment **and end date not yet passed**, **When** payment is made within 30 days of becoming Inactive, **Then** paying arrears plus 2 weeks upfront restores **the same** policy to Active (original term dates unchanged).
7. **Given** an Inactive policy from prolonged non-payment **and end date not yet passed**, **When** payment is made more than 30 days after becoming Inactive, **Then** paying one month of premium restores **the same** policy to Active (original term dates unchanged).
8. **Given** any policy **on or after** its end date with outstanding premium debt, **When** a payment is received, **Then** the payment is applied to that policy’s outstanding debt first and the policy does **not** become Active.
9. **Given** a payment on or after end date that exceeds outstanding debt, **When** the surplus is applied, **Then** a **new** renewal policy is created (new policy number; reused payment account number and member numbers; supersession links; start-date rules per within/after 30 days of expiry as applicable); the prior policy does not become Active; if prior was Suspended it remains Suspended.
10. **Given** an Expired policy (finished cycle), **When** the holder renews within 30 days after expiry (including via surplus-after-debt payment), **Then** a **new** policy is created as Active with a **new policy number**, **reused** payment account number and member numbers, start date = **day after the old policy’s end date**, end date per the 12-month rule, payments for the new period link to the new policy, the old policy remains Expired, and supersession links connect the pair.
11. **Given** an Expired (or post–end-date) policy, **When** the holder renews more than 30 days after expiry, **Then** a **new** policy is created as Active with start date = **payment date**, new policy number, reused pay account and member numbers, supersession links, and prior policy not Active.
12. **Given** a policy approaching or past expiry, **When** the renewal notification schedule fires (30d, 14d, 7d, 3d, 24h before; 24h, 3d, 7d, 14d, 30d after), **Then** the corresponding renewal message is sent once per schedule point.

---

### User Story 5 - Admin terminate (starter “blacklist”) (Priority: P2)

Administrators can permanently **Terminate** a selected policy (fraud, regulatory, customer request, product discontinuation, or abuse formerly called “blacklist” in the starter doc). The action sits in the same policy actions menu as **Reset Start Date**, requires confirmation and a **mandatory description**, and sets the **selected policy** to **Terminated**. The **customer** becomes Terminated only when they have no remaining Active, Pending Activation, or Suspended policies; otherwise customer status follows remaining open policies. There is no separate Blacklisted status. Automatic termination from default + utilization is deferred until claims-processor integration.

**Why this priority**: Protects the book and supports compliance via an explicit admin control; less frequent than payment-driven transitions.

**Independent Test**: Terminate one of two open policies → selected policy Terminated, customer not Terminated; terminate the last open policy → customer Terminated; registration gate blocks when customer is Terminated.

**Acceptance Scenarios**:

1. **Given** an admin on a policy’s actions menu (same menu as Reset Start Date), **When** they choose Terminate, **Then** a confirmation popup requires a mandatory description before submit.
2. **Given** a customer with multiple open policies (Active, Pending Activation, and/or Suspended), **When** admin confirms Terminate on one policy with description, **Then** only that policy becomes **Terminated**, an audit record stores the description/reason, a termination notification is sent for that policy, and the customer remains non-Terminated with status derived from remaining open policies.
3. **Given** a customer whose only remaining open policy (Active, Pending Activation, or Suspended) is terminated, **When** admin confirms Terminate with description, **Then** that policy and the **customer** both become **Terminated**, and neither can automatically return to Active.
4. **Given** a Terminated customer, **When** anyone attempts new registration or new policy creation matching that identity, **Then** the request is rejected by the existing Terminated registration gate (no separate blacklist override flow in this feature).
5. **Given** payment or daily lifecycle automation, **When** evaluating policies, **Then** the system does **not** auto-terminate (or “blacklist”) solely because of default >30 days plus prior utilization.

---

### User Story 6 - Daily automated status processing (Priority: P1)

Operations rely on a once-per-day automated pass that evaluates Active (including grace), Suspended, and expiring policies, applies status transitions, and queues the right notifications. Payment events also drive immediate transitions (first payment, arrears clearance, renewal).

**Why this priority**: Without reliable automation, grace/suspension/inactive/renewal rules will not hold at scale.

**Independent Test**: Seed policies in each boundary state; run the daily process once; verify expected status changes and that duplicate runs the same day do not double-send the same scheduled notification.

**Acceptance Scenarios**:

1. **Given** Active policies with overdue premiums, **When** the daily check runs, **Then** overdue 1–14 days → Grace; overdue >14 days → Suspended.
2. **Given** Suspended policies **before** end date, **When** the daily check runs, **Then** those past 30 days of suspension/non-payment path → Inactive.
3. **Given** policies nearing or past end date, **When** the daily check runs, **Then** renewal notifications for due schedule points are queued; Active/Grace past end → **Expired**; Inactive past end → **Expired**; Suspended past end → remains **Suspended** (including no >30-day Inactive transition after end date); Terminated past end → unchanged.
4. **Given** a payment event (first payment / arrears+2 weeks / renewal), **When** payment is confirmed, **Then** the status change from the developer decision table applies without waiting for the next daily run.
5. **Given** any automated or payment-driven status change, **When** it completes, **Then** an auditable status-change record exists with reason and trigger (system payment lifecycle vs admin).

---

### Edge Cases

- Policy created and first payment received on the same day: activate immediately; skip remaining pending-activation reminders.
- Payment received on the exact grace boundary (end of day 14 vs start of day 15): day 1–14 inclusive stay in grace; after 14 full days overdue → Suspended on the next daily evaluation (or immediately if evaluation is event-driven).
- Multiple premiums owed (several missed cycles): arrears means the full outstanding balance; “2 weeks upfront” is additional to that balance.
- Leap years / anniversary: end date is start + 1 calendar year − 1 day at the **same time of day** as start (UTC), so the term is one full year of cover.
- Member in Grace who also hits policy end date: term expiry to **Expired** takes precedence over remaining grace.
- Suspended policy that reaches end date: status remains **Suspended** while debt remains (no auto Inactive). It cannot become Active after end date. When debt is **fully paid**, status → **EXPIRED**; surplus above debt creates a new renewal policy.
- Terminated policy at term end: status does **not** change (stays Terminated).
- Inactive policy past end date: becomes **Expired**.
- Post–end-date payment: applied to outstanding premium debt on the existing policy first; policy never returns to Active (including admin Activate). Amount above debt creates a new renewal policy (new policy number; reuse pay account + member numbers; supersession). **Suspended past end + debt fully cleared → EXPIRED**; unpaid debt remaining → stay Suspended.
- Claims-based post–end-date allocation (utilization check; after one month all to new policy) is deferred until claim data exists.
- Blacklist vs Terminate: Starter-doc “blacklisted” **is** system **Terminated** (customer + policy). No separate Blacklisted status. Auto-terminate from default + utilization is deferred until claims integration.
- Customer with multiple policies: lifecycle rules evaluate per policy; admin Terminate applies to the **selected policy only**; customer becomes Terminated only when no Active / Pending Activation / Suspended policies remain (Inactive, Expired, Deactivated do not keep the customer “open”).
- Partial payment that does not clear required arrears (+ 2 weeks when required): status does not improve; member is informed that the required amount was not met (no silent partial reactivation).
- Admin DEACTIVATED policies (from modify/deactivate product flows): excluded from payment-driven reactivation; not overwritten by grace/suspend automation.

## Requirements *(mandatory)*

### Functional Requirements

#### Policy term

- **FR-001**: System MUST assign policy start and end dates on first activation such that cover runs for one full year: start date inclusive; end date = start + 1 calendar year − 1 day, **preserving the start time of day** (existing `policyEndDateFromStart` behavior).
- **FR-002**: When a policy’s end date has passed without successful renewal, System MUST apply: Active or Grace → **Expired**; Inactive → **Expired**; Suspended → **no change** (remains Suspended permanently after end date, including no Suspended → Inactive after end date); Terminated → **no change**; Deactivated → **no change** (unless already specified elsewhere).

#### Status model

- **FR-003**: System MUST support the following lifecycle statuses for policies: Pending Activation, Active, Suspended, Inactive (mid-term non-payment end), Expired (finished term), Terminated, and admin Deactivated (from product modify/deactivate). System MUST NOT introduce a separate Blacklisted status.
- **FR-004**: System MUST represent Grace Period as an internal overlay on Active (member-facing status remains Active; cover continues) for days 1–14 of premium overdue.
- **FR-005**: System MUST NOT allow automatic transition from Terminated back to Active; a new policy is required.
- **FR-006**: System MUST record every status transition (manual or automated) with timestamp, from/to status, trigger, and reason.

#### Pending Activation

- **FR-007**: System MUST create new policies in Pending Activation when the customer is registered without completed first premium.
- **FR-008**: System MUST transition Pending Activation → Active on first qualifying premium payment and send activation confirmation messaging (existing payment/activation templates as applicable).
- **FR-009**: System MUST send Pending Activation reminders on day 3 and day 7 if still unpaid. Day-0 welcome uses the existing `customer_created` message (no duplicate welcome template).

#### Grace, Suspend, Inactive (non-payment)

- **FR-010**: System MUST mark Active policies as in Grace when the **next unpaid expected premium due date** from the policy’s payment schedule is overdue 1–14 days.
- **FR-011**: System MUST transition Active/Grace → Suspended when that same unpaid expected due date is overdue more than 14 days.
- **FR-012**: System MUST transition Suspended → Active when all arrears plus 2 weeks of premium (at the policy’s rate) are paid **only if the policy end date has not passed**.
- **FR-012a**: System MUST NOT set a policy to Active on or after its end date for any reason, including admin Activate and payment-driven restore.
- **FR-012b**: On or after end date, System MUST apply incoming payments to outstanding premium debt on that policy first; any amount above outstanding debt MUST create a new renewal policy per FR-016/FR-017 (new policy number; reuse payment account number and member numbers; supersession). Debt-only payments MUST NOT activate the old policy. **If the prior policy is Suspended past end and outstanding debt reaches zero, System MUST set it to EXPIRED** (not Active). If debt remains, it MUST stay Suspended.
- **FR-013**: System MUST transition Suspended → Inactive when the suspension/non-payment path exceeds 30 days **only if the policy end date has not passed**. After end date, Suspended MUST NOT auto-move to Inactive; it stays Suspended until debt is cleared (then Expired) or remains Suspended if debt is never cleared.
- **FR-014**: System MUST send grace, suspension, inactive, and reactivation messages according to the schedules and intents in the starter notification set (channels per Assumptions).

#### Renewal

- **FR-015**: System MUST send renewal reminders at: 30 days, 14 days, 7 days, 3 days, and 24 hours before expiry; and 24 hours, 3 days, 7 days, 14 days, and 30 days after expiry.
- **FR-016**: System MUST, on renewal payment within 30 days after expiry, create a **new** Active policy with a **new policy number**, **reused** payment account number and member numbers, start date = day after the prior policy’s end date and end date per the 12-month term rule; keep the prior policy **Expired** when renewing from Expired (or set prior to **Expired** when renewing from Suspended-past-end after debt is cleared); link the pair via `supersedesPolicyId` / `supersededByPolicyId`; attach new-period payments only to the new policy.
- **FR-017**: System MUST, on renewal payment more than 30 days after expiry, create a **new** Active policy with a **new policy number**, **reused** payment account number and member numbers, start date = payment date and end date per the 12-month term rule; keep the prior policy **Expired**; link via supersession fields; attach new-period payments only to the new policy.
- **FR-018**: For Inactive-from-non-payment **before** end date (same policy), System MUST apply: within 30 days → arrears + 2 weeks → Active on the **same** policy (original term dates unchanged); after 30 days → one month premium → Active on the **same** policy. On or after end date, FR-012a/FR-012b apply instead (no same-policy Active).

#### Terminate (starter “blacklist”)

- **FR-019**: System MUST provide an admin **Terminate** action in the same policy actions menu as **Reset Start Date**, with a confirmation popup and **mandatory description** before apply.
- **FR-020**: On confirmed Terminate, System MUST set the **selected policy** to **Terminated**, record the description in the audit trail, and send a termination notification. System MUST set the **customer** to **Terminated** only when the customer has no remaining policies in Active, Pending Activation, or Suspended; otherwise System MUST recalculate customer status from remaining open policies. Starter-doc “blacklist” permanent block is achieved when the customer is Terminated (existing registration gate).
- **FR-021**: System MUST NOT automatically Terminated/blacklist a holder solely because they defaulted >30 days after utilizing cover; that automation is out of scope until claims-processor integration.

#### Automation & payments

- **FR-022**: System MUST run a daily policy status evaluation covering Active/grace, Suspended → Inactive, expiry/renewal notifications, and related transitions.
- **FR-023**: System MUST apply payment-driven transitions immediately on confirmed payment: first payment; arrears clearance; renewal within/after 30 days — per the decision table below.
- **FR-024**: System MUST avoid duplicate sends of the same scheduled notification for the same policy and schedule point.
- **FR-025**: System MUST ignore payment-lifecycle auto-transitions for policies that are Deactivated or Terminated.

#### Decision table (normative)

| Condition | Current status | Action | New status |
| :---- | :---- | :---- | :---- |
| Customer/policy created without first payment | None / new | Await first payment | Pending Activation |
| First payment received | Pending Activation | Activate policy | Active |
| Payment overdue 1–14 days (vs next unpaid expected due date) | Active | Enter grace | Active (Grace) |
| Payment overdue >14 days (vs next unpaid expected due date) | Active (Grace) | Suspend cover | Suspended |
| Arrears + 2 weeks paid (before end date) | Suspended | Restore cover | Active |
| Payment on/after end date (≤ outstanding debt) | Suspended / Inactive / Expired | Collect debt only | Status unchanged if debt remains (never Active) |
| Payment on/after end date clears Suspended debt exactly | Suspended | Debt cleared | Expired |
| Payment on/after end date (> outstanding debt) | Suspended / Inactive / Expired | Debt to old; surplus renews | Old: Expired if was Suspended/Inactive path debt cleared (Suspended→Expired); New: Active |
| Non-payment path >30 days (before end date only) | Suspended | Stop policy | Inactive |
| Non-payment path >30 days (on/after end date) | Suspended | No change | Suspended |
| Policy end date passed (Active/Grace, no renewal) | Active (or Grace) | End term | Expired |
| Policy end date passed | Suspended | No change | Suspended |
| Policy end date passed | Inactive | End term | Expired |
| Policy end date passed | Terminated | No change | Terminated |
| Renewal within 30 days of expiry | Expired | Create new policy (new policy #; reuse pay acct + member #s; start = day after old end) + supersession | New: Active; Old: Expired |
| Renewal after 30 days of expiry | Expired | Create new policy (new policy #; reuse pay acct + member #s; start = payment date) + supersession | New: Active; Old: Expired |
| Reactivation within 30 days of Inactive (non-payment) | Inactive | Pay arrears + 2 weeks on same policy | Active (same policy, dates unchanged) |
| Reactivation after 30 days of Inactive (non-payment) | Inactive | Pay 1 month premium on same policy | Active (same policy, dates unchanged) |
| Admin terminates selected policy (menu + mandatory description) | Any (except already Terminated) | Close selected policy; maybe customer | Policy Terminated; customer Terminated only if no remaining Active/Pending Activation/Suspended policies |

### Key Entities

- **Policy**: Insurance cover instance with status, start/end dates, grace overlay, premium schedule/due state, and links to customer and product/scheme.
- **Policy status transition**: Auditable change between lifecycle statuses (and grace enter/exit), with trigger (daily job, payment, admin) and reason.
- **Premium due / arrears state**: Outstanding amount, next unpaid expected premium due date from the policy schedule, days overdue from that date, and amounts required to restore cover (arrears, 2 weeks, or one month).
- **Renewal window**: Relationship of current date to policy end date; drives notifications and new-policy start-date rules on expiry renewal.
- **Lifecycle notification**: Scheduled or event-driven member message (activation, grace, suspension, inactive, renewal, terminate) with defined timing and intent.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of first qualifying premiums move Pending Activation → Active with correct 12-month start/end dates in business acceptance tests.
- **SC-002**: For Active policies with an unpaid expected premium past due, daily evaluation places 100% of 1–14 day overdue cases (measured from that due date) into Grace and >14 day cases into Suspended in test scenarios spanning multiple payment frequencies.
- **SC-003**: 100% of Suspended → Inactive transitions occur when the >30 day non-payment rule is met in test scenarios; none occur before that threshold.
- **SC-004**: Expiry / surplus renewal creates a new Active policy with new policy number and reused pay account + member numbers; old policy never returns to Active after end date; debt-only post–end-date payments leave status non-Active — verified in acceptance tests.
- **SC-004a**: Admin Activate and payment-driven Suspended/Inactive → Active are rejected or no-ops when end date has passed — 100% of acceptance cases.
- **SC-005**: At least 95% of scheduled lifecycle notifications for a policy are sent within 24 hours of their schedule point in controlled test runs (no duplicates for the same schedule point).
- **SC-006**: Support can explain any status change using the audit trail for 100% of automated and admin transitions in sampled cases.
- **SC-007**: Admin Terminate with mandatory description always Terminates the selected policy; customer becomes Terminated if and only if no Active/Pending Activation/Suspended policies remain — verified for single- and multi-policy customers; subsequent registration attempts for a Terminated identity are rejected in 100% of attempts.
- **SC-008**: Operations can process a full daily evaluation for the expected production-scale policy book within the overnight batch window (target: complete before start of next business day).

## Out of Scope

- Admin **Modify Product**, manual Deactivate/Activate, and Reset Start Date flows already specified in `002-modify-product-policy` (this feature consumes those statuses but does not re-specify those UIs; Terminate is added alongside that menu).
- Waiting periods, benefit eligibility, service-access checks, scheme-transfer / group-of-15 waivers, and waiting-period notification content (deferred; e.g., with claims integration).
- Changing premium pricing, plan catalogs, or claims adjudication clinical rules.
- Building new payment collection rails (STK, IPN, etc.); this feature reacts to confirmed payments from existing payment processes.
- Member-facing self-service UI redesign (beyond receiving notifications and experiencing correct status outcomes).
- Regulatory filing or insurer reporting packs beyond status/audit data already implied here.
- Automatic “blacklist” / terminate from default >30 days after service utilization (deferred until claims-processor integration).
- A separate Blacklisted status or blacklist-override workflow.
- Claims-based post–end-date payment routing (if no utilization, after one month all payments → new policy; before that → old pending premium) — deferred until claim data exists.

## Assumptions

- **Inactive vs Expired**: **Expired** = Active/Grace past end without renewal, or Inactive past end date. **Inactive** = mid-term stop after prolonged suspension/non-payment **before** end date only. **Suspended** at/after term end stays Suspended permanently (analytics). **Terminated** at term end stays Terminated. Member-facing copy may still say “inactive” for non-payment stops; term-end communications may say expired/renew as appropriate.
- **Suspended after end date**: Stays **Suspended while debt remains** (no auto Inactive). When debt is **fully paid** → **EXPIRED**. Surplus above debt creates a new Active renewal policy. Dashboards can still distinguish “suspended with arrears past term” vs “expired after settling.”
- **Expiry renewal always new policy**: After a finished cycle, both within-30-day and after-30-day renewals create a new policy (never reactivate the Expired row). New policy number; reused payment account number and member numbers. Within 30 days: new start = day after old end. After 30 days: new start = payment date. New-period payments attach to the new policy; supersession fields link the pair.
- **Grace is not a separate member-facing status**: Members and partners see Active during grace; internally the system tracks grace for reminders and the 14-day clock.
- **Product applicability**: Lifecycle rules apply to **both prepaid and postpaid** medical cover products; grace/suspend/inactive/expire/renew use the same due-date and payment logic. Scheme/product configuration may override durations later without changing the state machine.
- **Policy end time-of-day**: End date keeps the activation start’s clock time (existing `policyEndDateFromStart`); not forced to 23:59:59.
- **“2 weeks upfront” and “one month premium”**: Calculated from the policy’s premium rate using `ceil(days / paymentCadenceDays) × installmentAmount` (14 days and ~31 days respectively).
- **Starter “blacklisted” = Terminated**: No Blacklisted status exists. Permanent restriction is admin Terminate of the selected policy (mandatory description), with customer Terminated only when no open (Active/Pending Activation/Suspended) policies remain. Existing Terminated registration gate blocks re-enrollment. Auto rules tied to claims utilization wait for claims integration.
- **Waiting periods deferred**: Starter waiting-period durations/waivers are reference-only for a future feature; this lifecycle feature does not enforce or message them.
- **Time basis**: All day-count and end-of-day overdue rules use UTC calendar days, consistent with platform timezone standards.
- **Notifications**: Content and timing follow the starter SMS/WhatsApp templates for **status lifecycle** events (activation confirmation, premium/grace, suspension, inactive, renewal, terminate); waiting-period template content is out of scope. Day-0 pending welcome = existing `customer_created`. Delivery uses the existing customer messaging capability.
- **Customer status coupling**: When a policy becomes Active, Suspended, Inactive, Expired, etc., customer-level status follows existing multi-policy rules (e.g., customer Active if any policy Active), without breaking 002’s Deactivated/Terminated behavior. Admin Terminate Terminates the selected policy and sets customer Terminated only when no Active/Pending Activation/Suspended policies remain.
- **Daily job idempotency**: Re-running the daily evaluation the same UTC day does not re-send notifications already marked sent for that schedule point.
- **Overdue clock**: Grace and suspension day counts start from the policy’s next unpaid expected premium due date on its schedule (respecting payment frequency/cadence). Clearing that installment advances the “next due” accordingly; multiple missed cycles accumulate into arrears.
- **No Active after end date**: A policy cannot become Active on or after its end date (payment restore or admin). Post–end-date money still collects debt; surplus above debt funds a new renewal policy. **Suspended past end → Expired once debt is fully paid**; otherwise remains Suspended. Claims-aware routing of that money is future work.
- **Pending day-0 messaging**: Uses existing `customer_created` template; lifecycle feature adds D3/D7 pending reminders only.
- **Restore amount formula**: 2-week upfront = `ceil(14 / paymentCadenceDays) × installmentAmount`; one month ≈ `ceil(31 / paymentCadenceDays) × installmentAmount`.
- **Partial payments**: Do not trigger upward status transitions until the full amount required for that transition is met (and never to Active after end date). Insufficient restore amount → `ValidationException` only (no dedicated SMS).
