# Feature Specification: Modify Product & Policy Lifecycle (Admin)

**Feature Branch**: `002-modify-product-policy`  
**Created**: 2026-07-09  
**Status**: Draft  
**Input**: Admin ability to modify an existing customer policy (same package), deactivate/activate policies, reset policy start date, audit all status changes, TERMINATED registration gate, and correct premium/missed-payment accounting after modify (including installment placeholder backfill).

## Clarifications

### Session 2026-07-07 — Scope

- **Q:** Add Product vs Modify Product? **→ A:** **Modify Product only** for this feature. Add Product is deferred.
- **Q:** What does “DEACTIVATED” mean vs SUSPENDED / TERMINATED? **→ A:** **DEACTIVATED** = admin/business closure (reversible in future lifecycle work). **SUSPENDED** = system-driven (missed payments). **TERMINATED** = fraud/permanent; customer and policy never change again.
- **Q:** Postpaid payment migration on modify? **→ A:** **Block** migrating postpaid bulk-linked payments. Modify without migration is allowed for **PENDING_ACTIVATION** postpaid (plan/scheme-only).

### Session 2026-07-08 — Premium math & reporting

- **Q:** After modify, will both policies appear in reporting? **→ A:** **Yes.** Deactivated and new policies are separate rows; payments are scoped per `policyId`. Unfiltered payment list shows a **Policy** column (policy number + status).
- **Q:** Backfill missed installment placeholders after modify? **→ A:** **In scope for v1** (not deferred). After modify, backfill unpaid placeholder rows on the new policy so `missedPayments` count aligns with financial math.
- **Q:** Policy dropdown labels with status/dates — only for modified pairs? **→ A:** **No.** Apply enriched labels to **all policies** in customer policy dropdowns (Payments tab and any shared policy selector). Superseded pairs benefit most, but a single rule avoids special cases and helps multi-package customers too.

### Session 2026-07-09 — UX defaults

- **Q:** Default Payments tab selection after modify? **→ A:** **Auto-select** the new **ACTIVE** policy (or new `PENDING_ACTIVATION` policy if no payments migrated).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Modify Product (Priority: P1)

As an **admin** on **Customer Detail → Products**, I can open **Modify product** on an eligible policy, change plan/scheme/frequency/cadence (family category read-only from dependants), optionally migrate completed payments from that policy, and atomically deactivate the old policy and create a new one on the **same package**.

**Why this priority**: Core business workflow for plan changes and payment continuity.

**Independent Test**: Modify an ACTIVE prepaid policy with completed payments; confirm old policy DEACTIVATED, new policy ACTIVE, payments moved from cutoff forward, placeholders backfilled, Payments tab auto-selects new policy.

**Acceptance Scenarios**:

1. **Given** an admin on Products tab and a policy in **ACTIVE** or **PENDING_ACTIVATION**, **When** they choose **Modify product**, **Then** a dialog mirroring onboarding payment (`register/payment/page.tsx`) opens with plan, frequency/cadence, scheme, pricing from `insurance-pricing.json`, family category **read-only**, mandatory reason, and required policy-number choice (**Keep Existing** / **Generate New**, no default).
2. **Given** source policy has completed prepaid payments, **When** modify proceeds, **Then** admin must pick **first payment to migrate** from that policy only; that payment and **all subsequent** completed payments move to the new policy.
3. **Given** modify completes, **When** viewing Products tab, **Then** source policy is **DEACTIVATED** with `deactivatedAt` set; new policy is **ACTIVE** (if payments migrated) or **PENDING_ACTIVATION** (if none); `supersedesPolicyId` / `supersededByPolicyId` link the pair; `paymentAcNumber` is **reused** on the new policy.
4. **Given** source policy is **SUSPENDED**, **When** admin opens Modify, **Then** modify is **blocked** until policy is **Activated** (manual or future lifecycle payment threshold).
5. **Given** source is **DEACTIVATED** or **TERMINATED**, **When** admin views row actions, **Then** Modify is not offered.
6. **Given** customer is **TERMINATED**, **When** admin attempts any product lifecycle action, **Then** request is rejected.
7. **Given** postpaid policy with **postpaid_scheme_payment_item**-linked payments, **When** admin modifies with payment migration, **Then** migration is blocked; **PENDING_ACTIVATION** postpaid without such payments may modify plan/scheme only (no payment picker).
8. **Given** modify changes plan, **When** new policy is created, **Then** `productName` reflects the new plan name from `insurance-pricing.json` + package naming rules.
9. **Given** modify completes, **When** admin opens Payments tab, **Then** the **new** policy is **auto-selected** in the policy dropdown.

