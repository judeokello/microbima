# Feature Specification: Customer Premium Statement PDF

**Feature Branch**: `001-premium-statement-pdf`  
**Created**: 2026-04-03  
**Status**: Draft  
**Input**: User description: "Customer Premium Statement PDF: generate downloadable statement from Customer Detail > Payments after filter; confirmed payments only; branded template; header totals and premium due; postpaid excluded; validation for incomplete policy data; package-level product duration for installment helpers."

## Clarifications

### Session 2026-04-03

- **Q:** Should the payments table in the PDF include every row the user might see in the UI for the same filters? **→ A:** The UI may be paginated; the PDF MUST include **all** matching rows for the selected period and filters, even if the current page only shows a subset. The system MUST retrieve only what is needed to render that list efficiently.
- **Q:** Which payment rows count as “confirmed received” for the statement table and for header totals that match the table? **→ A:** Only payments in states meaning **money confirmed received** (completed, or confirmed by query pending final receipt). Pending callback rows MUST NOT appear in the PDF or in those totals.
- **Q:** How should “all-time captured payments” relate to the date filter, and which payments count toward it versus **premium due**? **→ A:** The figure MUST **ignore** the from/to filter. It MUST be the sum of **amounts** of **all** **confirmed** payments for that **policy**, **regardless** of expected or actual payment dates. The **paid** amount used to compute **premium due** (versus expected installments) MUST follow **planning** rules documented with the technical companion — it does **not** have to use the same inclusion rule as all-time.
- **Q:** Policy end date missing? **→ A:** In the PDF header, show **"-"** for policy end date.
- **Q:** Filename shape? **→ A:** `DD-MonthName-{product and plan label} Premium-Statement-{FullName}-{PolicyNumberWithHyphens}.pdf` (example: `03-April-MfanisiGo Gold Premium-Statement-John Maina Mwangi-MP-MFG-001.pdf`). Slashes in policy number become hyphens in the filename only.
- **Q:** What calendar date is the **as-of** date for **premium due** (and related “through as-of” logic) versus the payments **from/to** filter? **→ A:** The **as-of** date is the **same calendar day as the printed statement date** (the day the user generates the report). The from/to filter scopes **only** the payment table and the **filtered total** header line; it does **not** change the premium-due horizon.
- **Q:** If **product duration (days)** on the linked **package** is missing (e.g. legacy data before backfill), how should the Payments UI and premium statement behave? **→ A:** **Block** premium statement generation with **contact support** messaging and record a **warning** for support (no silent default). The installment-period helper on Payments MUST **not** show a guessed number; it MUST show **unavailable** treatment consistent with the same data defect (e.g. **"—"** or an inline message to contact support until the package is corrected).
- **Q:** Who may generate a premium statement? **→ A:** The **same users** who may **view** that customer’s **Payments** tab and payment data. No **additional** permission is introduced for **Generate report**; users denied customer/payments access MUST NOT obtain a PDF through this feature.
- **Q:** How should **currency and numeric amounts** appear in the PDF versus the live **Payments** table? **→ A:** **Monetary amounts** in the PDF (table and header money fields) MUST use the **same currency and formatting conventions** as the customer **Payments** tab today, so figures match what users already see on screen.

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
6. **Given** a successful generation, **When** the user reads the header, **Then** it includes: statement date; salutation with customer full name; product; plan; premium frequency; premium amount per frequency; policy number (as printed with normal separators); **total premium paid** for the **filtered** confirmed set; **all-time captured payments** (sum of **all** **confirmed** payments on the policy, ignoring from/to filter); **premium due** per defined rules (with **paid** side per planning); **policy start** and **policy end** dates (or **"-"** for missing end); **policy status**.
7. **Given** a user **cannot** access that customer’s **Payments** data under existing rules, **When** they attempt to obtain a statement (including by direct request), **Then** they receive the **same access denial** as for payments and **no** PDF is delivered.
8. **Given** a successful generation, **When** the user compares **monetary amounts** in the PDF to the same values on the **Payments** tab, **Then** **currency and number formatting** are **consistent** with the live table (per **FR-014**).

---

### User Story 2 - Block Statement When Policy Data Is Invalid (Priority: P1)

As an operations user, if mandatory data for a statement is missing (e.g. no policy number, no policy start date, zero premium where that makes the statement invalid, or **missing package product duration** where that blocks correct premium math), I see a clear in-page error and no PDF is generated; the incident is recorded so support can follow up.

