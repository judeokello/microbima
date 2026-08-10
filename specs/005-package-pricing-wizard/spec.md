# Feature Specification: Package Pricing Storage & Admin Wizard

**Feature Branch**: `005-package-pricing-wizard`  
**Created**: 2026-08-10  
**Status**: Draft  
**Input**: User description: "Implement docs/proposals/package-pricing-db-wizard.md — persist package pricing in the shared database, admin three-step wizard (setup, pricing grid, product utilization placeholder), lookup-only rates (remove extrapolate), configurable family groupings, soft loss warnings, activation gating when pricing incomplete, migrate existing static pricing, switch registration flows off static files."  
**Intake source**: [`docs/proposals/package-pricing-db-wizard.md`](../../docs/proposals/package-pricing-db-wizard.md)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin defines complete package pricing before activation (Priority: P1)

A **setup_admin** creates a new insurance package: they complete package setup (name, slug, description, logo, payment frequencies and installment counts), then enter a pricing grid where they define family groupings (member only, up to N members, additional spouse), add plan columns, and fill an amount for every plan × grouping × enabled payment frequency. Until every required cell is filled, they cannot activate the package. After a complete save, they can activate it so agents may offer it during registration. Staff without `setup_admin` can list/view packages but cannot create or edit them.

**Why this priority**: Without durable, complete pricing, the business cannot safely sell packages or stop relying on redeploy-only static rate files.

**Independent Test**: Create a package, leave one pricing cell empty, confirm activation is blocked; fill all cells, activate, confirm the package appears for registration selection.

**Acceptance Scenarios**:

1. **Given** a new package with at least one plan, one family grouping, and one or more enabled payment frequencies, **When** any required pricing cell is empty, **Then** the admin cannot set the package active.
2. **Given** all required pricing cells have positive amounts saved, **When** the admin chooses to activate the package, **Then** the package becomes active and is available in registration package selection.
3. **Given** the admin is on the pricing step with Member only present, **When** they optionally add a plan column or an “up to N” grouping with a new N not already used on that package, **Then** the grid expands and incomplete cells for defined groupings block activation until filled.
3a. **Given** a package with only the Member only grouping, **When** the admin fills all required rates for Member only (enabled frequencies + annual) across active plans, **Then** pricing may be complete without Up to N or Additional spouse.
4. **Given** payment frequencies selected in setup, **When** the admin opens the pricing grid, **Then** those frequencies appear as rows for every grouping section (Custom frequency is never offered), and an annual amount row/cell is always present for completeness even if Annually is not a selectable payment frequency.

---

### User Story 2 - Drop-in replacement for registration payment pricing (Priority: P1)

During customer registration payment (and the same pattern on product modify and recovery payment), the agent keeps the familiar selection flow: insurance plan, family category, optional additional spouse, and payment frequency. Stored package pricing is a **drop-in replacement** for the outgoing static pricing sheets—same agent-facing choices and premium summary behavior, with amounts coming only from stored table rates (lookup-only), not from multiplying a daily rate by cadence and not from static files bundled with the web app.

**Why this priority**: Agents must continue registering customers without a redesigned payment step; rate correctness and deploy-independent updates must not break the existing registration UI contract.

**Independent Test**: Walk registration payment for a migrated package: plan/category/spouse/frequency controls still work as today; installments match stored cells; no “extrapolate from daily” copy or behavior; missing static files do not break the flow.

**Acceptance Scenarios**:

