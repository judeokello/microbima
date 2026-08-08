# UX Requirements Quality Checklist: Admin Messaging Campaigns

**Purpose**: Validate completeness, clarity, and consistency of UX/compose/preview requirements (not implementation behavior)  
**Created**: 2026-08-08  
**Feature**: [spec.md](../spec.md) · [plan.md](../plan.md)  
**Depth**: Standard · **Audience**: Sole PR reviewer (author)  
**Focus**: A — UX / compose & preview

## Requirement Completeness

- [x] CHK001 Are SMS vs Email compose surfaces and channel-pure audience controls explicitly required? [Completeness, Spec §FR-003, §FR-014, §FR-015]
- [x] CHK002 Are placeholder insert, pill display, and remove (X) behaviors specified for the composer? [Completeness, Spec §FR-007]
- [x] CHK003 Are preview requirements defined for sendable count, per-scheme count pills, and sample recipient render? [Completeness, Spec §FR-029]
- [x] CHK004 Are color-linking rules between composer placeholder pills and preview resolved values specified? [Completeness, Spec §FR-030]
- [x] CHK005 Are empty-content validation messages required for SMS body and email subject/body? [Completeness, Spec §FR-009a]
- [x] CHK006 Are Templates vs Campaigns UI separation requirements documented (no send from Templates)? [Completeness, Spec §FR-004, User Story 6]

## Requirement Clarity

- [x] CHK007 Is “first fitting recipient” for sample preview defined deterministically enough to avoid ambiguous sampling? [Clarity, Spec §FR-029]
- [x] CHK008 Is “ignoring empty rich-text chrome” defined clearly enough for empty email body checks? [Clarity, Ambiguity, Spec §FR-009a]
- [x] CHK009 Is SMS segment/character count display specified without implying a max or warning (beyond the 5k audience warn)? [Clarity, Spec §FR-011, §FR-031a]
- [x] CHK010 Is typed confirmation specified as exact campaign name (not a generic CONFIRM word)? [Clarity, Spec §FR-031, Clarifications]
- [x] CHK011 Is the large-audience warning at 5,000 distinguished from the typed-confirmation threshold (default 20)? [Clarity, Spec §FR-031, §FR-031a]

## Requirement Consistency

- [x] CHK012 Are compose UX rules consistent with “admin shells only for campaigns” and non-saveable ad hoc content? [Consistency, Spec §FR-005, §FR-006]
- [x] CHK013 Do Email UX requirements consistently exclude phone-list audience and require subject? [Consistency, Spec §FR-015, §FR-009]
- [x] CHK014 Are countdown/cancel UI expectations aligned with delay defaults (SMS 2m / email 3m)? [Consistency, Spec §FR-032, User Story 4]

## Scenario & Edge Coverage

- [x] CHK015 Are UX requirements defined for preview soft-skip/error CSV download without creating history? [Coverage, Spec §FR-027]
- [x] CHK016 Are UX requirements defined when inactive schemes/packages are visible but not selectable? [Coverage, Spec §FR-017a, §FR-018a]
- [x] CHK017 Are loading/empty-state requirements for preview computation documented? [Gap → Assumptions: existing admin patterns]
- [x] CHK018 Are accessibility requirements (keyboard, focus, contrast) specified for pills, pickers, and rich text? [Gap → Assumptions: existing admin a11y conventions]

## Acceptance Criteria Quality

- [x] CHK019 Can “color-matched pills” be objectively assessed from the written requirements alone? [Measurability, Spec §FR-030]
- [x] CHK020 Does SC-001’s “under 5 minutes” journey map to explicit UX steps without unspecified screens? [Acceptance Criteria, Spec §SC-001]

## Ambiguities & Gaps

- [x] CHK021 Are placeholder catalog entries and labels for the picker enumerated in requirements (beyond examples)? [Gap → Assumptions: catalog via campaign-placeholders.ts / FR-008 categories]
- [x] CHK022 Is English-only compose UX (no language switcher) stated as a visible constraint? [Clarity, Spec §FR-012]
- [x] CHK023 Are mobile/responsive layout requirements for compose intentionally out of scope or missing? [Gap → Out of Scope / Assumptions: desktop-primary]

## Notes

- Reviewed 2026-08-08 against Spec (post-analyze remediations + Assumptions deferrals). All items PASS for implement gate.
- Check items off as completed: `[x]`
- This file is requirements-quality only; do not use for runtime QA
