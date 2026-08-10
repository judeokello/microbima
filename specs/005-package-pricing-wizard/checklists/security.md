# Security Requirements Quality Checklist: Package Pricing

**Purpose**: Validate completeness, clarity, and consistency of security/authz/data-protection requirements for pricing storage and admin edits  
**Created**: 2026-08-10  
**Updated**: 2026-08-10 (post-remediation: `setup_admin` + root-only grant)  
**Feature**: [spec.md](../spec.md) · [plan.md](../plan.md) · [contracts/openapi.yaml](../contracts/openapi.yaml)  
**Depth**: Standard · **Audience**: Author  
**Focus**: D — Security

## Requirement Completeness

- [x] CHK001 Are who-may-edit-pricing and who-may-activate requirements stated relative to existing package managers? [Completeness, Spec §FR-024] — **`setup_admin` mutate**
- [x] CHK002 Are who-may-read-pricing for payment/modify/recovery paths stated? [Completeness, Spec §FR-024] — read without `setup_admin`
- [x] CHK003 Is central enforcement against UI bypass of activation gates required? [Completeness, Spec §FR-023]
- [x] CHK004 Are requirements to avoid writing rate secrets/files onto shared container disks documented? [Completeness, Spec Out of Scope / Problem]
- [x] CHK005 Are RLS expectations for new public pricing tables addressed in plan/constitution alignment? [Completeness, Plan Constitution Check]
- [x] CHK001a Is grant/revoke of `setup_admin` restricted to root (bootstrap) only? [Completeness, Spec §FR-024a]

## Requirement Clarity

- [x] CHK006 Is “same authorized product data path” clear enough (no anonymous public pricing URL)? [Clarity, Spec §FR-024]
- [x] CHK007 Are customer_care vs registration_admin distinctions for pricing mutate resolved? [Clarity, Spec §FR-024] — **resolved**: mutate = `setup_admin` only; list/view for other admin roles

## Requirement Consistency

- [x] CHK008 Do security requirements align with API-first internal API access (no static public JSON after cutover)? [Consistency, Spec §FR-001, §FR-002]
- [x] CHK009 Is partner-facing pricing editor exclusion consistent with security boundary? [Consistency, Spec Out of Scope]
- [x] CHK009a Do OpenAPI mutate ops document `setup_admin` / 403? [Consistency, contracts/openapi.yaml]

## Scenario & Edge Coverage

- [x] CHK010 Are requirements defined for unauthorized activate attempts on incomplete packages? [Coverage, Spec §FR-013, §FR-023]
- [x] CHK011 Are requirements defined for unauthorized pricing PUT/category create? [Coverage, Spec §FR-024] — 403 without `setup_admin`
- [x] CHK012 Are threat assumptions for tampering with client-side soft-loss warnings documented (warn is advisory)? [Coverage, Spec §FR-017]
- [x] CHK011a Are requirements defined when non-root tries to grant `setup_admin`? [Coverage, Spec §FR-024a]

## Acceptance Criteria Quality

- [x] CHK013 Can “bypass admin UI must not activate incomplete package” be assessed as a security requirement independently of UI tests? [Measurability, Spec §FR-023]

## Ambiguities & Gaps

- [x] CHK014 Are audit-log requirements for rate changes intentionally deferred? [Assumption, Spec Assumptions / Out of Scope]
- [x] CHK015 Are PII concerns for pricing data (none expected) explicitly stated or unnecessary? [Assumption] — pricing amounts are not PII; no extra requirement

## Notes

- Requirements-quality only; not a penetration test plan.
- Remediations: FR-024/024a, research R12, OpenAPI authz notes, tasks T016*.
