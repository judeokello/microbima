# UX Requirements Quality Checklist: Package Pricing Wizard

**Purpose**: Validate completeness, clarity, and consistency of admin wizard + pricing-grid + registration drop-in UX requirements (not implementation behavior)  
**Created**: 2026-08-10  
**Updated**: 2026-08-10 (post-remediation: highlight, soft-loss timing, household-unknown)  
**Feature**: [spec.md](../spec.md) · [plan.md](../plan.md) · [quickstart.md](../quickstart.md)  
**Depth**: Standard · **Audience**: Author  
**Focus**: A — UX

## Requirement Completeness

- [x] CHK001 Are the three wizard steps (Setup → Pricing → Product Utilization Configuration → Finish) explicitly required for both create and edit? [Completeness, Spec §FR-005, §FR-022, User Story 5]
- [x] CHK002 Are pricing-grid axes specified (rows = frequencies, sections = groupings, columns = plans)? [Completeness, Spec §FR-007]
- [x] CHK003 Are double-click edit and previous+new highlighted value requirements defined for cell edits? [Completeness, Spec §FR-010, §FR-011, User Story 4]
- [x] CHK004 Are soft-loss warning (visual, non-blocking) and suggest-fill helper requirements defined for the grid? [Completeness, Spec §FR-017, §FR-018]
- [x] CHK005 Are registration drop-in UX requirements defined for plan / category / spouse / frequency / premium summary without a new agent workflow? [Completeness, Spec §FR-002a, §FR-002b, User Story 2]
- [x] CHK006 Is removal/replacement of extrapolate-related payment UI copy required? [Completeness, Spec §FR-004]
- [x] CHK006a Are Create/Edit/Activate controls hidden for users without `setup_admin`? [Completeness, Spec §FR-024]

## Requirement Clarity

- [x] CHK007 Is “visually highlighted” for the new cell amount specific enough? [Clarity, Spec §FR-011] — **resolved**: previous dimmed/struck; new distinct emphasis color
- [x] CHK008 Is the admin deactivation warning message content specified (who is blocked and until when)? [Clarity, Spec §FR-014, User Story 3] — new customers cannot register until complete
- [x] CHK009 Is step 3 “placeholder” defined as no required inputs + Finish only, with no hidden utilization fields? [Clarity, Spec §FR-022]
- [x] CHK010 Is “same interaction pattern as today’s registration UI” bounded clearly enough (which controls must remain)? [Clarity, Spec §FR-002a, Clarifications]

## Requirement Consistency

- [x] CHK011 Are Custom frequency exclusions consistent between Setup and Pricing grid requirements? [Consistency, Spec §FR-006, §FR-007]
- [x] CHK012 Do drop-in registration UX requirements align with lookup-only premium display (no daily×cadence labels)? [Consistency, Spec §FR-003, §FR-004, §FR-012a]
- [x] CHK013 Are Member-only spouse-disabled UX rules consistent between admin grid and registration payment? [Consistency, Spec §FR-009, §FR-020]

## Scenario & Edge Coverage

- [x] CHK014 Are UX requirements defined when pricing fails to load at registration (error/empty state)? [Coverage] — fail closed with error; no silent empty premium (Assumption / Edge)
- [x] CHK015 Are UX requirements defined for incomplete pricing indicators before activation is offered? [Coverage, Spec §FR-013]
- [x] CHK016 Are accessibility requirements (keyboard edit of cells, focus, contrast for warnings) specified or intentionally deferred? [Assumption] — deferred; double-click + blur/Enter commit specified
- [x] CHK017 Are loading states for suggest-fill / save pricing documented? [Assumption] — implement with existing admin patterns; not FR-level
- [x] CHK008a Is behavior when household size unknown for undersize check specified? [Clarity, Spec §FR-019a] — **skip undersize until known**

## Acceptance Criteria Quality

- [x] CHK018 Can SC-003a (“no new training beyond redeploy message”) be assessed from written UX requirements alone? [Measurability, Spec §SC-003a]
- [x] CHK019 Can SC-007 (soft loss under 1 second) be tied to a specified UI trigger (on blur/enter/change)? [Measurability, Spec §SC-007] — **resolved**: cell edit commit (blur/Enter/confirm)

## Ambiguities & Gaps

- [x] CHK020 Is wizard chrome (tabs vs sequential stepper) intentionally unspecified? [Assumption, Spec Assumptions]
- [x] CHK021 Are mobile/responsive requirements for the pricing grid intentionally out of scope? [Assumption] — admin desktop-first MVP

## Notes

- Requirements-quality only; not runtime QA.
- Remediations: FR-011 highlight, FR-017 timing, FR-019a household-unknown, FR-024 UI gating.
