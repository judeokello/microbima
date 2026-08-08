# Campaign Lifecycle Requirements Quality Checklist: Admin Messaging Campaigns

**Purpose**: Validate clarity and completeness of campaign state, delay, cancel, progress, and terminal-status requirements  
**Created**: 2026-08-08  
**Feature**: [spec.md](../spec.md) · [data-model.md](../data-model.md)  
**Depth**: Standard · **Audience**: Sole PR reviewer (author)  
**Focus**: D — Campaign lifecycle

## Requirement Completeness

- [x] CHK001 Are campaign statuses and transitions specified for delay → dispatch → completed / completed-with-failures / cancelled / failed-preflight? [Completeness, Spec §FR-027a, §FR-032, §FR-033a, Data Model]
- [x] CHK002 Are delay defaults and configurability specified separately for SMS and email? [Completeness, Spec §FR-032, §FR-039]
- [x] CHK003 Are cancel rules defined for both delay window and post-dispatch pending deliveries? [Completeness, Spec §FR-033, User Story 4]
- [x] CHK004 Are dual progress metrics (handed-off vs receipt-confirmed) plus targeted count required on detail? [Completeness, Spec §FR-037, Clarifications]
- [x] CHK005 Is failed-preflight name rewrite (`_failedX`) fully specified including reuse of original name? [Completeness, Spec §FR-013a]

## Requirement Clarity

- [x] CHK006 Is “handed off to provider” distinguished from “receipt confirmed” in product language? [Clarity, Spec §FR-037, Assumptions]
- [x] CHK007 Is “Completed with failures” vs “Cancelled” (partial handoff) unambiguously distinguished? [Clarity, Spec §FR-033a]
- [x] CHK008 Is “not-yet-sent” defined relative to pending vs processing vs handed-off? [Clarity, Spec §FR-033, Edge Cases]
- [x] CHK009 Is auto-increment rule for `_failedX` clear when multiple failures share a requested name? [Clarity, Spec §FR-013a]

## Requirement Consistency

- [x] CHK010 Do User Story 4 acceptance scenarios align with FR-033 / FR-033a? [Consistency, User Story 4, Spec §FR-033]
- [x] CHK011 Does “preview creates no history row” stay consistent with “Send always creates a row”? [Consistency, Spec §FR-027, §FR-027a]
- [x] CHK012 Are name uniqueness rules consistent across cancelled, completed, and failed-preflight (after rename)? [Consistency, Spec §FR-013, §FR-013a]

## Scenario & Recovery Coverage

- [x] CHK013 Are requirements defined for cancel after dispatch when some deliveries already handed off? [Coverage, Recovery, Spec §FR-033, §SC-007]
- [x] CHK014 Are requirements defined for terminal status when all remaining pendings are cancelled? [Coverage, Spec §FR-033a]
- [x] CHK015 Are requirements defined for idempotent double-send during DELAYED/DISPATCHING? [Coverage, Spec §FR-034, §SC-009]
- [x] CHK016 Are audit events required for create, fail-preflight, delay, cancel, and dispatch completion? [Coverage, Spec §FR-035, Data Model]

## Acceptance Criteria Quality

- [x] CHK017 Are SC-007 / SC-007a measurable from status and handoff definitions alone? [Measurability, Spec §SC-007, §SC-007a]
- [x] CHK018 Is SC-003a’s dual-count refresh expectation specific enough (“normal UI refresh”)? [Measurability → Assumptions: qualitative poll/nav]

## Ambiguities & Gaps

- [x] CHK019 Is campaign content/audience immutable after Send (during delay) stated explicitly? [Gap → Spec §FR-032a]
- [x] CHK020 Are dispatcher failure / crash recovery requirements documented? [Gap → Assumptions: cron reclaim]
- [x] CHK021 Is time-zone display of countdown specified as UTC vs local for admins? [Gap → Assumptions: local UI of UTC instant]

## Notes

- Reviewed 2026-08-08. FR-032a + Assumptions closed residual gaps. All items PASS for implement gate.
- Check items off as completed: `[x]`
- Cross-reference Data Model state diagrams when assessing CHK001