1. **Given** an active package with complete stored pricing, **When** an agent reaches the registration payment step, **Then** they can select plan, family category, optional additional spouse (when allowed), and payment frequency using the same interaction pattern as today’s registration UI.
2. **Given** stored rates for Silver / member only including daily, weekly, monthly, and annually, **When** an agent selects monthly payment, **Then** the installment equals the stored monthly amount (not daily × month length).
3. **Given** additional spouse is opted in on a non–member-only category (and more than one spouse when household data is known), **When** pricing is calculated, **Then** the spouse add-on for that frequency is added to the category rate.
4. **Given** the household category is member-only, **When** the agent views payment options, **Then** additional spouse premium is not offered.
5. **Given** household size is known and the agent selects an undersized category, **When** they attempt to complete payment, **Then** submit is blocked with a clear message.
6. **Given** household size is not yet known, **When** the agent selects a family category, **Then** selection is allowed without undersize validation until size is known at payment submit.
7. **Given** package rates were updated by an admin and saved, **When** a new registration uses that package (without a product redeploy), **Then** the new amounts appear in the same payment summary areas agents already use.
8. **Given** cutover is complete, **When** registration payment loads pricing for a package, **Then** it succeeds from stored pricing even if static pricing files are absent.

---

### User Story 3 - Incomplete edit disables an active package with warning (Priority: P2)

An admin opens an already-active package and persists a change that leaves pricing incomplete (adds a plan, adds a family grouping, or enables a new payment frequency without complete rates). As soon as that change is saved to product data—not waiting for a full grid save or leaving the page—the package is marked inactive, a clear warning explains that new customers cannot be registered into it until pricing is complete, and activation is only available again after a full save with all required cells populated.

**Why this priority**: Prevents selling packages with missing rates while making the operational impact obvious to admins.

**Independent Test**: Start from an active package with complete pricing; add a plan without filling rates; confirm package becomes inactive, warning is shown, and the package disappears from registration selection until completed and reactivated.

**Acceptance Scenarios**:

1. **Given** an active package with complete pricing, **When** the admin persists a new plan that creates empty required cells, **Then** the package is set inactive as part of that save and a warning states that new customers cannot register into it until editing is complete.
2. **Given** an active package, **When** the admin persists a new “up to N” grouping or enables a new payment frequency without rates, **Then** the same inactive + warning behavior applies on that persist.
3. **Given** the package was auto-deactivated due to incomplete pricing, **When** the admin saves a complete grid, **Then** they are offered the ability to activate again (activation is not forced automatically).
4. **Given** a package is inactive for incomplete pricing, **When** an agent opens registration package selection, **Then** that package does not appear for new selection.
5. **Given** an agent already selected the package and is mid-registration when it becomes inactive, **When** they complete payment, **Then** submit is still allowed using stored rates (not blocked solely due to later deactivation).

---

### User Story 4 - Pricing grid edit experience and soft loss warnings (Priority: P2)

On the pricing grid, the admin double-clicks a cell to enter or change an amount. While changing an existing value, the cell shows the previous amount (dimmed or struck through) and the new amount (distinct emphasis color). If a coarser frequency amount is lower than what would be expected from the finest enabled frequency on that section/plan (using standard day cadences: day=1, week=7, month=31, quarter=90, year=365), the cell shows a soft warning icon; the admin may still save.

**Why this priority**: Matches underwriter sheet workflows and reduces accidental underpricing without blocking legitimate commercial exceptions.

**Independent Test**: Edit a filled cell and confirm previous/new display; enter a weekly amount below daily×7 and confirm a warning appears but save succeeds.

**Acceptance Scenarios**:

1. **Given** a cell with an existing amount, **When** the admin double-clicks and enters a new amount, **Then** both previous and new values are visible in the cell, the previous value is dimmed or struck through, and the new value uses a distinct emphasis color.
2. **Given** daily=100 and weekly enabled, **When** the admin commits a cell edit with weekly=500 (blur/Enter), **Then** a soft loss warning appears within 1 second and save remains allowed.
3. **Given** daily is not enabled and weekly=1000 is the finest band, **When** the admin enters monthly below the expected floor from weekly×(31/7), **Then** a soft loss warning appears and save remains allowed.
4. **Given** the admin wants help filling empty cells, **When** they use the MVP suggest/fill helper based on a lower band × cadence, **Then** empty cells receive editable suggested amounts that apply only after save, and customer payment never invents missing rates.

---

### User Story 5 - Three-step wizard including utilization placeholder (Priority: P3)

