# Stakeholder Requirements Quality Checklist: Customer Premium Statement PDF

**Purpose**: Unit tests for **requirements writing** — validate clarity, completeness, and consistency of the feature spec before implementation sign-off (not QA of running code).

**Created**: 2026-04-03

**Feature**: [spec.md](../spec.md) · Plan: [plan.md](../plan.md)

**Focus areas selected**: Financial/reporting semantics, access control, PDF deliverable boundaries, edge-case documentation.

**Depth**: Standard (author self-check + PR reviewer of spec/plan alignment).

**Actor / timing**: Before locking `/speckit.tasks` or at PR that changes `spec.md` / acceptance criteria.

---

## Requirement Completeness

- [ ] CHK001 Are **all** header fields listed in [Spec § User Story 1, scenario 6] explicitly tied to a data source or rule in **FR-004–FR-006**, **FR-009**, or **Clarifications** (no orphan label)? [Completeness, Spec §US1.6]
- [ ] CHK002 Is **“confirmed received”** mapped to lifecycle states in requirements such that implementers can trace it without guessing platform enum names? [Completeness, Clarifications Q2, Assumptions]
- [ ] CHK003 Are **administrator** package create/update requirements (**FR-011**, **User Story 4**) scoped to a named surface (e.g. which app or role) or is that intentionally left to planning only? [Gap, Spec §FR-011]
- [ ] CHK004 Are **out-of-scope** outcomes documented (e.g. emailing the PDF, member self-service, regulatory filing) to prevent scope creep in review? [Gap]
- [ ] CHK005 Does the spec require **both** UI treatment and **server-side** denial for unauthorized access (**FR-013**, **US1.7**), or only one layer — and is that ambiguity resolved? [Completeness, Spec §FR-013]

---

## Requirement Clarity

- [ ] CHK006 Is **“approved visual template”** (**FR-002**) anchored to named artifacts (sample PDFs, logo) so “consistent with samples” is objectively checkable? [Clarity, Spec §FR-002, Assumptions]
- [ ] CHK007 Is **“same currency and formatting rules”** (**FR-014**) defined precisely enough to resolve disputes when Payments tab formatting changes in the future? [Ambiguity, Spec §FR-014]
- [ ] CHK008 Is **floor** rounding for premium-due periods (**FR-006**) sufficient alone, or must the spec define how **inclusive day count** is computed across UTC/midnight boundaries? [Clarity, Spec §FR-006] — *detail may live in technical companion; flag if spec must cite it.*
- [ ] CHK009 Are **distinct user-visible messages** specified for each **FR-008** failure mode, or only generic “contact support”? [Clarity, Spec §FR-008, User Story 2]
- [ ] CHK010 Is **“product and plan label”** in the filename (**FR-010**) defined when product name and plan name conflict with filesystem limits (length, unicode)? [Clarity, Spec §FR-010]

---

## Requirement Consistency

- [ ] CHK011 Do **FR-005** (all confirmed payments, any date) and **FR-006** (premium-due math may use different inclusion) remain free of contradictory language after clarifications? [Consistency, Spec §FR-005–FR-006, Clarifications Q3]
- [ ] CHK012 Are **filtered total** (**FR-004**) and **table rows** (**FR-003**, **SC-001**) described with identical filters and status rules so success criteria cannot contradict functional requirements? [Consistency, Spec §FR-003–FR-004, SC-001]
- [ ] CHK013 Does **User Story 3** align with **FR-006** on **as-of** date vs **from/to** filter (no mixed messaging)? [Consistency, Spec §US3, FR-006]
- [ ] CHK014 Is **package commercial name** (**FR-009**) consistent with **filename** “product and plan label” (**FR-010**) where both appear? [Consistency, Spec §FR-009–FR-010]

---

## Acceptance Criteria Quality

- [ ] CHK015 Can **SC-001** be verified without implementation detail (row count N vs sum equality) given **pagination** and **status** rules in **FR-003**? [Measurability, Spec §SC-001]
- [ ] CHK016 Is **SC-002** (“95%”, “10 seconds”, “normal operating conditions”) defined so a reviewer can tell what counts as failure vs acceptable variance? [Measurability, Spec §SC-002]
- [ ] CHK017 Does **SC-003** reference the same invalid-data set as **FR-008** (including **product duration** missing)? [Traceability, Spec §SC-003, FR-008]
- [ ] CHK018 Is **SC-004**’s “three steps” unambiguous (e.g. does changing policy reset “data is loaded”)? [Clarity, Spec §SC-004]

---

## Scenario Coverage (requirements documented)

- [ ] CHK019 Are **primary**, **alternate** (no confirmed rows), and **exception** (postpaid, no access) flows all covered by at least one **User Story** acceptance scenario? [Coverage, Spec §US1]
- [ ] CHK020 Are **recovery** or **retry** requirements after a failed generation (transient error) specified, or explicitly excluded? [Gap, Exception flow]
- [ ] CHK021 Are requirements for **concurrent** or **double** generation attempts limited to the edge-case bullet — and is that bullet measurable enough for acceptance? [Clarity, Spec §Edge Cases, “multiple times quickly”]

---

## Edge Case Coverage (in the spec text)

- [ ] CHK022 Is **“very large number of payments”** (**Edge Cases**) tied to a success criterion or explicitly deferred to planning only? [Measurability vs Gap, Spec §Edge Cases, SC-002]
- [ ] CHK023 Are **unsafe filename characters** requirements aligned between **Edge Cases** and **FR-010** (sanitization rules)? [Consistency, Spec §Edge Cases, FR-010]
- [ ] CHK024 Is behavior defined when **all-time captured** and **filtered total** diverge greatly (possible under **FR-005** vs **FR-004**) so readers understand the business intent? [Clarity, Spec §FR-004–FR-005]

---

## Non-Functional Requirements (as documented)

- [ ] CHK025 Are **performance** expectations limited to **SC-002**, or should requirements mention observability (e.g. logging slow generations) for operations? [Gap, NFR, Spec §SC-002]
- [ ] CHK026 Are **privacy** or **data-minimization** expectations for the PDF (fields shown, retention) stated or acknowledged as out of scope? [Gap, NFR]
- [ ] CHK027 Are **PDF accessibility** (tags, structure) requirements present or explicitly deferred? [Gap, NFR]

---

## Dependencies & Assumptions

- [ ] CHK028 Is the dependency on **“technical planning companion”** for premium-due **paid** (**Assumptions**, **FR-006**) documented with a stable path or owner so the spec does not drift? [Dependency, Spec §Assumptions]
- [ ] CHK029 Are **Assumptions** about **logo** and **samples** validated (still current, licensed for distribution)? [Assumption risk, Spec §Assumptions]

---

## Ambiguities & Conflicts to Resolve Before Freeze

- [ ] CHK030 Is there a single canonical definition of **“operations user”** vs **administrator** across **User Story 1** and **User Story 4**, or is role overlap intentionally vague? [Ambiguity, Spec §US1, US4]
- [ ] CHK031 Does **plan.md** introduce technical choices (e.g. PDF library) that **contradict** stakeholder-neutral language in **FR-002**, and are both layers labeled (spec vs plan) for reviewers? [Conflict check, plan.md vs Spec §FR-002]

---

## Notes

- Check items off as the **spec/plan** are updated: `[x]`
- This checklist does **not** replace integration tests; it judges whether **requirements** are ready to implement without rework.