**Why this priority**: Prevents misleading statements and surfaces data issues.

**Independent Test**: Simulate each invalid condition; confirm banner text, no download, and that each case is recorded for support.

**Acceptance Scenarios**:

1. **Given** the selected policy has **no policy number**, **When** the user attempts **Generate report**, **Then** an in-page notification shows a clear **contact support** message, **no** PDF is produced, and a **warning** is recorded for support staff.
2. **Given** the selected policy has **no start date**, **When** the user attempts **Generate report**, **Then** a specific **contact support** message is shown, **no** PDF is produced, and a **warning** is recorded.
3. **Given** the policy **premium / installment amount** is **zero** (invalid for this statement), **When** the user attempts **Generate report**, **Then** a specific **contact support** message is shown, **no** PDF is produced, and a **warning** is recorded.
4. **Given** the linked **package** has **no** **product duration (days)** (legacy or misconfigured), **When** the user attempts **Generate report**, **Then** a **contact support** message is shown, **no** PDF is produced, and a **warning** is recorded.

---

### User Story 3 - Premium Due and Overpayment Presentation (Priority: P2)

As a reader of the statement, I see **premium due** computed from policy start through the **statement as-of** date using the agreed installment cadence. The **as-of** date is the **same calendar day as the printed statement date** (the day the user generates the report). If the member has paid **more** than expected to that date, the amount shown remains **positive** and is labeled as an **excess payment** per the template.

**Why this priority**: Correct financial interpretation on the statement.

**Independent Test**: Use policies with underpay, exact pay, and overpay; verify header numbers and excess label; confirm premium due uses generation-day as-of even when the payment table is filtered to an earlier date range.

**Acceptance Scenarios**:

1. **Given** expected installments to the **statement as-of** date (generation day) and total **captured** paid per planning rules, **When** expected exceeds paid, **Then** **premium due** shows the **positive** shortfall.
2. **Given** paid exceeds expected to the **statement as-of** date, **When** the user views the header, **Then** the value shown is **positive** and includes an **excess payment** indication consistent with the approved template.
3. **Given** the user has applied a **from/to** filter that ends **before** the generation day, **When** the user generates the report, **Then** the payment table reflects only that filter, but **premium due** still uses the **generation day** as the end of the as-of window (not the filter “to” date).

---

### User Story 4 - Configure Product Duration on Packages (Priority: P1)

As an administrator creating or updating a **package**, I must set **how many days in a “premium year”** apply for that product (used for installment counts shown alongside payments). The value is a whole number between **1** and **365**, numeric only; if omitted on create, the system applies the **default duration** agreed for new packages. This field is required for consistent statements and payment summaries.

**Why this priority**: Statement and payments experience depend on a single, validated source per package.

**Independent Test**: Create/update package with valid and invalid values; confirm validation and persistence.

**Acceptance Scenarios**:

1. **Given** package create/update forms, **When** the user enters a **product duration (days)** value, **Then** only integers **1–365** are accepted (at most three digits; reject letters and out-of-range numbers).
2. **Given** a package is saved with a valid duration, **When** operations users open customer payments for a policy on that package, **Then** installment-period helpers use that stored duration (not a fixed guess baked into the screen).
3. **Given** a package still has **no** **product duration (days)** in the database, **When** operations users view customer payments for a policy on that package, **Then** installment-period helpers do **not** show a fabricated number and show **unavailable** treatment per the clarification above until an administrator fixes the package.

---

### Edge Cases