Package create/edit uses a three-step flow: (1) Package setup, (2) Pricing grid, (3) Product Utilization Configuration. Step 3 is intentionally empty in this release aside from its title and a Finish action that completes the wizard and returns the admin to the package context.

**Why this priority**: Establishes the agreed navigation shell for future utilization work without blocking pricing delivery.

**Independent Test**: Walk create and edit flows through all three steps; confirm step 3 shows the titled placeholder and Finish exits successfully.

**Acceptance Scenarios**:

1. **Given** the admin is creating or editing a package, **When** they progress through the wizard, **Then** they see steps Setup → Pricing → Product Utilization Configuration.
2. **Given** the admin is on Product Utilization Configuration, **When** they choose Finish, **Then** the wizard closes and they return to the package management context.
3. **Given** step 3 is shown, **When** the admin views it, **Then** no utilization settings are required to finish.

---

### User Story 6 - Existing Mfanisi packages keep sellable rates after cutover (Priority: P1)

After go-live of this feature, existing Mfanisi Boda and Mfanisi Go packages expose the same rate bands previously maintained in their static pricing sheets (explicit daily/weekly/monthly/annually values from those sheets), via the new stored pricing—not via extrapolating daily rates. Static pricing files are no longer used for registration, modify, or recovery.

**Why this priority**: Production continuity for live products.

**Independent Test**: For each migrated package, compare key plan/category/frequency amounts to the pre-cutover sheet values; complete a registration payment selection and confirm amounts match stored bands.

**Acceptance Scenarios**:

1. **Given** Mfanisi Boda rates were migrated, **When** an admin opens the pricing grid, **Then** Silver/Gold groupings and spouse add-ons match the prior sheet amounts for each frequency that was defined.
2. **Given** Mfanisi Go has complete stored rates (migrated sheet bands plus any admin-filled gaps), **When** monthly payment is selected at registration, **Then** the stored monthly band is charged (not daily × 31), even if that differs from pre-cutover extrapolate behavior.
3. **Given** cutover is complete, **When** registration/modify/recovery loads pricing, **Then** it does not depend on static pricing files in the web app.
4. **Given** Go migration leaves any required cell empty, **When** an admin completes those cells before activation/cutover validation, **Then** Go is sellable under the same completeness rules as any other package.

---

### Edge Cases

