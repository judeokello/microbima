# Ops / Release-Gate Requirements Quality Checklist: Admin Messaging Campaigns

**Purpose**: Validate operational readiness requirements quality (settings, audit, monitoring, non-prod, release assumptions)  
**Created**: 2026-08-08  
**Feature**: [spec.md](../spec.md) · [plan.md](../plan.md) · [quickstart.md](../quickstart.md) · [research.md](../research.md)  
**Depth**: Standard · **Audience**: Sole PR reviewer (author)  
**Focus**: F — Ops & release gate

## Requirement Completeness

- [x] CHK001 Are configurable settings and defaults documented (confirm threshold, SMS/email delays, idempotency window)? [Completeness, Spec §FR-039]
- [x] CHK002 Are admin template shell keys and “not saveable from UI” rules documented for ops/seed expectations? [Completeness, Spec §FR-005, §FR-006, Research R14]
- [x] CHK003 Are audit/history requirements sufficient for support without DB access? [Completeness, Spec §FR-035, §SC-010]
- [x] CHK004 Are Sentry/alert expectations for blocking preflight vs soft skips documented? [Completeness, Spec §FR-024, §FR-025, §SC-008]
- [x] CHK005 Are non-prod redirect requirements documented for campaign broadcasts? [Completeness, Spec §FR-040]

## Requirement Clarity

- [x] CHK006 Are default numeric settings stated with units (seconds vs minutes) consistently? [Clarity, Spec §FR-032, §FR-039, Clarifications]
- [x] CHK007 Is the 5,000 large-audience warn a fixed product constant vs a setting? [Clarity, Spec §FR-031a, Research R9]
- [x] CHK008 Is “recreate/troubleshoot context” for error monitoring described at a requirements level (what must be included)? [Clarity, Spec §FR-024]

## Requirement Consistency

- [x] CHK009 Do Quickstart validation paths align with Spec success criteria (SMS happy path, failed preflight, CC read-only)? [Consistency, Quickstart, Spec §SC-001–§SC-004]
- [x] CHK010 Do Plan settings keys align with Spec FR-039 defaults? [Consistency, Plan, Spec §FR-039]
- [x] CHK011 Is AT bulk batching correctly marked deferred so ops do not expect MVP multi-recipient batching? [Consistency, Research R7, Plan]

## Scenario & Release Coverage

- [x] CHK012 Are migration/seed requirements implied for new tables, CANCELLED status, and settings? [Coverage, Data Model, Plan]
- [x] CHK013 Are rollback/forward-fix expectations for failed migrations documented or intentionally deferred? [Gap → Assumptions: standard Prisma ops]
- [x] CHK014 Are dual progress counts’ dependency on provider webhooks acknowledged in requirements/assumptions? [Coverage, Spec §FR-037, Assumption]
- [x] CHK015 Are customer care history access constraints documented for release verification? [Coverage, Spec §FR-002, §SC-004]

## Acceptance Criteria Quality

- [x] CHK016 Can SC-010 audit completeness be used as a release acceptance gate without engineering DB access? [Measurability, Spec §SC-010]
- [x] CHK017 Are settings-change effects (delay/threshold) required to apply to new campaigns only vs in-flight? [Gap → Assumptions: new campaigns; stamped dispatchStartsAt]

## Dependencies & Assumptions

- [x] CHK018 Is dependence on existing Africa’s Talking / SMTP / messaging worker stated as an assumption? [Assumption, Plan]
- [x] CHK019 Is dependence on existing Customer Messages tab for per-customer visibility stated? [Assumption, Spec §FR-036]
- [x] CHK020 Are system-settings-snapshot sync obligations captured for implementers/reviewers? [Dependency, Plan, Workspace rule]

## Ambiguities & Gaps

- [x] CHK021 Are on-call / runbook requirements for stuck DISPATCHING campaigns specified? [Gap → Assumptions: cron reclaim; no separate runbook FR]
- [x] CHK022 Is feature-flag / gradual rollout required or out of scope? [Gap → Out of Scope]

## Notes

- Reviewed 2026-08-08. All items PASS for implement gate (residuals explicitly deferred in Spec Assumptions / Out of Scope).
- Check items off as completed: `[x]`
- Use together with Quickstart for release readiness discussions; this checklist still tests requirements text, not live systems
