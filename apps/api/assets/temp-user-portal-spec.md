# Feature Specification: Customer Self-Service Portal (`/self/customer`)

**Feature Branch**: `001-customer-self-service` (suggested)  
**Created**: 2026-04-04  
**Status**: Draft  
**Input**: Product and security requirements for a temporary web self-service area for customers (Supabase Auth, PIN-first UX, parity with agent customer detail tabs where applicable).

## Clarifications

### Session 2026-04-04

- **Identity coupling**: `customers.id` (UUID) MUST equal `auth.users.id` for customer-role users created by this feature (Supabase Admin `createUser` with custom `id`). No separate `customer.supabaseUserId` column.
- **Sign-in identifier**: Supabase password sign-in uses a **synthetic email** derived from the customer’s **national** phone: `{canonicalNationalPhone}@maishapoa.customer` (canonical form: leading `0`, no spaces, e.g. `0722111333`).
- **User-facing copy**: Labels **Phone number** and **PIN** (not “username/password”). Initial credential before PIN setup uses national **ID number** as the Supabase password only for first-time access; then the user MUST set a **4-digit PIN** (new Supabase password).
- **PIN completion flag**: `user_metadata.InitialPasswordReset` — `false` at customer/account creation; set to `true` only via **trusted server** after successful PIN setup. After server updates metadata/password, the **client MUST refresh the session** so JWT/session reflects the new metadata.
- **Role**: New metadata role `customer`. Routes under `/self/customer/**` are for **customer** sessions only. Blocking users who have both `customer` and internal roles at login is **out of scope** for this iteration.
- **ID number changes**: Do **not** sync Supabase password when `idNumber` changes in the DB (PIN is independent after setup).
- **Temporary scope**: This portal is interim until customer-facing APIs and native/web apps exist; prefer **reusing** existing capabilities where possible without weakening internal/partner API boundaries.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generic login (Priority: P1)

A customer opens `/self/customer`. They enter their **phone number** (national format) and **PIN** (or ID number only when they have not yet completed PIN setup — see US-3). After successful authentication they are taken to **`/self/customer/:customerId`** where `customerId` matches their session identity.

**Independent Test**: Create a test customer with Auth user; open `/self/customer`, sign in with synthetic email mapping + correct secret; land on `/self/customer/{uuid}` and see authorized content.

**Acceptance Scenarios**:

1. **Given** a customer with a valid Auth account and completed PIN (`InitialPasswordReset=true`), **When** they submit national phone + PIN on `/self/customer`, **Then** they are authenticated and navigated to `/self/customer/:customerId` for their own id.
2. **Given** invalid phone/PIN, **When** they submit the form, **Then** they see a clear error and are not taken to a customer detail page.
3. **Given** the login screen, **When** the user views labels, **Then** they see **Phone number** and **PIN** (not username/password).

---

### User Story 2 - Customer-specific link login (Priority: P1)

A customer opens `/self/customer/:customerId` from SMS/WhatsApp/email. The page shows **non-editable** context: phone number (national), first name, and last name. The form only asks for **PIN** (or ID for pre-PIN-setup — coordinated with US-3). After login they remain on a valid route under their customer.

**Independent Test**: Hit deep link with known `customerId`; verify masked or full phone display per policy; sign-in succeeds only for matching account.

**Acceptance Scenarios**:

1. **Given** a valid `customerId` for a provisioned customer, **When** the user opens `/self/customer/:customerId`, **Then** the page shows phone + name context and credential field(s) appropriate to PIN vs first-time flow.
2. **Given** a non-existent `customerId`, **When** an unauthenticated user opens the link, **Then** they are redirected to generic login (`/self/customer`) without leaking whether the id existed (exact messaging to follow security policy).
3. **Given** an authenticated session whose `customerId` does not match the URL `customerId`, **When** the page loads, **Then** the system signs them out and redirects to `/self/customer` with **no** return URL / no customer id in the query string.

---

### User Story 3 - First-time PIN setup (Priority: P1)

For new accounts, `user_metadata.InitialPasswordReset` is `false`. After the first successful sign-in (using ID number as password until policy changes), the user MUST be presented with controls to set a **4-digit PIN** only. On success, the server updates the Supabase password to the PIN and sets `InitialPasswordReset=true`, then the client refreshes the session. The user then proceeds to normal navigation.

**Independent Test**: Account with `InitialPasswordReset=false`; login with ID; forced PIN UI; after submit, metadata reads `true` after refresh; subsequent logins use phone + PIN only.

**Acceptance Scenarios**:

1. **Given** `InitialPasswordReset=false`, **When** the user signs in successfully, **Then** they cannot access main self-service content until a valid 4-digit PIN is set and confirmed per UI rules.
2. **Given** PIN setup completes successfully, **When** the server responds OK, **Then** the client refreshes session and `InitialPasswordReset` appears `true` without a full re-login if product allows, or after refresh session shows updated metadata.
3. **Given** PIN setup, **When** validation fails (wrong length, mismatch), **Then** errors are clear and password/PIN is not left in a half-updated state.

---

### User Story 4 - Products list and single-product redirect (Priority: P2)

From `/self/customer/:customerId/products`, the customer sees their products. If they have **exactly one** product, the system redirects them to `/self/customer/:customerId/products/:productId`. The user can still open the products list (e.g. via navigation).

**Independent Test**: Customer with 0, 1, N products; verify redirect only for 1; list remains reachable.

---

### User Story 5 - Product detail parity with agent customer view (Priority: P1)

On `/self/customer/:customerId/products/:productId`, the customer sees the same tabbed experience as the agent **customer detail** flow for **their** data: **Customer Details** (default), **Products**, **Payments**, **Member cards**. Data access MUST be scoped to the authenticated customer; product MUST belong to that customer.