- Household size exceeds every “up to N” band configured on the package → enrollment/payment cannot proceed for that household until an adequate band exists; the system does not silently use a smaller band.
- Package has no plans or is missing the required Member only grouping → pricing is incomplete; activation blocked.
- Package with only Member only (no Up to N / no Additional spouse) → allowed; family sizes above 1 cannot be priced until an adequate Up to N exists (overflow blocked).
- Admin removes a payment frequency that had rates → those rates are no longer required; remaining enabled frequencies must still be complete for activation.
- Admin removes a plan or category → related rates are removed from the completeness check; package may become complete again without them.
- Duplicate “up to N” for the same N on one package → rejected with a clear validation message.
- Amounts of zero or negative → not accepted as valid filled cells for completeness.
- Quarterly (or any enabled frequency) with no amount → incomplete pricing.
- Annually payment frequency disabled but annual amount missing for any plan × grouping → incomplete pricing; annual summary at payment uses stored annual when present.
- Additional spouse section present but member-only selected at payment → spouse add-on not applied.
- Concurrent admin edits → last successful save wins; activation rules re-evaluated from saved state.
- Admin starts typing a new plan name but has not persisted it → package remains active; deactivation occurs only when the incomplete-making change is saved.
- Package becomes inactive while an agent is mid-registration with that package already selected → in-flight payment may complete; new enrollments cannot newly select it.
- Historical policies already carrying stored premiums → unchanged by later rate edits (new enrollments/modifies use current rates).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST persist package pricing (plan × family grouping × payment frequency amounts) in durable shared product data so authorized admins can change rates without a production redeploy.
- **FR-002**: System MUST stop depending on static pricing files shipped with the registration app for registration payment, product modify, and recovery payment after cutover.
- **FR-002a**: Stored package pricing MUST be a drop-in replacement for the outgoing static pricing sheets for agent registration: the registration payment step MUST continue to present selectable plans, family categories (from the package’s configured groupings), optional additional spouse, payment frequency, and premium summary without requiring agents to learn a new payment workflow.
- **FR-002b**: Product modify and recovery payment flows that today consume the same static pricing shape MUST consume stored pricing the same way, preserving their existing selection patterns.
- **FR-003**: System MUST charge installments using only stored amounts for the selected payment frequency (lookup-only), and MUST present annual premium using the stored annual amount (lookup-only). The system MUST NOT multiply daily rates by cadence at payment time.
- **FR-004**: System MUST remove “extrapolate” pricing mode as a product concept; there is a single pricing behavior based on stored cells. Registration UI copy that refers to extrapolating from daily/weekly MUST be removed or replaced with table-rate wording.
- **FR-005**: Registration admins MUST complete package create/edit through a three-step flow: Package Setup → Pricing → Product Utilization Configuration (placeholder) → Finish.
- **FR-006**: Package Setup MUST allow configuring supported payment frequencies and installment counts for Daily, Weekly, Monthly, Quarterly, and Annually, and MUST NOT offer Custom frequency for packages.
- **FR-007**: Pricing step MUST present a grid whose rows are the package’s enabled payment frequencies, sections are family groupings, and columns are package plans.
- **FR-008**: Admins MUST define a Member only grouping on every package. They MAY add one or more Up to N members groupings (custom N, unique per package) and MAY add an Additional spouse grouping. Up to N and Additional spouse are not required for pricing completeness when absent.
- **FR-009**: Additional spouse MUST NOT apply when the resolved household category is Member only.
- **FR-010**: Admins MUST be able to add plan columns on the pricing grid (creating or using package plans), and MUST double-click cells to enter or edit amounts.
- **FR-011**: When editing an existing cell amount, the UI MUST show the previous and new values together in the same cell: the previous amount MUST be visually de-emphasized (dimmed or struck through), and the new amount MUST use a distinct emphasis style (e.g. theme primary or warning text color, not the same style as the previous value).
- **FR-012**: Pricing is complete only when every active plan × every defined pricing grouping (including Additional spouse if defined) has a saved amount greater than zero for (a) every enabled package payment frequency and (b) an annual amount, even when Annually is not enabled as a customer payment frequency.
- **FR-012a**: Registration / modify / recovery screens that show an annual premium MUST use the stored annual amount (lookup-only), never daily×365 or other extrapolation.
- **FR-013**: System MUST prevent activating a package when pricing is incomplete.
- **FR-014**: When an admin persists a change that makes an active package’s pricing incomplete (including adding a plan, adding a pricing grouping, or enabling a payment frequency without complete rates), the system MUST deactivate the package as part of that persist and warn that new customers cannot be registered into it until pricing is complete. Unsaved UI-only drafts MUST NOT leave the package active while incomplete product data already exists.
- **FR-015**: After pricing becomes complete again, activation MUST be available to the admin but MUST NOT auto-reactivate without an explicit activate action.
- **FR-016**: Inactive packages MUST NOT appear in registration package selection for **new** enrollments. Agents already mid-registration who selected the package before it became inactive MUST still be allowed to complete payment/submit for that journey using stored rates; the system MUST NOT hard-block those in-flight submits solely because the package was later deactivated.
- **FR-017**: System MUST show a soft loss warning when a coarser frequency amount is below the floor implied by the finest enabled frequency amount on that plan/grouping using cadences day=1, week=7, month=31, quarter=90, year=365. The warning MUST appear within 1 second of **cell edit commit** (blur, Enter, or equivalent confirm after double-click edit)—not on every keystroke and not deferred until full grid save. Saving MUST still be allowed.
- **FR-018**: System MUST offer an admin-only helper to suggest or fill empty cell values from a lower band × cadence (using the same cadence days as soft loss warnings). Suggested values MUST remain editable and MUST be saved explicitly to take effect. The helper MUST NOT silently overwrite non-empty cells unless the admin confirms a refill action. Runtime payment MUST NOT invent missing rates.
- **FR-019**: Family categories shown at registration payment MUST come from the package’s configured pricing groupings (not a hard-coded global list). When the system resolves or validates household size against bands: size 1 maps to Member only; size &gt; 1 maps to the smallest Up to N where N ≥ household size. If no band fits, the system MUST block that pricing path with a clear message (no silent clamp to a smaller band).
- **FR-019a**: At registration payment, agents MUST still choose the family category from the package’s available groupings (drop-in with today’s picker). Household size is **known** when the registration (or modify) flow has a countable set of principal + active dependants (dependants captured or otherwise available on the current journey). When size is known, the system MUST NOT allow completing payment on a category that cannot cover that size. When size is **not yet known**, category selection remains allowed without the undersize check; the check MUST run at payment submit once size is known.
- **FR-020**: Additional spouse control MUST be disabled when the selected family category is Member only and enabled for other selected groupings (drop-in with today’s registration UI). The spouse add-on rate for the selected frequency MUST be included when the agent opts in via that control. When household dependant data is known and there is not more than one active spouse, the system MUST block applying the add-on (opt-in alone is insufficient).
- **FR-021**: Existing Mfanisi Boda and Mfanisi Go rate bands from current static sheets MUST be migrated into stored pricing as explicit amounts before static files are removed. After migration, both packages MUST use lookup-only charging. For Go, any missing required cells (enabled frequencies + annual per plan × grouping) MUST be filled by admin before the package can be active; amounts MAY differ from historical extrapolate installments and MUST be validated in UAT prior to production cutover.
- **FR-022**: Product Utilization Configuration step MUST be titled and reachable, require no inputs in this release, and provide Finish to exit the wizard.
- **FR-023**: Activation and incompleteness rules MUST be enforced centrally for all clients; bypassing the admin UI MUST NOT allow activating a package with incomplete pricing.
- **FR-024**: Package listing and read-only package detail MUST remain available to staff roles that can access admin underwriters/packages today (including `registration_admin` and `customer_care`). Creating packages, editing package metadata/frequencies, managing package plans for pricing, editing pricing categories/rates, and activating/deactivating packages MUST require the `setup_admin` role. Callers without `setup_admin` MUST receive authorization failure on those mutate APIs and MUST NOT see Create/Edit/Activate controls in the UI.
- **FR-024a**: The `setup_admin` role MUST be grantable and revocable only by the root (bootstrap) user. A `registration_admin` (or any non-root user) MUST NOT be able to add or remove `setup_admin` on themselves or others. Role assignment UI MUST show the `setup_admin` checkbox only to the root user; API user-update paths that set roles MUST enforce the same rule server-side. Bootstrap/seed for the root user MUST include `setup_admin` in `user_metadata.roles` (alongside existing root roles); existing deployments MUST document a one-time backfill so the current root user receives `setup_admin`.
- **FR-024b**: Payment/modify/recovery flows that **read** pricing MUST continue to work for authorized agent/admin callers through the existing product data path (read pricing does not require `setup_admin`).