---

### User Story 2 - Deactivate Policy (Priority: P1)

As an **admin**, I can deactivate a policy with a **mandatory reason**, with correct customer status coupling.

**Acceptance Scenarios**:

1. **Given** policy in **ACTIVE**, **SUSPENDED**, or **PENDING_ACTIVATION**, **When** admin deactivates with reason, **Then** policy → **DEACTIVATED**, `deactivatedAt` set, `EntityStatusChange` recorded.
2. **Given** customer has another **ACTIVE** policy, **When** one policy is deactivated, **Then** customer status unchanged.
3. **Given** customer has **ACTIVE** + **PENDING_ACTIVATION** and admin deactivates the **ACTIVE** one, **When** complete, **Then** customer → **PENDING_ACTIVATION**.
4. **Given** customer has only **PENDING_ACTIVATION** policy(s) and admin deactivates the last one, **When** complete, **Then** customer → **DEACTIVATED**.
5. **Given** customer has only **SUSPENDED** policy and admin deactivates it, **When** complete, **Then** customer → **DEACTIVATED**.
6. **Given** customer has no **ACTIVE** and no **PENDING_ACTIVATION** after deactivate, **When** complete, **Then** customer → **DEACTIVATED** and `Customer.deactivatedAt` set.

---

### User Story 3 - Activate Policy (Priority: P1)

As an **admin**, I can activate a **SUSPENDED** policy with mandatory reason (**SUSPENDED → ACTIVE** only).

**Acceptance Scenarios**:

1. **Given** policy **SUSPENDED**, **When** admin activates with reason, **Then** policy → **ACTIVE** and `EntityStatusChange` recorded.
2. **Given** customer **SUSPENDED**, **When** a policy is activated, **Then** customer → **ACTIVE**.
3. **Given** customer already **ACTIVE** (another active policy exists), **When** a suspended policy is activated, **Then** customer stays **ACTIVE**.
4. **Given** policy **PENDING_ACTIVATION** or **TERMINATED**, **When** admin views actions, **Then** manual Activate is not offered.

---

### User Story 4 - Reset Start Date (Priority: P2)

As an **admin**, I can reset `policy.startDate` and `policy.endDate` on **ACTIVE** or **SUSPENDED** policies without creating a new policy row.

**Acceptance Scenarios**:

1. **Given** policy **ACTIVE** or **SUSPENDED**, **When** admin resets start date with mandatory reason, **Then** only dates change; payments are **not** moved.
2. **Given** reset pushes start after existing completed payments, **When** premium math runs, **Then** payments before new start remain on the policy but are **excluded** from coverage accounting (`expectedPaymentDate < policyStartDay`).
3. **Given** reset completes, **When** viewing audit, **Then** `EntityStatusChange` records reason and metadata (`previousStartDate`, `newStartDate`).

---

### User Story 5 - Status audit trail (Priority: P1)

As an **admin** or support user, I can see why policy and customer statuses changed.

**Acceptance Scenarios**:

1. **Given** any manual deactivate, activate, modify, or reset, **When** action completes, **Then** at least one `EntityStatusChange` row exists with `reason`, `changedBy`, `trigger`, and `metadata`.
2. **Given** modify product, **When** complete, **Then** metadata includes plan/scheme/frequency/cadence before/after, `policyNumberChoice`, `paymentsMovedCount`, `firstPaymentId`, and cadence change details.
3. **Given** future auto-**SUSPENDED** from missed payments, **When** lifecycle runs, **Then** it writes `EntityStatusChange` with `trigger = PAYMENT_LIFECYCLE` and system-generated reason (spec-ready; implementation may follow in lifecycle feature).

---

### User Story 6 - TERMINATED registration gate (Priority: P1)

As the system, I reject new customer registration when identity matches a **TERMINATED** customer.

**Acceptance Scenarios**:

1. **Given** create-customer with `idNumber` matching any **TERMINATED** customer, **When** submitted, **Then** validation error (existing error-handling standards).
2. **Given** create-customer with `phoneNumber` matching any **TERMINATED** customer, **When** submitted, **Then** validation error.

---

### User Story 7 - Payments & policy dropdown UX (Priority: P1)

As an **admin** viewing Payments, I can distinguish policies and see payments across policies clearly after modify.

