# Audience & Preflight Requirements Quality Checklist: Admin Messaging Campaigns

**Purpose**: Validate audience expansion, filters, dedupe, skip/block, and CSV requirements quality  
**Created**: 2026-08-08  
**Feature**: [spec.md](../spec.md) · [research.md](../research.md)  
**Depth**: Standard · **Audience**: Sole PR reviewer (author)  
**Focus**: E — Audience / preflight

## Requirement Completeness

- [x] CHK001 Are all MVP audience modes listed and marked combinable per channel? [Completeness, Spec §FR-014, §FR-015]
- [x] CHK002 Are mandatory filters (customer status, policy status, package) conditioned on scheme-customer mode? [Completeness, Spec §FR-018]
- [x] CHK003 Are soft-skip vs hard-block situations enumerated (missing address, malformed paste, missing placeholders, zero sendable)? [Completeness, Spec §FR-020–§FR-026, §FR-021a]
- [x] CHK004 Are multi-scheme union and (customer, policy) expansion rules specified before dedupe? [Completeness, Spec §FR-016, §FR-022]
- [x] CHK005 Are CSV column requirements and availability (preview session vs post-Send detail) specified? [Completeness, Spec §FR-027, §FR-028]

## Requirement Clarity

- [x] CHK006 Is “union with dedupe” clearly distinguished from mathematical intersection? [Clarity, Spec §FR-016, Clarifications]
- [x] CHK007 Is content-sameness for dedupe defined as fully resolved body/subject (not wall-clock time)? [Clarity, Spec §FR-023, Edge Cases]
- [x] CHK008 Is “both phones” for scheme contacts unambiguous when only one is present? [Clarity, Spec §FR-020]
- [x] CHK009 Is identity resolution for pasted phones/emails (match → customerId; no match → still send) explicit? [Clarity, Spec §FR-021]
- [x] CHK010 Is inactive scheme/package visibility vs non-selectability unambiguous? [Clarity, Spec §FR-017a, §FR-018a]

## Requirement Consistency

- [x] CHK011 Do Email and SMS paste-list rules stay channel-pure without cross-channel mixing? [Consistency, Spec §FR-003, §FR-014, §FR-015]
- [x] CHK012 Is “include test users” consistent with soft-skip/block rules (no special exclusion)? [Consistency, Spec §FR-019]
- [x] CHK013 Does “no extra overlap rule” beyond address+content hash match User Story 7? [Consistency, Spec §FR-023, User Story 7]
- [x] CHK014 Are scheme-contact-as-customer linking rules consistent for SMS phones and email addresses? [Consistency, Edge Cases, Spec §FR-021]

## Scenario & Edge Coverage

- [x] CHK015 Are requirements defined when only contacts/paste modes are selected (filters hidden)? [Coverage, Spec §FR-018, Edge Cases]
- [x] CHK016 Are requirements defined when every paste line is malformed (zero sendable → block)? [Coverage, Spec §FR-021a, §FR-026]
- [x] CHK017 Are requirements defined for policy placeholders without matching policy under filters? [Coverage, Spec §FR-024, User Story 3]
- [x] CHK018 Are dependants/hand-pick explicitly out of scope in audience requirements? [Coverage, Out of Scope]

## Acceptance Criteria Quality

- [x] CHK019 Can SC-005 / SC-006 (dedupe vs multi-policy) be judged solely from FR-022/023? [Measurability, Spec §SC-005, §SC-006]
- [x] CHK020 Can SC-002 blocking behavior be distinguished from soft-skip continuation using FR-024–026 alone? [Measurability, Spec §SC-002, §SC-008]

## Ambiguities & Gaps

- [x] CHK021 Is normalization for phone/email (E.164 / lowercase) specified or left as assumption? [Ambiguity → Spec §FR-021b]
- [x] CHK022 Is maximum paste-list size specified beyond the 5k sendable warn? [Gap → Assumptions: no hard cap beyond 5k warn]
- [x] CHK023 Are per-scheme count pill rules defined when contacts/paste modes add recipients outside schemes? [Ambiguity, Spec §FR-029]

## Notes

- Reviewed 2026-08-08. FR-021b closed normalization gap. All items PASS for implement gate.
- Check items off as completed: `[x]`
- Research R11 is supporting design; product gaps should be closed in Spec when CHK021–023 fail
