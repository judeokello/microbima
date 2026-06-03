# Feature Specification: Customer Premium Statement PDF

**Feature Branch**: `002-premium-statement-pdf`  
**Created**: 2026-04-03  
**Status**: Draft  
**Input**: User description: "Generate a downloadable Premium Statement PDF from Customer Detail > Payments after filtering returns payment rows; match branded template; support confirmed payments only; header totals and premium due rules; postpaid disabled; validation when policy data is incomplete."

## Clarifications

### Session 2026-04-03

- **Q:** Should the payments table in the PDF include every row the user might see in the UI for the same filters? **→ A:** The UI may be paginated; the PDF MUST include **all** matching rows for the selected period and filters, even if the current page only shows a subset. Retrieval MUST be **server-side** with the needed filters (not “fetch all then filter in memory” as the default approach).
- **Q:** Which payment rows count as “confirmed received” for the statement table and for header totals that match the table? **→ A:** Only payments in states meaning **money confirmed received** (completed, or query-confirmed pending final receipt). Pending STK callback rows MUST NOT appear in the PDF or in those totals.
- **Q:** How should “all-time captured payments” in the header relate to the date filter? **→ A:** That figure MUST **ignore** the UI from/to filter and reflect **captured** payments for the policy from **policy start** onward (see planning companion for exact date predicate).
- **Q:** Policy end date missing? **→ A:** In the PDF header, show **"-"** for policy end date.
- **Q:** Filename shape? **→ A:** `DD-MonthName-{product and plan label} Premium-Statement-{FullName}-{PolicyNumberWithHyphens}.pdf` (example: `03-April-MfanisiGo Gold Premium-Statement-John Maina Mwangi-MP-MFG-001.pdf`). Slashes in policy number become hyphens in the filename only.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate Premium Statement from Payments (Priority: P1)

As an operations user viewing a customer’s **Payments** tab, after I select a policy and date range and run **Filter**, when at least one **confirmed** payment row exists for that filter, I can click **Generate report** to download a **Premium Statement** PDF that matches the approved layout (logo, header block, salutation, payment table).

**Why this priority**: Core deliverable; direct business value for statements and reconciliation.

**Independent Test**: Filter to a policy and period with confirmed payments; generate PDF; verify layout, filename, and that row count matches **all** confirmed rows for that filter (not only the current UI page).

**Acceptance Scenarios**:

1. **Given** a **prepaid** policy is selected, filters are applied, and **at least one** payment qualifies as **confirmed received**, **When** the user clicks **Generate report**, **Then** the browser downloads a PDF with the correct branded header and a table of **only** confirmed payments for that policy and date range.
2. **Given** the same context but **no** payment qualifies as confirmed received, **When** the user views the payments area, **Then** **Generate report** is not available (or is disabled with a clear reason).
3. **Given** the selected policy is **postpaid**, **When** the user views payment actions, **Then** **Generate report** is **disabled** and the user sees a short explanation that premium statements are not available for postpaid policies in this release.
4. **Given** the UI list is **paginated** and the first page shows 10 rows but 30 confirmed rows match the filter, **When** the user generates the report, **Then** the PDF contains **30** rows (full result set for the filter), not 10.
5. **Given** a successful generation, **When** the user opens the PDF, **Then** the payment table includes columns: **Payment type**, **Transaction reference**, **Expected payment date**, **Actual payment date**, **Amount** (account number is not repeated in the table).
6. **Given** a successful generation, **When** the user reads the header, **Then** it includes: statement date; salutation with customer full name; product; plan; premium frequency; premium amount per frequency; policy number (as printed with normal separators); **total premium paid** for the **filtered** confirmed set; **all-time captured payments** (ignoring from/to filter, from policy start per companion doc); **premium due** per defined rules; **policy start** and **policy end** dates (or **"-"** for missing end); **policy status**.

---

### User Story 2 - Block Statement When Policy Data Is Invalid (Priority: P1)

As an operations user, if mandatory data for a statement is missing (e.g. no policy number, no policy start date, or zero premium where that makes the statement invalid), I see a clear in-page error and no PDF is generated; the incident is logged for support follow-up.

**Why this priority**: Prevents misleading statements and surfaces data issues.

**Independent Test**: Simulate each invalid condition; confirm banner text, no download, and support logging.

**Acceptance Scenarios**:

1. **Given** the selected policy has **no policy number**, **When** the user attempts **Generate report**, **Then** an in-page notification shows a clear **contact support** message, **no** PDF is produced, and a **warning** is sent to the error monitoring system.
2. **Given** the selected policy has **no start date**, **When** the user attempts **Generate report**, **Then** a specific **contact support** message is shown, **no** PDF is produced, and a **warning** is logged to the error monitoring system.
3. **Given** the policy **premium / installment amount** is **zero** (invalid for this statement), **When** the user attempts **Generate report**, **Then** a specific **contact support** message is shown, **no** PDF is produced, and a **warning** is logged.

---

### User Story 3 - Premium Due and Overpayment Presentation (Priority: P2)

As a reader of the statement, I see **premium due** computed from policy start through the statement **as-of** date using the agreed installment cadence; if the member has paid **more** than expected to date, the amount shown remains **positive** and is labeled as an **excess payment** per the template.