**Acceptance Scenarios**:

1. **Given** customer has multiple policies, **When** viewing policy dropdown, **Then** each option uses enriched label (see **FR-020**) for **every** policy, not only superseded pairs.
2. **Given** Payments grid with **no policy filter** (all policies), **When** payments load, **Then** table includes **Policy** column: policy number (or "—") + status badge.
3. **Given** policy filter selects one policy, **When** payments load, **Then** only that policy’s payments appear (unchanged behavior).

---

### User Story 8 - Installment placeholder backfill after modify (Priority: P1)

As the system, after modify with payment migration, I backfill **outstanding installment** placeholder rows on the new policy so missed-payment **counts** match financial math.

**Acceptance Scenarios**:

1. **Given** modify creates new policy with `startDate`, `paymentCadence`, and `premium`, **When** backfill runs, **Then** for each expected installment slot from start through `min(now, endDate)` without a covering completed payment, an **OUTSTANDING** placeholder row is created (see data-model).
2. **Given** migrated completed payments exist, **When** backfill runs, **Then** slots covered by those payments (by installment window) do not get duplicate placeholders.
3. **Given** backfill completes, **When** Products tab shows `missedPayments` count, **Then** it aligns with unpaid slots past due relative to `missedPaymentsAmount` (no “0 count / large KES due” mismatch for modify scenarios).

---

### User Story 9 - Agent Products tab (Priority: P2)

As an **agent** on customer detail, I see a **read-only Products** tab (no modify/deactivate/activate/reset).

**Acceptance Scenarios**:

1. **Given** agent customer detail page, **When** user opens Products tab, **Then** policy list matches admin data but **no** admin row actions appear.

---

## Functional Requirements

### Schema & status model

- **FR-001**: Add `DEACTIVATED` to `PolicyStatus` and `CustomerStatus` enums.
- **FR-002**: Add `Policy.deactivatedAt`, `Customer.deactivatedAt` (denormalized); **`EntityStatusChange` is source of truth** for reasons and history.
- **FR-003**: Add `Policy.supersedesPolicyId`, `Policy.supersededByPolicyId` for modify lineage.
- **FR-004**: Replace `@@unique([customerId, packageId])` with partial unique index: at most one policy per `(customerId, packageId)` where status ∈ `{ ACTIVE, PENDING_ACTIVATION, SUSPENDED }`.
- **FR-005**: System MUST implement `EntityStatusChange` per `data-model.md`.

### Modify product

- **FR-010**: Modify MUST be admin-only; entry on **admin** Customer Detail → Products row menu.
- **FR-011**: Modify dialog MUST mirror onboarding payment UI; pricing from **`insurance-pricing.json`**; family category read-only from dependants.
- **FR-012**: Modify MAY change plan, scheme (same package), frequency, and cadence; scheme change MUST follow existing postpaid→prepaid block.
- **FR-013**: Modify MUST deactivate source → create new same `packageId` in one transaction; block if source is DEACTIVATED, TERMINATED, or SUSPENDED (without prior activate).
- **FR-014**: `paymentAcNumber` MUST transfer from deactivated policy to new policy in same transaction.
- **FR-015**: Admin MUST choose policy number: **Keep Existing** or **Generate New** (required, no default).
- **FR-016**: Prepaid payment migration: pick first payment on source policy; move it and all subsequent completed payments; set dates from first migrated payment; new status ACTIVE. No STK on modify.
- **FR-017**: PENDING_ACTIVATION with no payments: no picker; new policy PENDING_ACTIVATION.
- **FR-018**: Block postpaid payment migration when `postpaidSchemePaymentItem` links exist; allow plan/scheme-only modify on PENDING_ACTIVATION postpaid without migration.
- **FR-019**: After modify, run **installment placeholder backfill** per FR-030–FR-032.

### Payments UX

- **FR-020**: Policy dropdown `displayText` for **all policies** MUST append status and effective date:
  - `ACTIVE` / `PENDING_ACTIVATION` / `SUSPENDED`: `{package} - {plan} ({STATUS}, from {startDate})` — if no `startDate`, omit “from …”
  - `DEACTIVATED`: `{package} - {plan} (DEACTIVATED, ended {endDate|deactivatedAt})`
  - `TERMINATED`: `{package} - {plan} (TERMINATED, ended {endDate|deactivatedAt})`
  - Dates: `DD Mon` (e.g. `26 Jan`) in local display; store UTC in API.
