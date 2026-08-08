# Security & Privacy Requirements Quality Checklist: Admin Messaging Campaigns

**Purpose**: Validate security/privacy requirement quality for campaigns (roles, PII, HTML, non-prod) — not penetration tests  
**Created**: 2026-08-08  
**Feature**: [spec.md](../spec.md) · [research.md](../research.md) · [plan.md](../plan.md)  
**Depth**: Standard · **Audience**: Sole PR reviewer (author)  
**Focus**: C — Security & privacy

## Requirement Completeness

- [x] CHK001 Are authorization requirements specified for compose/send/cancel vs history/CSV for each role? [Completeness, Spec §FR-001, §FR-002, §FR-033]
- [x] CHK002 Are customer care prohibitions (no compose, send, cancel, template edit) explicit? [Completeness, Spec §FR-002]
- [x] CHK003 Are HTML sanitization / unsafe-content requirements documented for admin email bodies? [Completeness, Spec §FR-010a, Research R8]
- [x] CHK004 Are non-prod recipient-redirect requirements stated for customer-linked campaign sends? [Completeness, Spec §FR-040]
- [x] CHK005 Are audit requirements sufficient to attribute who sent/cancelled campaigns? [Completeness, Spec §FR-035, §SC-010]

## Requirement Clarity

- [x] CHK006 Is PII handling for paste lists and CSV exports (who may download, what fields) specified? [Clarity, Spec §FR-002, §FR-028]
- [x] CHK007 Is retention/redaction of audience snapshots and paste lists specified or explicitly deferred? [Clarity → Assumptions: messaging retention settings]
- [x] CHK008 Is “error monitoring with recreate context” scoped so soft skips never alert? [Clarity, Spec §FR-024, §FR-025, §SC-008]

## Requirement Consistency

- [x] CHK009 Do role rules stay consistent between compose surfaces and API access for customer care? [Consistency, Spec §FR-002, Plan R13]
- [x] CHK010 Are campaign shells excluded from template edit consistently with “not saveable” ad hoc content? [Consistency, Spec §FR-006, §FR-038]
- [x] CHK011 Does English-only MVP conflict with any implied use of customer messaging language preferences? [Consistency, Spec §FR-012, Out of Scope]

## Scenario & Edge Coverage

- [x] CHK012 Are requirements defined for unauthorized access attempts to compose/cancel (expected denial)? [Coverage, Exception, Spec §FR-001/002 + constitution]
- [x] CHK013 Are requirements defined for campaign content containing scripts/HTML injection attempts? [Coverage, Spec §FR-010a]
- [x] CHK014 Are requirements defined for visibility of other admins’ campaigns and cancel-by-any-admin? [Coverage, Spec §FR-033]
- [x] CHK015 Is threat model / abuse of bulk send (threshold, delay, idempotency) covered as security controls in requirements? [Coverage, Spec §FR-031, §FR-032, §FR-034]

## Acceptance Criteria Quality

- [x] CHK016 Can SC-004 (customer care cannot compose/send) be objectively evidenced from written role requirements alone? [Measurability, Spec §SC-004]
- [x] CHK017 Are Sentry-vs-soft-skip rules measurable without implementation knowledge? [Measurability, Spec §SC-008]

## Ambiguities & Gaps

- [x] CHK018 Should HTML sanitization be elevated from research/plan into an explicit FR? [Gap → resolved via Spec §FR-010a]
- [x] CHK019 Are secrets/provider credentials out of scope for this feature’s requirements (assumed existing)? [Assumption]
- [x] CHK020 Are compliance/regulatory constraints (SMS consent, marketing opt-out) intentionally excluded? [Gap → Out of Scope]

## Notes

- Reviewed 2026-08-08. FR-010a closed HTML sanitization gap. All items PASS for implement gate.
- Check items off as completed: `[x]`
- Prefer promoting Plan/Research security decisions into Spec FRs when CHK018 fails