**Independent Test**: Compare tab presence and core actions with `dashboard/customer/[customerId]` for the same customer (as staff) vs self-service (as customer); customer cannot see others’ data.

**Acceptance Scenarios**:

1. **Given** a valid customer and product, **When** the customer opens the product detail route, **Then** all four tabs exist and behave consistently with the existing agent implementation where applicable.
2. **Given** `productId` not owned by `customerId`, **When** the route is requested, **Then** if authenticated, session is cleared and user is sent to `/self/customer` with no return path; if unauthenticated, redirect to `/self/customer` similarly.

---

### User Story 6 - Payments tab and package-plan filter UX (Priority: P2)

On **Payments** (self-service **and** existing agent customer payments UI), if the customer has **only one** policy/package-plan applicable to the filter dropdown, that option MUST be **auto-selected** so the filter action is enabled by default when product context implies a single plan.

**Independent Test**: One-plan vs multi-plan customers; verify pre-selection and filter enabled state in both surfaces.

---

### User Story 7 - Welcome SMS and support numbers (Priority: P2)

The existing **customer created** welcome notification is updated to include a **customer-specific** link `/self/customer/:customerId` and support contact lines. Placeholders include `medical_support_number` and `general_support_number` sourced from **`system_settings`** (seed/migration). Values in DB are **plain** numbers (no braces). Template copy is agreed with stakeholders.

**Independent Test**: Create customer; message enqueue contains expanded text; placeholders resolve from settings.

---

### Edge Cases

- **Auth user creation fails** after customer row exists: retry/compensate; document operational runbook (no orphaned long-term state without detection).
- **Legacy customers**: Backfill script creates Auth users with `id = customers.id` and `InitialPasswordReset=false`, synthetic email from phone; relax Supabase password policy as needed for initial secrets during migration window.
- **Session stale metadata after PIN update**: always **refresh session** after successful PIN+metadata update.
- **URL tampering**: `customerId`/`productId` mismatch or not found → logout if needed; redirect to `/self/customer`; **no** `returnUrl` exposing prior path.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide routes under `/self/customer` for generic login and `/self/customer/:customerId` for deep-link login, plus `/self/customer/:customerId/products` and `/self/customer/:customerId/products/:productId`.
- **FR-002**: Customer Auth MUST use role `customer` in `user_metadata.roles`; sign-in MUST use synthetic email `{canonicalNationalPhone}@maishapoa.customer`.
- **FR-003**: For new customer Auth users, `user_metadata.InitialPasswordReset` MUST be `false`; after PIN setup it MUST be `true`, updated only server-side.
- **FR-004**: The client MUST call **session refresh** after successful PIN setup so `InitialPasswordReset` and session stay consistent.
- **FR-005**: `customers.id` MUST equal `auth.users.id` for provisioned customer accounts (Admin createUser with explicit `id`).
- **FR-006**: Creation order MUST be: **create customer row first**, then **create Auth user** with same UUID; failures on step two MUST be handled with retry/compensation.
- **FR-007**: Self-service pages MUST enforce that URL `customerId` matches the authenticated customer; mismatches MUST result in logout + redirect to `/self/customer` without return URL.
- **FR-008**: `productId` MUST be validated as belonging to the customer in scope; otherwise same security handling as FR-007.
- **FR-009**: Product detail view MUST expose tabs: Customer Details, Products, Payments, Member cards, with behaviour aligned to the existing agent customer detail experience.
- **FR-010**: Payments tab MUST auto-select the package-plan dropdown when there is exactly one selectable plan (self-service and agent customer payments UI).
- **FR-011**: Welcome **customer_created** (or successor) messaging MUST include `customer_specific_weblogin` pointing to `/self/customer/:customerId` and MUST resolve `medical_support_number` and `general_support_number` from `system_settings`.
- **FR-012**: Seed/migration MUST add `system_settings` keys for `general_support_number` (`0746907934`) and `medical_support_number` (`0113569606`) as plain values.

### Non-functional / Security

- **NFR-001**: No reliance on secrecy of `customerId` alone; all authorization MUST be session-based and server-validated.
- **NFR-002**: Prefer reusing existing internal APIs **without** broad refactors; where customer identity cannot be represented safely, introduce a minimal customer-scoped boundary (document tradeoff).
- **NFR-003**: UTC rules for server-side dates per project standards; display formats follow existing UI.

### Key Entities

- **Customer**: UUID `id`; national phone; names; `idNumber` for initial password only.
- **Auth user (customer)**: Same UUID as customer; synthetic email; password/PIN; `user_metadata` includes `roles: ['customer']` and `InitialPasswordReset`.
- **Product / policy context**: As used today for agent customer detail and payments filtering.

## Success Criteria *(mandatory)*

- **SC-001**: A provisioned customer can complete first-time login, set a 4-digit PIN, refresh session, and reach product detail with all four tabs using only self-service routes.
- **SC-002**: Customers cannot view or act on another customer’s data by editing `customerId` or `productId` in the URL.
- **SC-003**: Welcome message includes the self-service link and correct support numbers from settings.
- **SC-004**: Single-product customers are routed to their product detail path but can still open the products list.

## Scope Boundaries

**In scope**: Next.js self-service area, Supabase provisioning on customer creation, PIN flow, SMS template + settings seed, payments dropdown auto-select (agent + self-service), backfill script, security redirects.

**Out of scope (this iteration)**: Blocking users that have both internal and customer roles; full public customer API productization; password change flows beyond initial PIN setup (unless explicitly added).

## Assumptions

- Supabase project supports Admin `createUser` with custom `id` (confirmed by stakeholder).
- Supabase password policy can accommodate migration window (relaxed or staged).
- Single national phone uniqueness per customer remains a business invariant.