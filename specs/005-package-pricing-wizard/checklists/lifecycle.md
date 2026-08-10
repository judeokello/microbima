# Lifecycle Requirements Quality Checklist: Package Pricing Activation

**Purpose**: Validate completeness, clarity, and consistency of package active/inactive and pricing-completeness lifecycle requirements  
**Created**: 2026-08-10  
**Updated**: 2026-08-10 (post-remediation pass)  
**Feature**: [spec.md](../spec.md) · [plan.md](../plan.md) · [data-model.md](../data-model.md)  
**Depth**: Standard · **Audience**: Author  
**Focus**: C — Lifecycle

## Requirement Completeness

- [x] CHK001 Are all transitions documented: inactive→active (explicit, complete only), active→inactive (incomplete persist), complete-but-inactive until explicit activate? [Completeness, Spec §FR-013–015, Data Model state]
- [x] CHK002 Are incomplete-making persists enumerated (add plan, add grouping, enable frequency)? [Completeness, Spec §FR-014, Clarifications]
- [x] CHK003 Is “unsaved UI draft does not deactivate” distinguished from persisted incomplete data? [Completeness, Spec §FR-014, Edge Cases]
- [x] CHK004 Is inactive package exclusion from registration selection required? [Completeness, Spec §FR-016]
- [x] CHK005 Is non-auto-reactivation after completeness restored required? [Completeness, Spec §FR-015] — covered by tasks T018b / T021

## Requirement Clarity

- [x] CHK006 Is “pricing complete” defined with a single unambiguous formula (plans × groupings × frequencies ∪ annual)? [Clarity, Spec §FR-012]
- [x] CHK007 Is “active plan” for completeness defined (active for sale vs all plans)? [Clarity, Spec Assumptions / Data Model]
- [x] CHK008 Is the timing of deactivation relative to the same persist transaction clear? [Clarity, Spec Clarifications, §FR-014]

## Requirement Consistency

- [x] CHK009 Do Story 3 acceptance scenarios match FR-014/015/016 without contradiction? [Consistency, User Story 3]
- [x] CHK010 Does SC-006 align with “deactivate on persist” rather than “on leave page”? [Consistency, Spec §SC-006, Clarifications]
- [x] CHK011 Are create-time “cannot activate until complete” rules consistent with edit-time auto-deactivate? [Consistency, Spec §FR-013, §FR-014]

## Scenario & Edge Coverage

- [x] CHK012 Are lifecycle requirements defined when removing a plan/category/frequency restores completeness? [Coverage, Spec Edge Cases] — restores completeness only; activate remains explicit (FR-015)
- [x] CHK013 Are lifecycle requirements defined when enabling Annually as payment frequency (annual cell already required)? [Coverage, Spec §FR-012, Data Model]
- [x] CHK014 Are requirements defined for historical policies when package later deactivates? [Coverage, Spec Assumptions / Out of Scope] — historical premiums unchanged
- [x] CHK015 Are concurrent edit lifecycle outcomes specified (last save wins + re-evaluate active)? [Coverage, Spec Edge Cases]
- [x] CHK018 Is deactivating a package mid-registration for in-flight agents specified? [Coverage, Spec §FR-016] — **resolved**: new picks blocked; in-flight may finish

## Acceptance Criteria Quality

- [x] CHK016 Can SC-005 and SC-006 be objectively judged from lifecycle requirements without UI-only language? [Measurability, Spec §SC-005, §SC-006]
- [x] CHK017 Is “warning before admin leaves the page” reconciled with deactivate-on-persist (warning on persist response)? [Clarity, Spec §SC-006 vs Clarifications] — **resolved** in wording

## Ambiguities & Gaps

- [x] CHK019 Are audit/history requirements for activation toggles intentionally out of scope? [Assumption, Out of Scope] — yes, deferred

## Notes

- Requirements-quality only; not operational runbooks.
- Post-remediation: FR-015 Jest (T018b), FR-016 in-flight, SC-006 wording aligned.