### Key Entities

- **Package**: Insurance product offering; has active/inactive state, payment frequencies, plans, and pricing completeness.
- **Package payment frequency**: Enabled cadence (daily/weekly/monthly/quarterly/annually) plus installment count; defines sellable payment options and corresponding pricing grid rows.
- **Annual rate band**: Stored annual amount required for every active plan × grouping for completeness and quote/summary display; distinct from whether Annually is offered as a customer payment frequency.
- **Package plan**: Sellable tier (e.g. Silver, Gold); defines pricing grid columns.
- **Package pricing category (grouping)**: Member only (required), Up to N (optional, carries max members), or Additional spouse (optional); defines grid sections.
- **Package plan rate**: Amount for one plan × grouping × frequency cell.
- **Household / family size**: Principal plus active dependants; used to resolve pricing category at sale time.
- **Policy premium snapshot**: Amounts already stored on existing policies; not retroactively rewritten when rates change.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A `setup_admin` can create a package, complete pricing for at least two active plans across the required Member only grouping (and any optional groupings they added) for all required rate cells (enabled frequencies + annual), and activate it in one guided session without engineering involvement.
- **SC-002**: After an admin updates a rate and saves, a new registration started afterward shows the updated installment without waiting for a production redeploy.
- **SC-003**: 100% of registration payment, modify-product, and recovery payment flows that previously read static pricing files instead use stored package pricing; static pricing files are unused for those flows.
- **SC-003a**: An agent who already knows today’s registration payment step can complete plan → category → spouse (if applicable) → frequency → premium confirmation for a migrated package without new training materials beyond “rates now update without redeploy.”
- **SC-004**: In test scenarios, selecting each enabled frequency for a migrated package yields the stored band amount (plus spouse when applicable) with zero use of daily×cadence extrapolation.
- **SC-005**: Attempting to activate a package with any missing required cell fails 100% of the time; completing the grid allows activation.
- **SC-006**: Persisting a new plan (or other incomplete-making change) on an active package deactivates it in that same save, shows a visible admin warning, and removes it from registration selection until reactivated after complete pricing—without requiring the admin to save the full pricing grid or leave the page first.
- **SC-007**: Soft loss warnings appear within 1 second of committing a below-floor cell edit (blur/Enter/confirm), without blocking save.
- **SC-007a**: An admin can use suggest/fill to populate empty cells for a plan × grouping from a lower band in under 30 seconds, then adjust and save before activation.
- **SC-008**: Migrated Mfanisi Boda packages show rate parity with their prior sheet bands for previously defined intersections. Mfanisi Go shows parity with its migrated/filled stored bands (lookup-only); before production cutover, a `setup_admin` completes the quickstart Go comparison checklist (vs old extrapolate where relevant) and gives informal sign-off.

