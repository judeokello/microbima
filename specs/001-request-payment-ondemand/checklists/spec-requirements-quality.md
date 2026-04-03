# Requirements Quality Checklist: On-Demand Payment Request

**Purpose**: Validate that written requirements (spec/plan) are complete, clear, consistent, and measurable before implementation review — "unit tests for English," not implementation verification.

**Created**: 2026-04-03

**Feature**: [spec.md](../spec.md) (see also [plan.md](../plan.md), [research.md](../research.md))

**Defaults applied** (no `$ARGUMENTS`): Standard depth; intended audience **PR / spec reviewers**; focus clusters **(1) payment modal & eligibility**, **(2) parity with onboarding & data visibility**.

---

## Requirement Completeness

- [ ] CHK001 Are all preconditions for showing **Request payment** documented (package filter selected, non-empty package-plan list, prepaid, resolvable policy) so nothing is implied only by UI labels? [Completeness, Spec FR-001, FR-016, FR-021, User Story 1]
- [ ] CHK002 Are requirements stated for **both** branches of **mutually exclusive** amount modes (installments vs custom), including when each is disabled, without leaving a gap where neither mode applies? [Completeness, Spec FR-003–FR-006, User Story 2]
- [ ] CHK003 Are **browser notification** requirements complete for permission denied, dismissed, or unsupported environments relative to FR-015 “persistent until dismissal”? [Completeness, Gap, Spec FR-012–FR-015]
- [ ] CHK004 Does the spec require **admin-contact** messaging for every “no policy / unusable package filter” variant it cares about, or are some failure modes only covered in plan/research? [Completeness, Spec FR-021, User Story 5 vs plan.md]
- [ ] CHK005 Are **observability** requirements (Sentry) specified with enough precision that “duplicate session” throttling is a documented product choice rather than only an implementation note? [Completeness, Clarity, Spec FR-022]

## Requirement Clarity

- [ ] CHK006 Is **installment amount** unambiguously tied to **policy premium / installment size** for staff readers (single canonical field name in requirements)? [Clarity, Spec FR-005, Key Entities]
- [ ] CHK007 Is **“filtered to a specific package”** defined in the same terms as the UI **Package – Plan** control so FR-001 cannot be read two ways? [Clarity, Spec FR-001, User Story 1]
- [ ] CHK008 Are **FR-019** labels **mapped** to observable meanings (e.g. what distinguishes **pending** vs **processing**) or is deferral to onboarding-only fully explicit so readers know where truth lives? [Clarity, Spec FR-019, FR-023]
- [ ] CHK009 Is **postpaid** determination attributed clearly to **scheme** vs **policy** so FR-018 and FR-020 cannot contradict at boundaries? [Clarity, Spec FR-018, FR-020]
- [ ] CHK010 For **custom amount**, are **bounds** stated in product terms (range in KES) or only by reference to external systems — and is that intentional? [Clarity, Gap vs plan/research InitiateStkPush limits]

## Requirement Consistency

- [ ] CHK011 Are **payment table / row visibility** rules consistent between **FR-011**, **SC-003**, and **Clarifications Option C** without implying new grid rules elsewhere? [Consistency, Spec FR-011, SC-003, Clarifications]
- [ ] CHK012 Do **User Story 3** acceptance scenarios align with **FR-010** and **FR-023** on the same channel (WebSocket pattern “like onboarding”) without introducing a second status model? [Consistency, Spec User Story 3, FR-010, FR-023]
- [ ] CHK013 Does **spec** placement of **out-of-scope recovery** (FR-021) conflict with any residual language in **plan** or **research** that still suggests in-app recovery? [Consistency, Spec vs plan.md / research.md R2]

## Acceptance Criteria Quality (Measurable)

- [ ] CHK014 Can **SC-002**’s “within 5 seconds of each backend status event” be assessed without defining what counts as a “backend status event” in requirements? [Measurability, Gap, Spec SC-002]
- [ ] CHK015 Are **SC-005** pilot-survey criteria supplemented or clearly owned by a non-spec process so the metric is actionable? [Measurability, Assumption, Spec SC-005]
- [ ] CHK016 Is **SC-008**’s exception “unless deduplication policy applies” anchored to a requirement that defines when dedupe is allowed? [Measurability, Clarity, Spec SC-008, FR-022]

## Scenario Coverage (Primary / Alternate)

- [ ] CHK017 Are **primary** flow requirements ordered and independently testable as claimed in user stories (P1 vs P2) without hidden cross-story dependencies? [Coverage, Spec User Stories 1–5]
- [ ] CHK018 Are **alternate** paths documented when staff **switch** package filter while a payment is still in flight, or is that only an edge-case bullet without acceptance linkage? [Coverage, Spec Edge Cases]
- [ ] CHK019 Are requirements explicit for **installment mode unavailable** but **dialog still open** (empty premium path) regarding what the user may do next beyond Sentry? [Coverage, Spec FR-022, User Story 2]

## Edge Case & Exception Coverage

- [ ] CHK020 Are **duplicate websocket / duplicate row** requirements stated with enough precision to avoid double-counting without leaning only on implementation? [Edge case, Spec Edge Cases vs FR-011]
- [ ] CHK021 Is **“premium invalid but not empty”** (non-numeric anomaly) distinguished from **empty premium** in requirements outcomes? [Edge case, Clarity, Spec Edge Cases, FR-022]
- [ ] CHK022 Are **terminal failure** visibility requirements (FR-015) reconciled with browser notification platform limits in a single coherent requirement set? [Edge case, Consistency, Spec FR-015, Assumptions]

## Non-Functional, Dependencies & Assumptions

- [ ] CHK023 Are **authorization / persona** boundaries (“operations user”) aligned with assumptions about who may access customer payments, or is stronger RBAC language needed in the spec? [NFR completeness, Spec Assumptions, User Story 1]
- [ ] CHK024 Is **dependency** on “existing registration phone validation” documented with enough identity (which product surface) to avoid drift across apps? [Dependency, Spec FR-008, Assumptions]
- [ ] CHK025 Are **timezone** expectations implicit (UTC) only in plan/constitution, or should the spec state date handling for payment dates visible in copy? [Dependency, Gap — constitution vs Spec]

## Ambiguities, Conflicts & Traceability

- [ ] CHK026 Is there a **single traceability ID scheme** (FR-xxx / SC-xxx) required for future change control, or is ad-hoc labeling acceptable for this release? [Traceability, Spec structure]
- [ ] CHK027 Does **research.md** introduce decisions (e.g. endpoint path, CORS env) that are **not** reflected back into **spec.md**, creating a split source of truth for reviewers? [Conflict risk, Spec vs research.md]
- [ ] CHK028 Are **Clarifications** session bullets dated and scoped so later sessions do not override Option C without explicit supersession language? [Traceability, Spec Clarifications]

---

## Notes

- Check off items when the **written requirements** satisfy the question; note gaps in PR or spec revisions.
- This file is **additive** to [requirements.md](./requirements.md) (earlier spec completeness checklist).
- New file per `/speckit.checklist` run: **`spec-requirements-quality.md`**.
