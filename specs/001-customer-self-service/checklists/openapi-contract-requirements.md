# OpenAPI & customer-portal contract requirements quality

**Purpose**: Treat `contracts/openapi.yaml` and related plan/spec language as **normative HTTP requirements** for the customer portal—validate completeness, clarity, consistency, and measurability of what is *written*, not runtime behaviour.  
**Created**: 2026-04-05 · **Closed**: 2026-04-08 (see [openapi.yaml](../contracts/openapi.yaml) `info` + paths)  
**Feature**: [spec.md](../spec.md) · [plan.md](../plan.md) · [contracts/openapi.yaml](../contracts/openapi.yaml) · [tasks.md](../tasks.md)

---

## Requirement completeness

- [x] CHK001 Are **all** customer-portal HTTP surfaces implied by [Spec §FR-001] and [Spec §FR-011–FR-013] either present in `openapi.yaml` or explicitly deferred with a requirement reference and scope-boundary note? [Completeness, Gap]
- [x] CHK002 Are **standardized error envelope** requirements (`status`, correlation id, field `details` where applicable) referenced for **every** customer-portal path that can return 4xx/5xx, or is reliance on a global API error policy only implied outside the contract? [Completeness, Gap, Plan §Constitution / error handling]
- [x] CHK003 Is the **public URL prefix** (e.g. `/api`) that clients must prepend documented as part of the contract or cross-linked as a **MUST** from plan/env, so `openapi.yaml` paths are not ambiguous? [Completeness, Clarity, Gap]
- [x] CHK004 Are **authentication expectations** (bearer vs none) for each path class stated in spec, plan, or OpenAPI descriptions in a way that matches [Spec §FR-001a], [User Story 2] (e.g. `me/context` without session)? [Completeness, contracts paths]

## Requirement clarity

- [x] CHK005 For `GET .../me/context`, are requirements **unambiguous** that **HTTP 200 with a uniform schema** is mandatory for unknown `customerId` (no enumeration), with field semantics matching [Spec §FR-001a] and the mask pattern in DESIGN.md? [Clarity, contracts §customerPortalLoginContext]
- [x] CHK006 For `POST .../pin-complete`, does the contract or spec clearly tie **422** outcomes to [Spec §FR-006] and [Spec §FR-008] (validation, already completed, mismatch) using the same standardized error vocabulary as other internal APIs? [Clarity, Consistency]
- [x] CHK007 Are **path `customerId`** and **JWT subject** binding rules documented so “authorized subject for nested resources” is objectively decidable for reviewers? [Clarity, Spec §FR-004, FR-011]

## Requirement consistency

- [x] CHK008 Are **relative path strings** and resource naming in `openapi.yaml` explicitly required to **match** deployed Nest controllers (or list allowed exceptions), avoiding parallel informal naming in plan vs contract? [Consistency, Plan §API strategy]
- [x] CHK009 Does **terminology** for sellable/coverage entities in proposed read paths align with [Spec §Key Entities] and [User Story 4–5] (product vs policy) so URLs and DTO names cannot fork by interpretation? [Consistency, Ambiguity]
- [x] CHK010 Are **401**, **403**, and **404** (or equivalent) semantics for customer-scoped reads **consistent** between [Spec §FR-011–FR-012] and the contract’s documented responses, including tamper vs not-found? [Consistency, Gap]

## Acceptance criteria quality & measurability

- [x] CHK011 Can [Spec §SC-002] tampering outcomes be **mapped** from written requirements to expected **HTTP-level** outcomes for customer-portal routes without inventing rules at review time? [Measurability, Spec §SC-002 — see spec Security & URLs]
- [x] CHK012 Are **success payload intents** for planned customer reads (details, payments, member cards) described at least at **field-role** level so “staff parity” in [Spec §FR-013] is reviewable, not purely narrative? [Measurability, Gap]

## Scenario coverage (requirements written)

- [x] CHK013 Are **unsigned-in** and **signed-in wrong-subject** scenarios for each route class documented in spec or OpenAPI notes—not only in narrative user stories? [Coverage, Spec §User Story 2, FR-011]
- [x] CHK014 Are **legacy / backfill** interactions with new endpoints addressed in requirements or explicitly scoped to a follow-up task ([Spec §Edge Cases], [tasks.md] backfill), so contract version vs implementation gap is clear? [Coverage, Gap]

## Non-functional & dependencies

- [x] CHK015 Are **abuse / rate expectations** for unauthenticated `me/context` captured as a requirement (including “none in v1”) rather than left entirely implicit? [Non-functional, Gap, Spec scope / Edge OTP misuse]
- [x] CHK016 Is **OpenAPI `info.version`** tied to a documented change rule (when the contract bumps relative to feature milestones)? [Traceability, Dependency, Gap]

## Ambiguities & conflicts

- [x] CHK017 Does the contract’s **draft / planned** preamble conflict with any **MUST** language in `spec.md` for the same behaviours—and is resolution recorded? [Conflict, contracts §info.description]
- [x] CHK018 If `openapi.yaml` contains paths **not yet implemented**, are they flagged in [tasks.md] (e.g. read endpoints) so readers do not assume shipping parity? [Ambiguity, tasks T032–T033]

---

## Notes

- Closed after `openapi.yaml` v0.2.0: global `/api` narrative, implemented vs planned tags, Bearer exempt for `me/context`, normative MUST alignment with Nest.
- **v0.2.1 (2026-04-09):** `pin-complete` documents **FR-019** rejection patterns beside `^[0-9]{4}$` pattern (semantic rules in description + 422 wording).
