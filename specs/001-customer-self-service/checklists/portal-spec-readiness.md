# Customer Portal Spec Readiness Checklist

**Purpose**: Validate that *written requirements* for the customer self-service portal are complete, clear, consistent, and measurable before implementation—**not** to verify product behaviour.  
**Created**: 2026-04-06 · **Closed**: 2026-04-08 (see [spec.md](../spec.md) supplementary sections)  
**Feature**: [spec.md](../spec.md) · [plan.md](../plan.md) · [research.md](../research.md)

---

## Requirement completeness

- [x] CHK001 Are all routes under `/self/customer` enumerated with the same path segments as in FR-001 (generic login, `:customerId`, products list, product detail)? [Completeness, Spec §FR-001]
- [x] CHK002 Are requirements documented for **every** notification in the onboarding lifecycle (bundled welcome vs PIN-setup follow-up), including mandatory contents per channel? [Completeness, Spec §FR-005a, FR-015, FR-018]
- [x] CHK003 Are placeholder names for messaging (`otp`, link, support numbers) specified or cross-referenced so templates can be authored without guessing? [Gap / Traceability, Spec §User Story 7, Plan §Messaging]
- [x] CHK004 Does the spec require explicit **staff-facing** behaviour for FR-014 everywhere “existing staff customer payments view” is referenced, or is reliance on an implicit codebase reference sufficient? [Completeness / Ambiguity, Spec §FR-014]
- [x] CHK005 Are “member-appropriate” actions on self-service tabs defined beyond “read-focused,” or is intentional vagueness acceptable for v1? [Gap, Spec §User Story 5]

## Requirement clarity

- [x] CHK006 Is **partially masked** phone format defined with objective rules (e.g. visible digit count, masking character) or only delegated to UX/plan? [Clarity, Spec §Clarifications 2026-04-04, FR-001a]
- [x] CHK007 Is **national phone** canonicalisation (leading `0`, no spaces) specified for both display and synthetic-login mapping, or left only to plan/research? [Clarity, Spec §FR-003, Plan §Auth]
- [x] CHK008 Are **six-digit PIN** rules defined beyond length (e.g. prohibited patterns, lockout after failures), or explicitly deferred with a boundary? [Clarity / Gap, Spec §User Story 3, Edge §OTP misuse] *(Updated 2026-04-09: PIN changed from 4 to 6 digits — Supabase minimum password length constraint)*
- [x] CHK009 Is OTP **length and character set** stated in stakeholder-facing requirements, or only in planning artifacts? [Gap, research.md §R4 vs Spec]

## Consistency

- [x] CHK010 Do **Clarifications Session 2026-04-06** (single bundled welcome) and **FR-015** use consistent terminology for the same message (“customer-created”, “welcome”, “primary”)? [Consistency]
- [x] CHK011 Are **follow-up** link rules (personal `/self/customer/:customerId` only as sole link) aligned between **FR-018**, **Clarifications 2026-04-07**, and **SC-006** without contradiction? [Consistency, Spec §FR-018, SC-006]
- [x] CHK012 Does the **plan**’s data-model choice (e.g. `portalPinSetupCompletedAt`) align with spec language “persisted per portal user” without implying a second identity store? [Consistency, Spec §FR-006, data-model.md]

## Acceptance criteria quality

- [x] CHK013 Can **SC-002**’s “100% of tampering cases” be applied without a defined test matrix of tamper types (customerId swap, productId swap, session present vs absent)? [Measurability, Spec §SC-002]
- [x] CHK014 Are **SC-003**–**SC-006** scoped to a defined **environment** (e.g. staging-only, sample size) so “100%” is not misread as production proof? [Clarity, Spec §SC-003–SC-006]
- [x] CHK015 Is **SC-001**’s “one session” defined (same browser session vs missing edge: refresh mid-flow)? [Ambiguity, Spec §SC-001]

## Scenario coverage (requirements written, not tested)

- [x] CHK016 Are **primary** flows explicitly covered: generic login, deep-link login, OTP-as-PIN field, forced PIN, return visit with chosen PIN? [Coverage, Spec §User Stories 1–3]
- [x] CHK017 Are **alternate** channels for welcome (SMS vs email) requirements stated if multi-channel is in scope, or is “per channel” wording sufficient? [Coverage, Spec §FR-005a]
- [x] CHK018 Are **exception** requirements for invalid deep-link `customerId` consistent with “no enumeration” and generic redirect? [Coverage, Spec §User Story 2]
- [x] CHK019 Are **recovery** requirements for portal-account or OTP-issuance failure distinguished from messaging delivery failure? [Coverage, Spec §Edge Cases lines 139–144]

