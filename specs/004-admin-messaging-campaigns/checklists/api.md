# API / Contracts Requirements Quality Checklist: Admin Messaging Campaigns

**Purpose**: Validate API and contract requirements quality against the spec and OpenAPI (not runtime API tests)  
**Created**: 2026-08-08  
**Feature**: [spec.md](../spec.md) · [contracts/openapi.yaml](../contracts/openapi.yaml) · [plan.md](../plan.md)  
**Depth**: Standard · **Audience**: Sole PR reviewer (author)  
**Focus**: B — API & contracts

## Requirement Completeness

- [x] CHK001 Are preview vs Send persistence rules specified as distinct API outcomes (no row vs campaign row)? [Completeness, Spec §FR-027, §FR-027a]
- [x] CHK002 Are cancel, list, detail, and CSV download capabilities required for the appropriate roles? [Completeness, Spec §FR-002, §FR-033, §FR-027]
- [x] CHK003 Are idempotency requirements defined for duplicate Send (campaign id and name+body+audience window)? [Completeness, Spec §FR-034]
- [x] CHK004 Are failed-preflight response requirements including renamed name and CSV data specified? [Completeness, Spec §FR-013a, §FR-024]
- [x] CHK005 Does the OpenAPI contract cover preview, create, get, list, cancel, and CSV paths described in the plan? [Completeness, Contract, Plan]

## Requirement Clarity

- [x] CHK006 Is the confirmation field (`confirmationName` / equivalent) required behavior specified when count ≥ threshold? [Clarity, Spec §FR-031, Contract]
- [x] CHK007 Are 422 vs 409 semantics distinguishable for validation vs idempotency/conflict in requirements? [Clarity, Contract, Spec §FR-034a]
- [x] CHK008 Is English-only (`en`) for campaign deliveries stated as an API/language constraint? [Clarity, Spec §FR-012]
- [x] CHK009 Are CSV column requirements explicit enough for contract/schema alignment? [Clarity, Spec §FR-028]

## Requirement Consistency

- [x] CHK010 Do RBAC requirements for admin vs customer care match across FR-001/002 and contract security notes? [Consistency, Spec §FR-001, §FR-002]
- [x] CHK011 Are channel-pure audience rules consistent between FR-014/015 and `CampaignAudience` schema? [Consistency, Spec §FR-014, §FR-015, Contract]
- [x] CHK012 Does “Send creates campaign even on failed preflight” align between FR-027a and OpenAPI 422 description? [Consistency, Spec §FR-027a, Contract]

## Scenario & Exception Coverage

- [x] CHK013 Are requirements defined for cancel when status is not cancellable (e.g. already completed)? [Coverage, Exception, Spec §FR-033, Contract 409]
- [x] CHK014 Are requirements defined for missing campaign id (404) on detail/CSV/cancel? [Coverage, Contract]
- [x] CHK015 Are template PATCH restrictions (non-admin shells only / no campaign send) reflected in API requirements? [Coverage, Spec §FR-004, §FR-038]
- [x] CHK016 Are correlation-id / standardized error envelope requirements referenced for campaign endpoints? [Coverage, Assumption, Constitution]

## Acceptance Criteria Quality

- [x] CHK017 Can SC-002 (block with CSV, zero handoffs) be mapped to specific API responses without ambiguity? [Measurability, Spec §SC-002]
- [x] CHK018 Can SC-009 (idempotency) be evaluated against documented request identity rules? [Measurability, Spec §SC-009, §FR-034]

## Ambiguities & Gaps

- [x] CHK019 Is pagination contract for campaign list fully specified (sort order, filters)? [Gap → Assumptions: createdAt desc + OpenAPI filters]
- [x] CHK020 Are rate-limit requirements for preview/send of large audiences specified or explicitly deferred? [Gap → Assumptions / Out of Scope: deferred]
- [x] CHK021 Is `Idempotency-Key` header required vs optional clearly stated in product requirements (not only contract)? [Ambiguity, Spec §FR-034, Research R10]

## Notes

- Reviewed 2026-08-08 against Spec + OpenAPI. All items PASS for implement gate.
- Check items off as completed: `[x]`
- Cross-check findings against `contracts/openapi.yaml` and update spec/contract if gaps are real product omissions
