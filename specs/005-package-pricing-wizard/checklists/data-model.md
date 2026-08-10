# Data-Model Requirements Quality Checklist: Package Pricing

**Purpose**: Validate completeness, clarity, and consistency of pricing domain/data requirements (entities, uniqueness, completeness rules)  
**Created**: 2026-08-10  
**Updated**: 2026-08-10 (post-remediation: Decimal(10,2), Member-only seed)  
**Feature**: [spec.md](../spec.md) · [data-model.md](../data-model.md) · [plan.md](../plan.md)  
**Depth**: Standard · **Audience**: Author  
**Focus**: F — Data model

## Requirement Completeness

- [x] CHK001 Are entities PackagePricingCategory and PackagePlanRate (or equivalents) required with relationships to Package/Plan? [Completeness, Spec Key Entities, Data Model]
- [x] CHK002 Are category kinds Member only / Up to N / Additional spouse and their cardinality rules specified? [Completeness, Spec §FR-008, Data Model]
- [x] CHK003 Is uniqueness of Up to N (`maxMembers`) per package required? [Completeness, Spec §FR-008, Edge Cases]
- [x] CHK004 Is the always-required annual amount vs optional Annually payment frequency distinction documented? [Completeness, Spec §FR-012, Clarifications, Data Model]
- [x] CHK005 Is rejection of CUSTOM on rate frequencies required? [Completeness, Spec §FR-006, Data Model]
- [x] CHK006 Is amount > 0 required for completeness (zero/negative invalid)? [Completeness, Spec Edge Cases, §FR-012]

## Requirement Clarity

- [x] CHK007 Is `maxMembers` minimum (≥2) for Up to N stated? [Clarity, Data Model] — yes (≥2)
- [x] CHK008 Is Member only auto-seed on package create a requirement? [Clarity, Spec §FR-008, Research R9] — yes (required grouping; seed on create)
- [x] CHK009 Is “active plan” inclusion in completeness unambiguous? [Clarity, Spec Assumptions / Data Model]

## Requirement Consistency

- [x] CHK010 Do Spec FR-012 and Data Model completeness definition agree on enabledFrequencies ∪ {ANNUALLY}? [Consistency, Spec §FR-012, Data Model]
- [x] CHK011 Does optional Up to N / spouse align with “Member only required” without implying family bands always exist? [Consistency, Spec §FR-008, Clarifications]
- [x] CHK012 Is absence of pricingMode consistent across Spec, Data Model, and Out of Scope? [Consistency, Spec §FR-004]
- [x] CHK012a Do state transitions document complete-save stays inactive until explicit activate? [Consistency, Spec §FR-015, Data Model]

## Scenario & Edge Coverage

- [x] CHK013 Are cascade/delete behaviors when removing plans or categories specified for rates? [Coverage, Spec Edge Cases, Data Model] — ON DELETE CASCADE
- [x] CHK014 Are requirements defined when Annually is both always-required band and enabled payment frequency (single cell)? [Coverage, Data Model]
- [x] CHK015 Are rate-revision history requirements explicitly out of scope? [Coverage, Spec Out of Scope, Research R10]

## Acceptance Criteria Quality

- [x] CHK016 Can completeness be objectively evaluated from the written formula alone? [Measurability, Spec §FR-012]
- [x] CHK017 Are identity keys for categories (`key` / display) requirements clear for migration mapping? [Measurability, Spec §FR-021, Data Model mapping]

## Ambiguities & Gaps

- [x] CHK018 Are currency/units for amounts specified or assumed? [Assumption] — system default currency; no per-rate currency column in MVP
- [x] CHK019 Are decimal precision requirements (2 places) stated? [Clarity] — **resolved**: Decimal(10,2) in data-model / plan

## Notes

- Checklist path: `checklists/data-model.md` (distinct from design doc `data-model.md`).
- Requirements-quality only.
- Remediations: Decimal(10,2), FR-015 state machine, household-unknown in data-model.