## Edge case & boundary coverage

- [x] CHK020 Is **legacy customer** backfill described at requirement level (who receives OTP, how first-time state is set) or only as a “MUST define” placeholder? [Gap, Spec §Edge Cases]
- [x] CHK021 Are **forgot PIN** and **lockout** explicitly excluded from product requirements while **support process** is referenced as the sole path—without conflicting FRs? [Consistency / Scope, Spec §Scope boundaries, FR-017]
- [x] CHK022 Does the spec tie **“no return URL”** to measurable acceptance language or only to narrative FR-011? [Traceability, Spec §FR-011, User Story 2]

## Security & privacy (requirements quality)

- [x] CHK023 Are **session binding** rules (URL `customerId` vs authenticated identity) free of ambiguous “where required” phrasing for **logout** vs **redirect-only**? [Clarity, Spec §FR-011]
- [x] CHK024 Is exposure of **customer UUID** in URLs acknowledged as a requirement trade-off vs privacy, or left implicit? [Assumption / Gap, Plan §Summary]
- [x] CHK025 Are **rate limiting / abuse** requirements for OTP and sign-in limited to “planning MUST define” without a minimum bar (e.g. existence of a policy document)? [Gap, Spec §Edge OTP misuse]

## Non-functional & dependencies

- [x] CHK026 Are **accessibility** requirements for PIN inputs, steps, and errors specified for the portal, or intentionally out of scope for this spec? [Gap, Design §DESIGN.md vs Spec]
- [x] CHK027 Are **localisation** requirements (English-only vs `defaultMessagingLanguage`) stated for customer-visible portal copy? [Gap, Spec §Assumptions]
- [x] CHK028 Does the spec document **dependency** on design system deliverables (`design/maishapoa_heritage/DESIGN.md`) as normative for visual requirements or only as implementation reference? [Traceability, Plan §UI]

## Design vs specification alignment

- [x] CHK029 Are **Heritage** screen artefacts (e.g. “Step 2 of 2”, support footer copy, security tip) required by the *spec* or only illustrated in design files—avoiding silent scope creep? [Consistency, Design folders vs Spec §User Story 3]
- [x] CHK030 Are support numbers in design mockups **required** to match FR-016 seeded values or may marketing copy diverge? [Consistency, Spec §FR-016 vs Design]

## Ambiguities & conflicts to resolve before build

- [x] CHK031 Is the term **“product” vs “policy”** used consistently in requirement IDs and acceptance scenarios so tab and URL semantics do not fork? [Consistency, Spec §Key Entities, User Story 4–5]
- [x] CHK032 If **research** proposes OTP length 6 and chosen PIN length 4, are both reflected or reconciled in the **spec** to avoid single-word “OTP” ambiguity? [Conflict risk, research.md §R4 vs Spec §FR-008]

---

## Notes

- Closed after `spec.md` update (2026-04-08): canonical routes table, messaging placeholders, OTP/PIN norms, SC matrix & test scope, UUID trade-off, FR-011 clarity, deep-link **phone + PIN** (Clarifications Session 2026-04-08).
- **Stakeholder confirmations (2026-04-09)** recorded in Clarifications Session 2026-04-09: **6-digit OTP** production OK; **no legacy cohort** (`T042` deferred); **portal forgot-PIN planned** future iteration (**FR-017**); **guessable PIN patterns blocked** (**FR-019** + API/UI enforcement); **chosen PIN updated to 6 digits** (Supabase minimum password length — applies to both OTP and chosen PIN).

## Stakeholder / ops — resolved *(was optional follow-ups)*

- ~~6-digit registration OTP~~ → **Confirmed** stays **six** decimals.
- ~~T042 backfill ordering~~ → **Not needed** absent legacy cohort; **deferred** pending real need.
- ~~Support-only forgot PIN / runbooks~~ → **Forgot PIN** remains **support-only for this iteration**; **self-serve recovery** slated for **later feature** — runbooks SHOULD still cite **support path** until that ships.
