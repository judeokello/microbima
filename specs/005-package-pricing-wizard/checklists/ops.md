# Ops / Cutover Requirements Quality Checklist: Package Pricing

**Purpose**: Validate completeness, clarity, and consistency of migration, cutover, and operational requirements  
**Created**: 2026-08-10  
**Updated**: 2026-08-10 (post-remediation: Go UAT sign-off, setup_admin backfill)  
**Feature**: [spec.md](../spec.md) · [plan.md](../plan.md) · [quickstart.md](../quickstart.md)  
**Depth**: Standard · **Audience**: Author  
**Focus**: E — Ops

## Requirement Completeness

- [x] CHK001 Are migration requirements for Mfanisi Boda and Mfanisi Go from static sheets specified? [Completeness, Spec §FR-021, User Story 6]
- [x] CHK002 Is removal/unused status of static pricing files after cutover required? [Completeness, Spec §FR-002, §SC-003]
- [x] CHK003 Is Go gap-fill + UAT before production cutover required? [Completeness, Spec §FR-021, Clarifications, §SC-008]
- [x] CHK004 Is “rate edits without redeploy” stated as an operational outcome? [Completeness, Spec §FR-001, §SC-002]
- [x] CHK005 Is big-bang cutover (no long dual-read) documented as the chosen approach? [Completeness, Spec Assumptions]
- [x] CHK005a Is one-time root `setup_admin` backfill for existing envs documented? [Completeness, Spec §FR-024a, Quickstart]

## Requirement Clarity

- [x] CHK006 Is “parity with prior sheet bands” defined for Boda vs “migrated/filled stored bands” for Go without contradiction? [Clarity, Spec §SC-008]
- [x] CHK007 Is UAT success for Go differences specified enough (who signs off, what compared)? [Clarity, Spec §FR-021, Quickstart] — **resolved**: informal `setup_admin` checklist; no formal CSV/ticket
- [x] CHK008 Is rollback of cutover (reverting to JSON) intentionally unspecified? [Clarity, Assumption] — not in MVP; redeploy prior revision if emergency

## Requirement Consistency

- [x] CHK009 Do ops requirements forbid container-disk rate edits consistently with problem statement? [Consistency, Spec Out of Scope]
- [x] CHK010 Does “no redeploy for rate edits” remain compatible with “redeploy still needed for schema/UI/API”? [Consistency, Spec §SC-002, Intake]

## Scenario & Edge Coverage

- [x] CHK011 Are requirements defined if migration leaves a package incomplete (cannot activate until filled)? [Coverage, Spec §FR-021]
- [x] CHK012 Are requirements defined for packages other than Boda/Go at cutover (empty pricing)? [Coverage] — inactive until admin completes; Member only seeded on create
- [x] CHK013 Are staging vs production cutover sequencing requirements documented? [Coverage, Quickstart] — migrate → fill Go → UAT → cutover FE → delete JSON

## Acceptance Criteria Quality

- [x] CHK014 Can SC-003 (100% flows off static files) be objectively scoped to named surfaces (payment, modify, recovery)? [Measurability, Spec §SC-003]
- [x] CHK015 Can SC-008 Go UAT be marked done without unspecified comparison artifacts? [Measurability, Spec §SC-008, Quickstart]

## Ambiguities & Gaps

- [x] CHK016 Are monitoring/alerting requirements for pricing API failures in registration intentionally deferred? [Assumption] — deferred; fail closed in UI
- [x] CHK017 Is feature-flag emergency kill switch intentionally rejected (big-bang assumption)? [Assumption] — yes

## Notes

- Requirements-quality only; not a deployment runbook checklist for executing Fly releases.
- Remediations: informal Go UAT sign-off, `setup_admin` seed/backfill in quickstart.