## Clarifications

### Session 2026-08-10

- Q: Should stored pricing integrate as a drop-in with the existing agent registration payment UI? → A: Yes — same plan / family category / additional spouse / frequency selection and premium summary patterns; stored pricing replaces static sheets without redesigning the registration payment workflow. Undersized category vs household is blocked when household data can be checked.
- Q: When does auto-deactivation take effect for an incomplete-making edit on an active package? → A: Deactivate immediately when the incomplete-making change is persisted (e.g. new plan, new grouping, or newly enabled frequency without complete rates)—not only on full grid save, leave/navigate, or manual deactivate.
- Q: Is an annual amount required when Annually is not an enabled payment frequency? → A: Always require a stored annual amount per plan × grouping for pricing completeness and payment/quote summary, whether or not Annually is a selectable customer payment frequency (no daily×365 derivation).
- Q: What family groupings are required on a package? → A: Member only is required; Up to N and Additional spouse are both optional.
- Q: Is an admin suggest-fill-from-lower-band helper in MVP? → A: Yes — required in MVP; admins can suggest/fill empty cells from a lower band × cadence, then edit and save explicit values.
- Q: How should Mfanisi Go behave after removing extrapolate? → A: Lookup-only using stored bands (migrate sheet values and/or admin-provided amounts for any gaps). Charged installments may differ from old daily×cadence extrapolate; validate in UAT before production cutover. No Go-only extrapolate exception.

### Session 2026-08-10 (analyze remediation)

