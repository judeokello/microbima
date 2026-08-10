# Family / Audience Requirements Quality Checklist: Package Pricing

**Purpose**: Validate completeness, clarity, and consistency of household category, overflow, and spouse-premium requirements  
**Created**: 2026-08-10  
**Updated**: 2026-08-10 (post-remediation: household-unknown, spouse rules)  
**Feature**: [spec.md](../spec.md) · [plan.md](../plan.md) · [data-model.md](../data-model.md)  
**Depth**: Standard · **Audience**: Author  
**Focus**: G — Family / household (formerly “audience” for this feature)

## Requirement Completeness

- [x] CHK001 Are household size → category mapping rules specified (size 1 = Member only; else smallest Up to N ≥ size)? [Completeness, Spec §FR-019]
- [x] CHK002 Is overflow (no fitting Up to N) required to block rather than clamp? [Completeness, Spec §FR-019, Edge Cases]
- [x] CHK003 Are registration category choices required to come from package-configured groupings (not hard-coded global lists)? [Completeness, Spec §FR-019]
- [x] CHK004 Is undersized category selection blocked when household data is available? [Completeness, Spec §FR-019a, Clarifications]
- [x] CHK005 Are additional-spouse applicability rules specified (not Member only; >1 spouse / existing UI intent)? [Completeness, Spec §FR-009, §FR-020]
- [x] CHK006 Is Member only the only mandatory grouping, with Up to N and spouse optional? [Completeness, Spec §FR-008, Clarifications]

## Requirement Clarity

- [x] CHK007 Is “household size” defined as principal + active dependants (deleted excluded)? [Clarity, Spec Key Entities]
- [x] CHK008 Is behavior when household data is **not** available to check undersizing specified? [Clarity, Spec §FR-019a] — **resolved**: skip undersize check while unknown
- [x] CHK009 Is “more than one spouse” vs checkbox opt-in conflict resolved clearly enough vs today’s UI? [Clarity, Spec §FR-020] — enabled if not Member only; apply on opt-in; block add-on if household known and ≤1 spouse

## Requirement Consistency

- [x] CHK010 Do overflow block requirements align with optional Up to N (size>1 with only Member only → block)? [Consistency, Spec §FR-008, Edge Cases]
- [x] CHK011 Do spouse add-on rules align with Member-only disablement in drop-in registration UX? [Consistency, Spec §FR-009, §FR-002a]
- [x] CHK012 Are agent-selected categories consistent with validation against derived household size (picker + block)? [Consistency, Spec §FR-019a]

## Scenario & Edge Coverage

- [x] CHK013 Are requirements defined for exactly one spouse (no additional spouse premium)? [Coverage, Spec §FR-020]
- [x] CHK014 Are requirements defined when multiple Up to N bands exist (must pick smallest fitting for validation)? [Coverage, Spec §FR-019]
- [x] CHK015 Are modify-product and recovery flows included in family-category validation requirements? [Coverage, Spec §FR-002b]

## Acceptance Criteria Quality

- [x] CHK016 Can “no silent clamp” be objectively tested from the written overflow requirement? [Measurability, Spec §FR-019]
- [x] CHK017 Can “undersized category blocked when data available” be assessed without unspecified data sources? [Measurability, Spec §FR-019a]

## Ambiguities & Gaps

- [x] CHK018 Is dependant relationship set for spouse detection enumerated in requirements? [Assumption] — reuse existing registration spouse/relationship detection; not reinvented in this feature
- [x] CHK019 Are display labels (`M`, `M(5)`) requirements or migration leftovers? [Assumption] — migration maps `displayName`; admin may set labels

## Notes

- Requirements-quality only; filename `family.md` maps to option G.
- Remediations: FR-019a unknown-household, FR-020 spouse opt-in, data-model household section.
