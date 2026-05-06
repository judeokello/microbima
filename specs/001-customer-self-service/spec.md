# Feature Specification: Customer Self-Service Portal

**Feature Branch**: `001-customer-self-service`  
**Created**: 2026-04-04  
**Status**: Draft  
**Input**: User description: "Customer self-service at /self/customer: national phone + PIN sign-in; optional deep links; at registration customers receive a **one-time PIN (OTP)** for first access—members never type national ID on the portal; after first successful entry they are forced to set their own PIN; first-time completion tracked in persisted data per user; products list/detail mirroring staff customer views (four tabs); payments filter auto-select when one plan; welcome messaging with portal link and configurable support numbers. Interim until dedicated customer apps and public APIs."

## Clarifications

### Session 2026-04-04

- Q: On the personal-link sign-in screen, how should the customer’s phone number be shown? → A: **Option B** — **Partially masked** national number. **Canonical pattern:** **`07•••••` + last 4 digits** (five bullets `•` after the `07` prefix); specified in [design/maishapoa_heritage/DESIGN.md](./design/maishapoa_heritage/DESIGN.md#phone-masking-customer-portal). APIs and OpenAPI examples MUST match.
- Q: OTP **expiry**, wrong-attempt **limits**, or **resend** flows? → A: **Out of scope** for this iteration.
- Q: **Retry/monitoring** for failed follow-up SMS after PIN setup? → A: **Out of scope** for this iteration.

### Session 2026-04-05

- Q: How should first-time access work, and what credential labels should members see? → A: Members **never enter national ID** on the portal. At registration they receive a **one-time PIN (OTP)**. They sign in using **phone number** and the credential field always labeled **PIN**—on first use they enter the **OTP** in that field; the system detects first-time access from **persisted per-user data**, then **forces** them to set a new **six-digit PIN** before using the rest of the portal. After that, **PIN** always means their chosen PIN.

### Session 2026-04-06

- Q: What happens if a member forgets their PIN or is locked out? → A: **Option A** — **Out of scope for this iteration**: no self-serve forgot-PIN or automated PIN recovery in the portal; **support / agreed operational process** handles these cases.
- Q: Should OTP, portal link, and support numbers be delivered in one notification or split? → A: **Option A** — **Single** primary **customer-created** notification includes the **OTP**, the **personal portal link**, and **both** support numbers (one message per channel where channel limits allow; copy tightened in implementation if needed).
- Q: After first-time PIN setup completes, may the registration OTP still be used to sign in? → A: **Option A** — **No**; **only** the **chosen PIN** is accepted for sign-in; the **OTP MUST NOT** work after first-time PIN replacement is **complete**.
- Q: After the member completes first-time PIN setup, should there be an extra notification? → A: **Option A** — **Yes**; send a **follow-up** notification (e.g. SMS) confirming PIN setup and reminding how to sign in (**primary portal link target**: see Session 2026-04-07).

### Session 2026-04-07

- Q: Which primary URL must the PIN-setup **follow-up** notification use? → A: **Option B** — **Personal** portal link **`/self/customer/:customerId`**, **same pattern as welcome** (not generic `/self/customer` alone as the sole link).

### Session 2026-04-08 (readiness — deep-link sign-in fields)

- Q: [User Story 2] describes a single **PIN** field on the personal link, but the portal authenticates via Supabase **`signInWithPassword`** using synthetic email **`{national07}@maishapoa.customer`**. How MUST the UI behave without a separate “phone-less” sign-in API? → A: The **`/self/customer/:customerId`** route MUST collect **both** **`Phone number`** and **`PIN`** (same labels as generic entry — [FR-008], [User Story 1]). The screen STILL shows read-only masked phone and names ([FR-001a]); members re-type national phone to authenticate. This is intentional for v1.

### Session 2026-04-09 (stakeholder decisions — OTP, legacy cohort, PIN strength, roadmap)

- Q: Confirm **six-digit registration OTP** remains the production rule vs change control → A: **Yes** — OTP length remains **six (6)** decimal digits.
- Q: **Legacy customer backfill** ([tasks.md](./tasks.md) T042): when relative to rollout? → A: **No legacy cohort applies** — all customers already use **full national `07xxxxxxxx`** onboarding; **T042 deferred** unless a real backfill need appears.
- Q: Self-serve **forgot PIN** and support runbooks — → A: **Forgot PIN** remains **out of scope for this iteration**; stakeholder will **design and ship** a portal recovery journey in a **future iteration** ([FR-017] updated). Until then recovery stays **support / ops** only.
- Q: MUST the product block **guessable** chosen PIN patterns (e.g. `111111`, ascending runs)? → A: **Yes**. Server MUST reject (**[FR-019]**) a chosen PIN if:

  - all six digits are **identical**, or  
  - the digits form a **strictly consecutive ascending** sequence of length six (`012345` … `456789`), or  
  - **strictly consecutive descending** (`987654` … `543210`).

  Portal UI SHOULD apply the **same checks** client-side before submit for immediate feedback; **trusted enforcement** stays on the API.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in from the main portal entry (Priority: P1)

A customer opens the generic self-service entry URL. They enter their **national mobile number** (format starting with 07…) and their **PIN** field value: on **first** access (before first-time PIN replacement is complete) this is the **one-time PIN (OTP)** they received when registered; **after** first-time PIN replacement is complete, **only** their **chosen six-digit PIN** is accepted—the **OTP MUST NOT** sign them in anymore. The form always shows the single credential label **PIN** (never “national ID” or “username/password”). After successful authentication they land on their personal home path that includes their customer identifier. If the account is still on **first-time** access, they are taken into the **forced PIN change** flow before any other self-service content (see User Story 3).

**Why this priority**: Without reliable sign-in, no other self-service value can be delivered.

**Independent Test**: A customer with an activated account can sign in from the generic entry using phone and the correct value in the PIN field (OTP first time, chosen PIN thereafter), reaches the correct next step (forced PIN change vs home), and sees only their data.

**Acceptance Scenarios**:

1. **Given** a customer who has already completed first-time PIN setup, **When** they enter national phone and their chosen PIN, **Then** they are signed in and taken to their customer home path (or next valid step) without seeing the forced PIN-change flow.
2. **Given** a customer who has already completed first-time PIN setup, **When** they enter national phone and the **old registration OTP** in the PIN field, **Then** sign-in **fails** with a clear, non-technical error (OTP is **not** a parallel valid secret).
3. **Given** incorrect phone or PIN/OTP (as applicable to account state), **When** they submit the form, **Then** they see a clear, non-technical error and remain on the sign-in flow without seeing another customer’s data.
4. **Given** the generic sign-in screen, **When** the customer reads the form, **Then** labels are **Phone number** and **PIN** only (not “username”, “password”, or “national ID”).

---

### User Story 2 - Sign in from a personal link (Priority: P1)

A customer opens a **link that already contains their customer identifier** (for example from SMS, WhatsApp, or email). The screen shows **read-only context**: phone as **partially masked** national format ([FR-001a]), plus first name and last name when known. Because Supabase client sign-in uses synthetic email **`{national07}@maishapoa.customer`** ([plan.md](./plan.md) §Auth — no separate credential broker in v1), the member enters **national phone** and **PIN** (OTP until first-time replacement completes; afterward **chosen six-digit PIN** only — [FR-008]). After sign-in they land in a valid area or forced PIN change ([User Story 3]).

**Why this priority**: Marketing and onboarding rely on personal links; masked context plus familiar fields preserves security and interoperates with Auth.

**Independent Test**: Open a valid personal link, sign in with **phone + credential in PIN field**, and confirm session `sub` matches URL `customerId`.

**Acceptance Scenarios**:

1. **Given** a valid personal link for a customer who already has portal access, **When** the customer opens it, **Then** they see masked phone context (never full national number on-screen), optional name context, **Phone number** input, **PIN** input ([FR-001a], Clarifications Session 2026-04-08).
2. **Given** an unknown UUID (non-enumerating case), **When** someone opens it without being signed in, **Then** the **same chrome shape** applies (masked pattern may be absent or empty fields), generic sign-in is **reachable without query parameters that echo the tampered URL**, and the response/API gives **no signal** distinguishing unknown vs inactive accounts ([FR-011] tamper-adjacent); **automatic hard redirect is not required**.
3. **Given** a signed-in customer whose session does not match the customer in the URL, **When** they load that URL, **Then** the system ends the mismatched session and sends them to generic sign-in **`/self/customer`** **without** a return URL / query that re-opens the tampered path ([FR-011]).

---

### User Story 3 - First-time forced PIN (after OTP) (Priority: P1)

For new portal accounts, **persisted data** records that the member **has not yet replaced** the issued OTP with their own PIN. After they sign in successfully using the **OTP** in the **PIN** field, they **must** set a **new six-digit PIN** (with confirmation, per agreed rules) before using the rest of the portal. The system marks first-time setup as **complete** only through a **trusted server-side** update to persisted data. After that, the customer’s session must reflect the updated state so they are not stuck on the setup screen. When first-time PIN replacement **succeeds**, the member MUST receive a **separate follow-up** notification (e.g. SMS) confirming that their PIN was set and how to access the portal going forward—distinct from the bundled welcome/OTP message. That follow-up MUST include the **personal** portal link **`/self/customer/:customerId`** (same pattern as the welcome message) as the **primary** sign-in entry point in the copy.

**Why this priority**: Ensures members do not keep using a delivery-channel OTP as their long-term secret.

**Independent Test**: New account receives OTP; signs in with phone + OTP in PIN field; cannot use main self-service until new PIN is set and persisted; next sign-in uses phone + new PIN only; **follow-up** notification is sent after PIN setup succeeds.

**Acceptance Scenarios**:

1. **Given** an account that has not completed first-time PIN replacement, **When** the customer signs in successfully with the OTP, **Then** they cannot access main self-service content until the new PIN setup succeeds.
2. **Given** new PIN setup completes successfully, **When** the customer’s client receives confirmation, **Then** persisted state shows first-time complete and the session reflects that without an unnecessary extra full sign-out/sign-in where avoidable.
3. **Given** new PIN validation fails (length, mismatch, **FR-019** weak-pattern rejection, etc.), **When** the customer submits, **Then** errors are clear and persisted state is not left contradicting reality (still first-time until success).
4. **Given** first-time PIN replacement has **completed**, **When** the member attempts to sign in using the **registration OTP** in the PIN field, **Then** sign-in is **rejected** (only the chosen PIN may succeed).
5. **Given** first-time PIN replacement completes successfully, **When** the server commits the new PIN state, **Then** a **follow-up** customer notification (e.g. SMS) is **queued or sent** confirming PIN setup and sign-in guidance, including the **personal** `/self/customer/:customerId` link as the primary URL (no registration OTP in that message).

---

### User Story 4 - Products list and automatic shortcut for a single product (Priority: P2)

From the products list path for their customer, the customer sees all products (policies) they can access. If they have **exactly one** product, the system **automatically takes them** to that product’s detail path. They can still open the full list (for example via navigation).

**Why this priority**: Most members may have one product; skipping an extra tap improves everyday use.

**Independent Test**: Compare customers with zero, one, and multiple products; only the one-product case auto-navigates; list remains reachable.

**Acceptance Scenarios**:

1. **Given** exactly one product, **When** the customer hits the products list entry, **Then** they are taken to that product’s detail path.
2. **Given** zero or more than one product, **When** the customer uses the products list, **Then** they see an appropriate list or empty state without incorrect redirect.

---

### User Story 5 - Product detail with four information areas (Priority: P1)

On a product detail path (customer and product in the URL), the customer sees the **same four areas** staff see on the customer detail journey: **Customer details** (default), **Products**, **Payments**, and **Member cards**, scoped strictly to **their** customer and **their** product. Behaviour should match the existing staff experience where it makes sense for a member (read-focused, no staff-only actions unless separately specified).

**Why this priority**: Delivers the core promise—members see card, policy, and payment information without calling support.

**Independent Test**: Side-by-side parity checks for tab labels and primary content; attempt cross-customer or cross-product URL edits and confirm access is denied and session rules from User Story 2 apply.

**Acceptance Scenarios**:

1. **Given** a valid customer–product combination, **When** the member opens the product detail path, **Then** all four tabs exist and show content consistent with the staff customer-detail experience for that same customer where applicable.
2. **Given** a product that does not belong to the customer in the URL, **When** the route is requested, **Then** mismatched signed-in users are signed out and sent to generic sign-in with no return path; unsigned-in users are also directed to generic sign-in accordingly.

---

### User Story 6 - Payments: single-plan filter usability (Priority: P2)

On the **Payments** area, when only **one** package or plan applies to the filter control, that option is **pre-selected** so the customer (or staff viewing that customer) can run a filter **without an extra selection step**. This applies both to the **new self-service payments view** and the **existing staff customer payments view**.

**Why this priority**: Removes friction for the common single-policy case in two places at once.

**Independent Test**: Customers with one vs multiple plans; confirm dropdown state and that filter actions behave as expected in both staff and self-service contexts.

---

### User Story 7 - Welcome message, OTP, portal link, and support numbers (Priority: P2)

When a new customer is registered, the **same** primary **customer-created** notification (e.g. welcome SMS) MUST deliver, in **one** message where the channel allows: the **one-time PIN (OTP)** for first sign-in, the **personal portal link** (path includes the customer identifier), and **general** and **medical** support phone numbers from **system configuration** (seeded values agreed by the business). If a channel enforces a hard length limit, copy MUST still preserve all three elements or an explicit follow-up rule is defined in planning—**without** reversing the default of a **single** bundled notification.

**Why this priority**: Drives self-service adoption and gives members everything needed for first access without staff.

**Independent Test**: Trigger customer creation; verify the **primary** customer-created notification includes OTP, portal link, and both resolved support numbers in one delivery (per channel).

**Acceptance Scenarios**: See **FR-005a** (canonical bundled welcome). Additionally: when operations updates configured support numbers, subsequent notifications use the updated values (within normal propagation rules).

---

### Edge Cases

- Customer record exists but portal account or OTP issuance fails: operations must be able to detect and retry or reconcile so customers are not permanently without access without manual intervention.
- **Legacy migration**: As of stakeholder sign-off (**Session 2026-04-09**), **no cohort** exists that predates normalized national phone + portal onboarding; **bulk backfill** ([tasks.md](./tasks.md) T042) stays **closed until** such a cohort is identified.
- **OTP misuse**: dedicated **expiry**, **attempt limits**, and **resend** flows are **out of scope** this iteration (Clarifications, Session 2026-04-04).
- After first-time PIN replacement completes, the **registration OTP** MUST **no longer** authenticate the member; only the **chosen PIN** works going forward.
- After first-time PIN replacement completes, the customer’s client must refresh session/state so the forced PIN step does not reappear incorrectly.
- **Follow-up** notification after PIN setup **fails** to send: automated **retry/monitoring** for that failure is **out of scope** this iteration (Clarifications, Session 2026-04-04); operations may use existing messaging observability where available.
- Tampering with **customer** or **product** segments in the address bar must not expose other customers’ data; enforce mismatch rules and generic sign-in redirect **without** preserving the bad URL as a return destination.
- A member **forgets their PIN** or is **locked out** after choosing a PIN: there is **no** self-service recovery in this iteration; they must use **support** or the **agreed operational process** (documented in runbooks).

## Scope boundaries

**Out of scope (this iteration)**

- **Forgot PIN** / **self-service PIN recovery** / automated unlock flows in the portal; handling is via **support** or **agreed operational process** only.
- **OTP expiry**, wrong-attempt **rate limits**, and **OTP resend** self-service flows.
- **Dedicated retry/monitoring** for failed **follow-up** SMS after PIN setup (beyond whatever generic messaging infrastructure already provides).

**In scope**

- First access via **OTP**, forced first-time PIN change, **follow-up confirmation** notification after PIN setup, ongoing sign-in with phone + PIN, and all self-service routes and tabs described in this document.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST offer a dedicated self-service URL space under `/self/customer` with: generic sign-in, optional sign-in when a customer identifier is present in the path, a products list path, and a product detail path that includes both customer and product identifiers.
- **FR-001a**: On the personal-link sign-in screen, the system MUST show the member’s phone number in **partially masked** form only (never the full national number in clear text on that screen). Canonical display pattern: **`07•••••` + last 4 digits** as specified under [Phone masking (customer portal)](./design/maishapoa_heritage/DESIGN.md#phone-masking-customer-portal).
- **FR-002**: The system MUST restrict self-service routes to customers with the **customer** portal role; staff-only roles MUST NOT use this area as their primary experience (exact blocking of mixed-role accounts is out of scope for this iteration).
- **FR-003**: Sign-in MUST use national phone numbers in **07…** form in customer-facing fields and MUST map each customer to exactly one portal identity; phone numbers MUST remain unique per customer as today.
- **FR-004**: The system MUST use a **single shared unique identifier** between the customer’s business record and their portal account for newly provisioned and backfilled portal users, so authorization can bind sessions unambiguously to one customer.
- **FR-005**: Portal accounts MUST be created **after** the customer record exists; if portal creation or OTP issuance fails, the system MUST support retry or reconciliation without duplicating accounts.
- **FR-005a**: At customer registration, the system MUST issue or communicate a **one-time PIN (OTP)** to the member for **first** portal sign-in via the **same** primary **customer-created** notification that includes the personal portal link and both support numbers—**one** bundled message per channel where limits allow.
- **FR-006**: The system MUST persist, per portal user (or equivalent customer-scoped record), whether **first-time PIN replacement** after OTP has been completed; initial state is **not completed**; after successful new PIN setup the state is **completed** and MUST only be changed through trusted server-side processing.
- **FR-007**: After first-time PIN replacement completes, the customer’s active session MUST reflect **completed** state so the forced PIN flow does not stale-show incorrectly.
- **FR-008**: On **first** access (before first-time PIN replacement is complete), the member signs in using **phone** and the **OTP** as the value in the **PIN** field; immediately afterward they MUST set a **new six-digit PIN** with confirmation before other self-service content. After first-time PIN replacement is **complete**, sign-in MUST accept **only** **phone** + **chosen PIN**; the **OTP MUST be rejected** for sign-in and MUST NOT remain a parallel valid secret. The credential field label MUST always read **PIN** (never national ID).
- **FR-009**: The system MUST **not** require or display national ID entry anywhere on the self-service portal for authentication. National ID may remain on the **customer record** for KYC and staff workflows only.
- **FR-010**: The system MUST **not** change the member’s chosen PIN automatically when staff update national ID on the customer record after first-time PIN replacement is complete. **Verification**: The codebase MUST NOT introduce hooks that reset or replace the Supabase password when staff update national ID after PIN setup; **PR reviewer sign-off** confirms no such path exists (or references an explicit follow-up task if one is added).
- **FR-011**: Every self-service screen MUST bind the signed-in identity to the customer in the URL; on mismatch the system MUST **sign the member out**, **clear** mismatched portal session state, **`replace`/navigate** to **`/self/customer`**, and MUST NOT expose a **`returnUrl` / query continuation** that re-applies tampered `:customerId` or `:productId` paths (see **Security & URLs** and **SC-002** above).
- **FR-012**: Product detail MUST validate that the product belongs to the customer; violation follows the same security handling as FR-011.
- **FR-013**: Product detail MUST expose **Customer details**, **Products**, **Payments**, and **Member cards** tabs, aligned with the existing staff customer-detail experience for equivalent data and actions appropriate to members.
- **FR-014**: Payments MUST pre-select the package/plan filter when exactly one selectable plan exists, in both self-service and existing staff customer payments views.
- **FR-015**: The primary welcome / customer-created message for new customers MUST satisfy **FR-005a** (one bundled notification per channel: **OTP**, personal `/self/customer/:customerId` link, **general** and **medical** support numbers from system configuration).
- **FR-016**: System configuration MUST be seeded with **general_support_number** `0746907934` and **medical_support_number** `0113569606` as plain numeric strings (no brace characters in stored values).
- **FR-017**: The system MUST **not** expose in-scope **forgot-PIN** or **self-serve PIN reset** journeys **in this iteration**; recovery from a forgotten PIN or lockout after PIN setup is handled via **support** or **agreed operational process** only until a **future iteration** delivers self-serve recovery (explicitly planned by stakeholders, not part of current scope).
- **FR-019**: When a member sets their **chosen six-digit PIN** (first-time replacement), the system MUST **reject** values that match **easily guessable patterns**: all six digits **identical**; **strictly consecutive ascending** six-digit sequences from **`012345`** through **`456789`**; **strictly consecutive descending** from **`987654`** through **`543210`**. Validation MUST run **server-side** on `POST .../me/pin-complete`; the portal SHOULD mirror the same rules for UX. **Lockout / attempt limits** for sign-in remain out of scope ([Scope boundaries](#scope-boundaries)).
- **FR-018**: After **successful** first-time PIN replacement, the system MUST enqueue or send a **follow-up** customer notification (same primary channel as welcome unless planning specifies otherwise, e.g. SMS) that **confirms** PIN setup and gives **sign-in / portal access** guidance **without** re-sending the registration OTP. The follow-up MUST include the **personal** portal path **`/self/customer/:customerId`** as the **primary** link (same URL pattern as the welcome message), not **only** the generic `/self/customer` entry.

### Key Entities

- **Customer**: Business customer record with unique id, national phone, names, national ID for **non–self-service** purposes (KYC/staff), and products/policies.
- **Portal account**: Sign-in identity tied one-to-one with the customer id; carries role “customer”, chosen PIN after setup, and **persisted first-time PIN replacement** completion state.
- **One-time PIN (OTP)**: Secret issued at registration for **first** sign-in only (until first-time PIN replacement completes); **invalid for sign-in** after the member’s chosen PIN is successfully activated.
- **Product / policy** (in scope of this feature): The sellable/coverage object linked to the customer for list and detail views and payments filtering.
- **System setting**: Named configuration values for support numbers (and any related keys required to resolve message placeholders).

## Canonical portal routes *(FR-001 detail)*

| Path | Purpose | Delivery status |
|------|---------|----------------|
| `/self/customer` | Generic member sign-in | Implemented (portal shell + auth) |
| `/self/customer/:customerId` | Deep-link entry + authenticated member landing (minimal until product tabs ship) | Implemented |
| `/self/customer/:customerId/setup-pin` | First-time PIN replacement | Implemented |
| `/self/customer/:customerId/products` | Products list + single-product shortcut | Planned — [tasks.md](./tasks.md) T036–T037 |
| `/self/customer/:customerId/products/:productId` | Four-tab product detail (member-scoped) | Planned — [tasks.md](./tasks.md) T032–T035 |

**Naming**: **`product`** in URL/path segments denotes the insured **coverage / policy-linked** artefact paired with `customerId` (“product **or** policy” in Key Entities refers to one domain object; URLs use `products` consistently — [Consistency, tabs](#user-story-5---product-detail-with-four-information-areas-priority-p1)).

## Messaging placeholders & notification lifecycle *(traceability)*

**Primary bundled welcome** (route **`customer_created`**, SMS per channel routing): placeholders resolved for copy authoring — **`first_name`**, **`last_name`**, **`email`**, **`otp`** (registration one-time PIN), **`customer_specific_weblogin`** (personal `https://{portal}/self/customer/{customerId}`), **`medical_support_number`**, **`general_support_number`** from `system_settings`.

**Follow-up after PIN setup** (`portal_pin_setup_complete` or equivalent template key): **no** OTP; includes personal link (**`customer_specific_weblogin`** or equivalent) plus guidance copy ([FR-018]).

**Terminology alignment**: **`customer-created` notification**, **primary welcome message**, **bundled welcome** — same lifecycle step ([FR-005a], FR-015); **follow-up** is the separate PIN-confirmation notification ([FR-018], SC-006).

**Multi-channel**: For any future **email** or additional channel on the same routes, the **element list** (OTP, personal link, both support numbers) in **FR-005a** still applies **where the channel can carry them**; copy may be reorganised—**does not imply** splitting into separate unsynchronised deliveries unless explicitly replanned ([User Story 7](#user-story-7---welcome-message-otp-portal-link-and-support-numbers-priority-p2)).

## Phone numbers & OTP / PIN norms *(FR-003, FR-008, research alignment)*

- **National display/input**: Kenyan national **`07xxxxxxxx`** (10 digits) for member-facing inputs; stripping spaces/normalisation applies before synthetic email derivation ([plan.md](./plan.md)).
- **Registration OTP**: **six (6) decimal digits** — confirmed Clarifications Session 2026-04-09; implementation env default `PORTAL_REGISTRATION_OTP_LENGTH` aligns with [research.md](./research.md) R4.
- **Chosen PIN**: **six (6) decimal digits** (Supabase minimum password length constraint, confirmed Clarifications Session 2026-04-09); confirmation required — **guessable-pattern rejection per [FR-019](#functional-requirements)** (server authoritative). **OTP expiry**, **wrong-attempt lockout counters**, and **additional** PIN entropy rules beyond FR-019 remain unspecified unless replanned ([Scope boundaries](#scope-boundaries)).
- **Masked display** (`07•••••` + last 4): normative definition in DESIGN.md §Phone masking ([FR-001a]).

## Persisted portal state wording *(FR-006)*

**“Per portal user”** is satisfied by **`Customer.portalPinSetupCompletedAt`** keyed by **`Customer.id` === `auth.users.id`** ([data-model.md](./data-model.md)) — no second principal identity row.

## Security & URLs *(FR-011, FR-024, SC-002)*

- **UUID in URL**: Accepted **trade-off** for v1 interim portal — predictable personal links and Supabase **`sub`** alignment outweigh hiding identifiers; phishing education and transport security rely on organisational controls ([plan.md](./plan.md) Summary) — document here for stakeholder awareness.
- **Session binding**: Any authenticated customer-portal shell under **`/self/customer/:customerId/**`** MUST deny **URL `customerId` ≠ JWT `sub`** — end session (**sign out**) and **`replace`/navigate** to **`/self/customer`** with **no** `returnUrl`/`next` reconstructing tampered paths ([FR-011]).
- **SC-002 tamper matrix** (requirements-level; verification in QA): signed-in-as-A + URL `:customerId` B; signed-out + URL `:productId` alien to future owner; refreshed mid-flow maintaining session consistency; malformed UUID path segment (non-enumerating treatment). Interpret **“100% in testing”** as **staging / dev exhaustive script or checklist**, **not** a production-wide statistical guarantee.

## Success criteria — measurement scope *(SC-001, SC-003–SC-006)*

- **Environment**: **`In test`** = controlled **dev/staging/manual QA** executions per [tasks.md](./tasks.md) T046 / [`checklists/qa-implementation.md`](./checklists/qa-implementation.md), **unless** automated coverage later references the **same explicit matrix**.
- **SC-001 “one session”**: Happy path assumes **continuous browser session**; mid-flow refresh **does not** redefine success — member may refresh if persistence allows (Supabase session), without replaying onboarding from scratch unnecessarily.

## Staff parity & member actions *(FR-014, FR-013, User Story 5)*

- **FR-014**: Staff behaviour = **existing** agent-registration **`(main)` customer-detail Payments tab**; self-service parity = same component/pattern once routes ship — tracked in tasks **T038–T039** (not inferred only from codebase).
- **Member-appropriate tabs (v1)**: **Read-only / member-safe** parity with staff data views; destructive, partner-only, pricing-admin, or KYC workflows **explicitly excluded** unless a future FR adds them.
- **Planned read payloads (T032–T033)**: success bodies MUST expose at least the **same logical data** as staff views for **customer profile**, **payments rows**, and **member cards** for the scoped `customerId` / `productId`; field-level OpenAPI schemas to be expanded when those endpoints land (intent locks **reviewability** of staff parity now).

## Non-functional stance *(CHK025–CHK028, CHK030)*

- **OTP brute-force / abuse / rate limiting** beyond “out of scope” product flows: **No minimum numeric rate-limit requirement** documented for v1 portal; infra (Supabase, WAF, API gateway) MAY apply independently — future FR may quantify.
- **Accessibility / locale**: **English-only** portal copy unless a later milestone ties to `defaultMessagingLanguage`; WCAG conformance **desired** but **not separately specified** as acceptance gates in this iteration.
- **DESIGN artefacts**: Stitch exports are **implementation reference only** unless this spec explicitly cites DESIGN.md **normatively** ([FR-001a] masking § does). Step labels (e.g. “Step 2 of 2”) are **cosmetic** parity, not separate acceptance IDs.
- **Support numbers**: **FR-016** seeds are **canonical** operational values; promotional mock imagery **may omit or stylise digits** — production behaviour MUST resolve from configuration.

## Edge cases — recovery distinctions *(CHK019)*

- **Portal account / OTP issuance failure** (record exists): **Orchestration** requirement — reconcile/retry provisioning ([FR-005], Edge Cases) — differentiate from **messaging worker / carrier delivery failure** observable in messaging observability dashboards.

## Legacy / backfill *(CHK020)*

- **Stakeholder posture (Session 2026-04-09):** **No current legacy cohort**; **[tasks.md](./tasks.md) T042** (**backfill script**) is **deferred**. If migration is ever needed, the script MUST still obey **portal-first onboarding** (**no national ID on portal**) and OTP issuance rules documented in script header/runbook — reopen T042 then.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A newly registered customer can receive an OTP and portal link, complete first sign-in using phone + OTP in the PIN field, set a new six-digit PIN in one session, and **upon delivery of product-detail routes ([tasks.md](./tasks.md) T032–T035)** reach product detail with all four tabs without staff assistance; **until then**, the phased milestone substitutes **authenticated portal home after PIN completion** verified in [tasks.md](./tasks.md) T046 / [qa checklist](./checklists/qa-implementation.md).
- **SC-002**: In testing, **100%** of attempted cross-customer or cross-product URL tampering cases result in **no** display of another customer’s data and end in generic sign-in without a return URL, for both signed-in and unsigned-in starting states.
- **SC-003**: For a sample of customers with **exactly one** applicable plan, **100%** see the plan pre-selected on Payments in both self-service and staff views when exercised in test.
- **SC-004**: For customers with exactly one product, **100%** land on product detail from the products entry point in test, while **100%** of exercised users can still open the full products list via explicit navigation.
- **SC-005**: In test, the **single** primary customer-created notification includes the **OTP**, the personal portal link, and both support numbers matching configuration in one delivery (per channel).
- **SC-006**: In test, **100%** of successful first-time PIN completions result in a **follow-up** confirmation notification being triggered (per channel rules), with copy that does **not** treat the registration OTP as the ongoing secret and that includes the **personal** `/self/customer/:customerId` link as the primary portal URL.

## Assumptions

- Heritage DESIGN.md [**Phone masking**](./design/maishapoa_heritage/DESIGN.md#phone-masking-customer-portal) requirements are **normative** alongside [FR-001a](#functional-requirements); other palette / typography guidance in DESIGN.md is **recommended** consistency, not standalone FR IDs.
- The organization’s identity and messaging stack supports OTP issuance, delivery, **follow-up** notifications after PIN setup, and PIN policy (including six-digit chosen PIN) within agreed security review. Dedicated OTP **expiry** and **resend** product rules are not required in this iteration (see scope).
- Customer phone uniqueness and one customer per portal account remain valid business rules.
- Staff customer-detail behaviour is the reference for tab content; staff-only or partner-only actions are excluded unless explicitly added later.
- This portal is an **interim** channel; long-term customer experiences may move to dedicated apps and public APIs without changing the core security rules above.