- Q: SC-001 vs Member-only-only groupings? → A: SC-001 requires two active plans and complete rates for required Member only (optional groupings if added)—not a mandatory second family grouping.
- Q: Category API before US1 UI? → A: `POST .../pricing/categories` is implemented in US1 before the add-category UI; US3 only wires deactivate-on-incomplete for that persist.
- Q: Foundational vs US3 deactivate? → A: Foundational owns completeness + activate-reject only; US3 owns auto-deactivate on incomplete-making persists.
- Q: Spouse premium rule? → A: Control enabled only when category ≠ Member only; apply on opt-in; if household known and ≤1 spouse, block applying the add-on.
- Q: Cell highlight definition? → A: Previous dimmed/struck; new distinct emphasis color in-cell.
- Q: When is household size “known”? → A: When principal + active dependants are countable on the journey; undersize check at submit once known; skip while unknown.
- Q: How is Go UAT sign-off done before prod cutover? → A: Light process — quickstart comparison checklist (plan × category × frequency vs old extrapolate; fill gaps); `setup_admin` informal sign-off. No formal spreadsheet/ticket required for MVP.
- Q: Who can create/edit packages and pricing? → A: `setup_admin` only (A+1). Others with admin underwriters access may list/view packages read-only. Mutate scope includes package create/edit, frequencies, package plans, pricing categories/rates, activate/deactivate.
- Q: Who can assign `setup_admin`? → A: Root (bootstrap) user only via BA create/edit role UI + server-enforced role updates. `registration_admin` cannot grant/revoke `setup_admin`. Roles live in Supabase `user_metadata.roles` (not Authentik).
- Q: CUSTOM frequency regression coverage? → A: Add/extend Jest test that package create/update rejects CUSTOM payment frequency (FR-006).
- Q: When does soft-loss warning appear? → A: Within 1s of cell edit commit (blur/Enter/confirm), not per keystroke and not only on full grid save.
- Q: In-flight registration if package auto-deactivated? → A: New picker selections blocked; mid-flow journeys that already chose the package may finish payment using stored rates.
- Q: Does root get `setup_admin` automatically? → A: Yes — bootstrap/seed root includes `setup_admin`; document one-time backfill for existing root users.

## Assumptions

- Cadence days for soft loss warnings and admin suggest-helpers are 1 / 7 / 31 / 90 / 365 (aligned with existing payment cadence definitions), not spreadsheet installment-count divisors (10 / 45 / 315).
- MVP does not require durable per-cell revision history beyond the in-session previous/new edit display; audit of who changed rates may follow later.
- Cutover is big-bang for pricing reads (migrate data, switch all consumers, remove static file dependency) rather than a long-lived dual-read feature flag.
- Quarterly, when enabled on a package, is a required grid row like any other enabled frequency.
- Every enabled payment frequency requires a stored amount. Separately, an annual amount is always required per active plan × grouping for completeness and for annual premium display, even when Annually is not an enabled payment frequency. Annual display MUST NOT derive from daily×365.
- “Active plan” for completeness means plans marked active for sale on the package.
- Overflow households (larger than every Up to N, or size &gt; 1 when no Up to N exists) are blocked rather than clamped, to avoid undercharging.
- Member only is the only mandatory grouping; packages may ship without family bands or spouse add-on until the admin adds them.
- Historical policy premiums remain as originally stored.
- Step navigation may be tabs or sequential steps; the requirement is the three-step information architecture, not a specific widget style.
- “Drop-in replacement” means replacing the **data source and pricing mode** behind the existing registration / modify / recovery payment steps, not introducing a separate agent pricing UI. Visual polish may remove extrapolate-specific labels; core controls stay.
- Mfanisi Go cutover accepts lookup-only amounts that may differ from pre-cutover extrapolate; gaps after sheet import are filled by admin; no permanent Go extrapolate exception.
- Rate amounts are decimal currency values with 2 decimal places (KES / package system currency as used elsewhere in product).

## Out of Scope

- Custom payment frequency on packages or the pricing grid.
- Retaining extrapolate pricing mode for any package.
- Writing rate files onto application servers or container disks.
- Inventing missing rates at customer payment time.
- Building Product Utilization Configuration settings (placeholder only).
- Retroactive recalculation of premiums on existing policies.
- Partner-facing pricing editors outside registration admin product management.
- Durable rate revision history tables (unless added in planning as a small extra).

## Dependencies

- Existing package, plan, and payment-frequency administration.
- Existing registration payment, modify-product, and recovery flows that today depend on static pricing.
- Existing staff roles + Supabase `user_metadata.roles`; root/bootstrap user detection (`BootstrapUserService` / `RootOnlyGuard`); BA registration/management UI for role checkboxes.
- Intake decisions documented in `docs/proposals/package-pricing-db-wizard.md`.
