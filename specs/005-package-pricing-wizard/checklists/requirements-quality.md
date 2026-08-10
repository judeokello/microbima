# Requirements Quality Checklist: Package Pricing (Broad Pass)

**Purpose**: Broad validation of FR/SC clarity, consistency, coverage, and measurability across the feature (author gate before tasks)  
**Created**: 2026-08-10  
**Updated**: 2026-08-10 (post-remediation pass)  
**Feature**: [spec.md](../spec.md) · [plan.md](../plan.md) · [tasks.md](../tasks.md)  
**Depth**: Standard · **Audience**: Author  
**Focus**: H — Requirements quality (complements `requirements.md` from specify)

## Requirement Completeness

- [x] CHK001 Are all P1 user stories (create/activate, drop-in registration, migration) backed by explicit FRs? [Completeness, User Stories 1–2, 6]
- [x] CHK002 Are P2 lifecycle and grid UX stories covered by FRs without orphan acceptance scenarios? [Completeness, User Stories 3–4]
- [x] CHK003 Is step 3 utilization placeholder explicitly in scope with empty content? [Completeness, Spec §FR-022, Out of Scope]
- [x] CHK004 Are out-of-scope items listed and non-contradictory with FRs (no extrapolate, no disk writes, no rate revision table)? [Completeness, Out of Scope]
- [x] CHK004a Are `setup_admin` + root-only grant FRs present? [Completeness, Spec §FR-024, §FR-024a]

## Requirement Clarity

- [x] CHK005 Are FR identifiers stable and referenced consistently from clarifications? [Clarity, Spec Clarifications]
- [x] CHK006 Is “drop-in replacement” defined in Assumptions so it cannot be read as a full UI redesign? [Clarity, Spec Assumptions]
- [x] CHK007 Are cadence constants for soft loss / suggest-fill stated once and reused? [Clarity, Spec §FR-017, §FR-018, Assumptions]

## Requirement Consistency

- [x] CHK008 Do Clarifications (deactivate on persist, annual always required, Member only only, suggest-fill MVP, Go lookup) match the FR text? [Consistency, Clarifications vs FR-012/014/008/018/021]
- [x] CHK009 Do Success Criteria avoid contradicting Assumptions (e.g. SC-006 vs deactivate-on-persist)? [Consistency, Spec §SC-006] — **resolved**
- [x] CHK010 Is lookup-only consistent across installment and annual display requirements? [Consistency, Spec §FR-003, §FR-012a]

## Scenario & Edge Coverage

- [x] CHK011 Are primary, alternate (incomplete edit), exception (overflow, undersized category), and recovery (explicit reactivate) requirement classes present? [Coverage]
- [x] CHK012 Are non-functional needs that matter (no redeploy for rates; soft loss latency SC-007) present or deferred intentionally? [Coverage, Spec §SC-002, §SC-007]
- [x] CHK013 Are Edge Cases reconciled with FRs (zero amounts, duplicate N, concurrent edits, in-flight FR-016)? [Coverage, Spec Edge Cases]

## Acceptance Criteria Quality

- [x] CHK014 Are SC metrics technology-agnostic and user/business observable? [Measurability, Spec Success Criteria]
- [x] CHK015 Can each FR be mapped to at least one acceptance scenario or SC? [Traceability]
- [x] CHK016 Are vague adjectives (“familiar”, “clear warning”) anchored by FR/SC detail where critical? [Measurability]
- [x] CHK015a Is FR-015 covered by an explicit Jest task (no auto-activate)? [Traceability, tasks T018b]

## Ambiguities & Conflicts

- [x] CHK017 Remaining Ambiguity: new-value highlight visual definition? [Ambiguity, Spec §FR-011] — **resolved**
- [x] CHK018 Remaining Ambiguity: household-unknown undersize check? [Ambiguity, Spec §FR-019a] — **resolved** (skip)
- [x] CHK019 Remaining Ambiguity: Go UAT sign-off artifact? [Ambiguity, Spec §SC-008] — **resolved** (informal setup_admin)
- [x] CHK020 Conflict check: SC-006 “before leaves page” vs Clarification deactivate-on-persist — resolved in wording? [Conflict] — **resolved**

## Dependencies & Assumptions

- [x] CHK021 Are Dependencies limited and accurate (package admin, payment flows, authz, intake)? [Dependency, Spec Dependencies]
- [x] CHK022 Are Assumptions marked as such and not silently elevated to FRs where still optional? [Assumption]

## Notes

- Use alongside domain checklists (`ux`, `api`, `lifecycle`, `security`, `ops`, `data-model`, `family`).
- Existing `requirements.md` remains the specify-time gate; this file is the broader author pass.
- Requirements-quality only; not implementation verification.
- **Author gate**: remediations synced across spec, plan, research, data-model, OpenAPI, quickstart, tasks, intake — ready for `/speckit.implement`.
