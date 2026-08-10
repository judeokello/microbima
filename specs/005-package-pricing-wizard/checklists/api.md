# API Requirements Quality Checklist: Package Pricing

**Purpose**: Validate completeness, clarity, and consistency of pricing API / contract requirements (not implementation or HTTP test cases)  
**Created**: 2026-08-10  
**Updated**: 2026-08-10 (post-remediation: authz, FR-015 no auto-activate, category POST)  
**Feature**: [spec.md](../spec.md) · [plan.md](../plan.md) · [contracts/openapi.yaml](../contracts/openapi.yaml)  
**Depth**: Standard · **Audience**: Author  
**Focus**: B — API

## Requirement Completeness

- [x] CHK001 Are read paths for pricing by package id and by slug both required for drop-in consumers? [Completeness, Spec §FR-002a, Plan/OpenAPI]
- [x] CHK002 Are write/upsert requirements for the full pricing grid documented? [Completeness, Spec §FR-007, §FR-012]
- [x] CHK003 Are activation-blocking rules when `isActive=true` and pricing incomplete specified for API consumers? [Completeness, Spec §FR-013, §FR-023]
- [x] CHK004 Are incomplete-making mutation responses required to include deactivation + warning signaling? [Completeness, Spec §FR-014, SC-006]
- [x] CHK005 Are suggest-fill request/response requirements defined (empty cells, no silent overwrite)? [Completeness, Spec §FR-018]
- [x] CHK006 Is absence of `pricingMode` / extrapolate in API payloads required? [Completeness, Spec §FR-004]
- [x] CHK006a Is category create (`POST .../pricing/categories`) specified? [Completeness, OpenAPI / tasks T018a/T021a]
- [x] CHK006b Does complete pricing PUT explicitly **not** auto-activate? [Completeness, Spec §FR-015, OpenAPI]

## Requirement Clarity

- [x] CHK007 Is the drop-in response shape specified clearly enough relative to legacy JSON (plans, categories, spouse bands)? [Clarity, Spec §FR-002a, Research R4]
- [x] CHK008 Is “centrally enforced” activation defined as server-side rejection (not UI-only)? [Clarity, Spec §FR-023]
- [x] CHK009 Are error expectations for incomplete activation vs validation of amounts/frequencies distinguishable? [Clarity, Spec §FR-013, Plan Constraints]
- [x] CHK010 Is soft-loss warning payload optional vs required on GET/PUT specified? [Clarity] — soft loss is primarily UI-on-commit; API softLossWarnings advisory/optional

## Requirement Consistency

- [x] CHK011 Do API completeness rules match FR-012 (enabled frequencies ∪ always-required annual)? [Consistency, Spec §FR-012, Data Model]
- [x] CHK012 Are CUSTOM frequency rejections consistent across package setup and rate writes? [Consistency, Spec §FR-006, Data Model]
- [x] CHK013 Do modify/recovery read requirements match registration pricing read requirements? [Consistency, Spec §FR-002b]
- [x] CHK017 Are authz requirements for who may read vs write pricing documented? [Coverage, Spec §FR-024, OpenAPI Authz]

## Scenario & Edge Coverage

- [x] CHK014 Are requirements defined for GET pricing when package has no plans or incomplete rates? [Coverage, Spec Edge Cases] — return grid + completeness flags
- [x] CHK015 Are requirements defined when plan and category belong to different packages on write? [Coverage, Data Model] — reject validation
- [x] CHK016 Are concurrency/last-write-wins requirements stated for concurrent pricing editors? [Coverage, Spec Edge Cases]

## Acceptance Criteria Quality

- [x] CHK018 Can SC-002 (updated rates without redeploy) be validated against API persistence requirements alone? [Measurability, Spec §SC-002, §FR-001]
- [x] CHK019 Can SC-005 (activate blocked 100% when incomplete) map to an explicit API failure mode? [Measurability, Spec §SC-005, §FR-013]

## Ambiguities & Gaps

- [x] CHK020 Is versioning/compatibility of the drop-in DTO with older agents documented or assumed big-bang? [Assumption, Spec Assumptions] — big-bang
- [x] CHK021 Are idempotency requirements for PUT pricing intentionally omitted? [Assumption] — last-write-wins upsert is sufficient for MVP

## Notes

- Requirements-quality only; not contract test execution.
- Remediations: OpenAPI `setup_admin` / Forbidden, FR-015 on PUT, category POST.