- Customer name or filename contains characters unsafe for file names — file name MUST be sanitized while PDF content keeps correct display names and policy number formatting.
- **No** rows after filter — **Generate report** not offered or disabled.
- Policy **end date** unknown — PDF shows **"-"** for end date; generation still allowed if other validations pass.
- Very large number of payments in range — PDF generation remains acceptable for typical operational volumes (limits set during planning).
- User triggers **Generate report** multiple times quickly — user should not receive corrupt or confusing duplicate downloads.
- Payments **from/to** filter ends on a date **before** the statement date — table and filtered total follow the filter; **premium due** still runs through the **statement date** (generation day), not the filter “to” date.
- **Package** exists but **product duration (days)** is still null (legacy) — **Generate report** is blocked with **contact support** messaging; installment helper does not invent a duration.
- User lacks access to the customer’s **Payments** — **Generate report** is unavailable and any server-side request MUST fail with the **same** outcome as viewing payments would.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST show **Generate report** on the customer **Payments** tab only when a policy is selected, filters have been run, and **at least one** **confirmed received** payment exists for that filter.
- **FR-002**: System MUST generate a **Premium Statement** PDF that follows the **approved** visual template (branding, header layout, typography consistent with samples).
- **FR-003**: PDF MUST list **only** **confirmed received** payments for the **selected policy** and **applied from/to filter** (full result set, not limited to current UI page).
- **FR-004**: PDF header MUST include **total premium paid** equal to the **sum of amounts** of the **same rows** as in the PDF table (filtered, confirmed only).
- **FR-005**: PDF header MUST include **all-time captured payments**: the sum of **amounts** of **all** **confirmed** payments for that **policy**, **ignoring** the from/to filter, **without** excluding rows by expected or actual payment date.
- **FR-006**: PDF MUST include **premium due** using **installment cadence** from policy start through the **statement as-of** date (the **same calendar day** as the printed **statement date** / generation day), **inclusive** of start and as-of day, with **floor** rounding for complete periods; compare **expected** to the **paid** total used for premium-due math per **planning** rules (which **may differ** from the all-time inclusion rule in FR-005); show **excess payment** indication when paid exceeds expected. The payments **from/to** filter MUST **not** shorten or shift this as-of window; it applies only to the table and filtered total (FR-003, FR-004).
- **FR-007**: System MUST NOT offer **Generate report** for **postpaid** policies (disabled with explanation).
- **FR-008**: System MUST refuse generation and show **contact support** messaging when **policy number** is missing, **policy start date** is missing, **premium** is **zero**, or the linked **package** has **no** **product duration (days)**; each case MUST record a **warning** for support follow-up.
- **FR-009**: **Product** line on the statement MUST use the **package** commercial name (customer-facing label, not internal identifiers alone).
- **FR-010**: Downloaded file name MUST follow: `DD-MonthName-{product and plan label} Premium-Statement-{FullName}-{PolicyNumberWithHyphens}.pdf` with filesystem-safe sanitization.
- **FR-011**: Administrators MUST be able to set **package product duration (days)** on create and update with validation **1–365**, numeric only; default-on-create behavior MUST match planning decisions.
- **FR-012**: Customer payments experience that shows “installments per premium period” MUST use the **package’s stored duration** when it exists; when **product duration (days)** is **missing**, the experience MUST **not** invent a value and MUST align with **FR-008** and the clarification on **unavailable** helper treatment.
- **FR-013**: **Generate report** MUST be allowed only for users who are already authorized to **view** that customer’s **Payments** data; no separate “statement” permission. Denied users MUST receive the same access outcome as for payments and MUST NOT receive a PDF.
- **FR-014**: All **monetary amounts** in the PDF (payment table and header totals that are money values) MUST use the **same currency and formatting rules** as the customer **Payments** tab today, so amounts remain consistent between screen and PDF.

### Key Entities *(include if feature involves data)*

- **Customer**: Principal member; full name on salutation and filename.
- **Policy**: Policy number, start/end dates, status, installment amount, payment cadence, product display name; links to package and plan.
- **Package**: Commercial name; **product duration (days)** for premium-period math (required for statement eligibility and correct helpers once backfilled; new packages receive a validated value on create per FR-011).
- **Policy payment**: Payment type, references, expected/actual dates, amount, **confirmation state** (must align with “confirmed received” definition).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a filter returning **N** confirmed payments, the generated PDF contains **exactly N** table rows and the header **filtered total** matches the sum of those rows.
- **SC-002**: **At least 95%** of generation attempts for valid prepaid policies complete with a downloadable PDF within **10 seconds** under normal operating conditions.
- **SC-003**: **100%** of attempts under invalid-data rules (FR-008) produce **no** PDF and **do** show user-visible **contact support** messaging.
- **SC-004**: Operations users can generate a statement without leaving the customer payments context in **three steps** after data is loaded: select policy → filter → generate.

## Assumptions

- Approved PDF samples and logo artwork are available to the implementation team as reference for visual parity.
- “Confirmed received” aligns with the platform’s existing payment lifecycle; statement table and filtered total use that definition consistently.
- The technical planning companion defines the exact **paid** total used in **premium due** so it can align with **expected** installments (independent of the **all-time** header line per FR-005).
- Authorization for statement generation matches **view** access to customer **Payments** (see **FR-013**).
- Amount formatting in the PDF aligns with the **Payments** tab (see **FR-014**).