- **FR-021**: Unfiltered customer payments list MUST include **Policy** column: policy number (or "—") + status.
- **FR-022**: After successful modify, Payments tab MUST auto-select new policy id.

### Deactivate / Activate / Reset

- **FR-023**: Deactivate: mandatory reason; allowed from ACTIVE, SUSPENDED, PENDING_ACTIVATION; customer coupling per clarifications.
- **FR-024**: Activate: SUSPENDED→ACTIVE only; mandatory reason; customer SUSPENDED→ACTIVE when applicable.
- **FR-025**: Reset start date: ACTIVE or SUSPENDED; mandatory reason; payments stay on policy; math excludes pre-start payments.
- **FR-026**: TERMINATED customer or policy: no modify, deactivate, activate, or reset.

### Registration gate

- **FR-027**: Customer create MUST reject duplicate `idNumber` or `phoneNumber` on any **TERMINATED** customer.

### Installment backfill

- **FR-030**: Add `PaymentStatus.OUTSTANDING` for backfilled expected-unpaid installment slots (not STK-pending).
- **FR-031**: Backfill algorithm: from `policy.startDate`, step by `paymentCadence` days until `min(now, endDate)`; for each slot, if no completed payment covers the installment window and no OUTSTANDING row exists for that slot, insert placeholder with `amount = policy.premium`, `expectedPaymentDate` = slot start (UTC), `actualPaymentDate` null, unique `transactionReference` pattern `OUTSTANDING-{policyId}-{periodIndex}`.
- **FR-032**: Installment window for “covered by completed payment”: completed payment counts if `expectedPaymentDate` (or `actualPaymentDate` if set) falls in `[slotStart, slotStart + cadenceDays - 1]` UTC calendar days.

### Portal & member cards (deferred UI)

- **FR-040**: Deactivated customer retains portal access; TERMINATED loses portal (gate in portal auth).
- **FR-041**: Deactivated policy member cards show inactive indicator (red) — UI text deferred; API exposes policy status.

### Premium math (documented behavior)

- **FR-050**: Expected premium uses **new** `policy.premium` and **new** `paymentCadence` from `startDate` through as-of.
- **FR-051**: Paid side sums **actual migrated payment amounts** (historical amounts preserved); excess/deficit via `computePremiumDueAndExcess`.
- **FR-052**: Cadence change on modify is allowed; cadence delta captured in `EntityStatusChange.metadata`, not as a status transition.

## Non-Functional Requirements

- **NFR-001**: All status mutations MUST be transactional (Prisma `$transaction`).
- **NFR-002**: UTC for all date operations per project standards.
- **NFR-003**: Errors use `ValidationException`, `status` field, existing `ErrorCodes`.
- **NFR-004**: Prisma migrations only (no `db push` on tracked DBs).
- **NFR-005**: Admin-only guards on lifecycle endpoints.

## API Endpoints (planned)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/internal/customers/:customerId/policies/:policyId/deactivate` | Standalone deactivate |
| `POST` | `/internal/customers/:customerId/policies/:policyId/activate` | SUSPENDED→ACTIVE |
| `POST` | `/internal/customers/:customerId/policies/:policyId/reset-start-date` | Reset dates |
| `POST` | `/internal/customers/:customerId/policies/:policyId/modify` | Full modify transaction + backfill |
| `GET` | `/internal/customers/:customerId/policies/:policyId/modify-options` | Plans, schemes, eligible payments |
| `GET` | `/internal/customers/:customerId/status-history` | Optional v1 audit list |

## Out of Scope

- Add Product (new package enrollment for existing customer)
- Auto-SUSPEND on missed payments (audit entity spec-ready only)
- Member card inactive red label copy (API status exposure in scope)
- Messaging rules for deactivated customers
- Postpaid payment migration on modify

## Success Criteria

- Admin can modify prepaid policy with payment migration; old policy deactivated, new active, payments and placeholders correct.
- `missedPayments` count and `missedPaymentsAmount` agree after modify with cadence change.
- Both policies visible in Products and Payments with distinguishable dropdown labels.
- TERMINATED identity blocked at registration.
- All manual lifecycle actions produce `EntityStatusChange` rows with mandatory reasons.

## Related Documents

- [data-model.md](./data-model.md) — schema, entities, backfill algorithm
- [plan.md](./plan.md) — implementation phases
- [checklists/requirements.md](./checklists/requirements.md) — review checklist