**Why this priority**: Correct financial interpretation on the statement.

**Independent Test**: Fixture policies with underpay, exact pay, and overpay; verify header numbers and excess label.

**Acceptance Scenarios**:

1. **Given** expected installments to the as-of date and total **captured** paid, **When** expected exceeds paid, **Then** **premium due** shows the **positive** shortfall.
2. **Given** paid exceeds expected to the as-of date, **When** the user views the header, **Then** the value shown is **positive** and includes an **excess payment** indication consistent with the approved template.

---

### User Story 4 - Configure Product Duration (Calendar) on Packages (Priority: P1)

As an administrator creating or updating a **package**, I must set **how many days in a “premium year”** apply for that product (used for installment counts shown alongside payments). The value is a whole number between **1** and **365**, numeric only; if omitted on create, the system applies the **default duration** defined for new packages (see companion doc). This field is required for consistent statements and payment summaries.

**Why this priority**: Statement and payments UI logic depend on a single, validated source per package.

**Independent Test**: Create/update package with valid and invalid values; confirm validation and persistence.

**Acceptance Scenarios**:

1. **Given** package create/update forms, **When** the user enters a **product duration (days)** value, **Then** only integers **1–365** are accepted (max three digits; reject letters and out-of-range numbers).
2. **Given** a package is saved with a valid duration, **When** operations users open customer payments for a policy on that package, **Then** installment-period helpers use that stored duration (not a hardcoded constant).

---

### Edge Cases

- Customer name or filename contains characters unsafe for file names — file name MUST be sanitized while PDF content keeps correct display names and policy number formatting.
- **No** rows after filter — **Generate report** not offered or disabled.
- Policy **end date** unknown — PDF shows **"-"** for end date; generation still allowed if other validations pass.
- Very large number of payments in range — PDF generation remains acceptable for typical operational volumes (exact limits to be set during planning).
- Concurrent clicks on **Generate report** — user should not receive corrupt or duplicate confusing downloads (implementation detail in plan).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST show **Generate report** on the customer **Payments** tab only when a policy is selected, filters have been run, and **at least one** **confirmed received** payment exists for that filter.
- **FR-002**: System MUST generate a **Premium Statement** PDF that follows the **approved** visual template (branding, header layout, typography consistent with samples).
- **FR-003**: PDF MUST list **only** **confirmed received** payments for the **selected policy** and **applied from/to filter** (full result set, not limited to current UI page).
- **FR-004**: PDF header MUST include **total premium paid** equal to the **sum of amounts** of the **same rows** as in the PDF table (filtered, confirmed only).
- **FR-005**: PDF header MUST include **all-time captured payments** (confirmed only) for the policy **ignoring** the from/to filter, scoped from **policy start** as defined in the technical companion.
- **FR-006**: PDF MUST include **premium due** using **installment cadence** from policy start through the statement **as-of** date (**UTC midnight**), **inclusive** of start and as-of date, with **floor** rounding for complete periods; compare to **captured** paid totals per companion; show **excess payment** indication when paid exceeds expected.
- **FR-007**: System MUST NOT offer **Generate report** for **postpaid** policies (disabled with explanation).
- **FR-008**: System MUST refuse generation and show **contact support** messaging when **policy number** is missing, **policy start date** is missing, or **premium** is **zero**; each case MUST emit a **warning** to the error monitoring system.
- **FR-009**: **Product** line on the statement MUST use the **package** commercial name (not ambiguous internal ids in customer-facing PDF).
- **FR-010**: Downloaded file name MUST follow: `DD-MonthName-{product and plan label} Premium-Statement-{FullName}-{PolicyNumberWithHyphens}.pdf` with filesystem-safe sanitization.
- **FR-011**: Administrators MUST be able to set **package product duration (days)** on create and update with validation **1–365**, numeric only; default-on-create behavior MUST match companion document.
- **FR-012**: Customer payments experience that shows “installments per premium period” MUST use the **package’s stored duration** when present.

### Key Entities *(include if feature involves data)*

- **Customer**: Principal member; full name on salutation and filename.
- **Policy**: Policy number, start/end dates, status, installment amount, payment cadence, product display name; links to package and plan.
- **Package**: Commercial name; **product duration (days)** for premium-period math.
- **Policy payment**: Payment type, references, expected/actual dates, amount, **confirmation state** (must align with “confirmed received” definition).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a filter returning **N** confirmed payments, the generated PDF contains **exactly N** table rows and the header **filtered total** matches the sum of those rows.
- **SC-002**: **95%** of generation attempts for valid prepaid policies complete with a downloadable PDF within **10 seconds** under normal load (tunable during implementation).
- **SC-003**: **100%** of attempts under invalid-data rules (FR-008) produce **no** PDF and **do** show user-visible **contact support** messaging.
- **SC-004**: Operations users can generate a statement without leaving the customer payments context in **three steps** after data is loaded: select policy → filter → generate.

## Assumptions

- Approved PDF samples and logo asset are available to the implementation team as reference for visual parity.
- “Confirmed received” payment states are already defined in the platform’s payment lifecycle; this spec relies on that definition being applied consistently for the statement and totals (see technical companion for enum-level mapping).