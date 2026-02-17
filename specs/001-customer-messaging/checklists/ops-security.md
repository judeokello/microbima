# Operational & Security Requirements Quality Checklist: Unified Customer Messaging

**Purpose**: Unit tests for the *requirements writing* quality of operational, security, privacy, and lifecycle aspects (webhooks, retries, retention, auditability, observability).  
**Created**: 2026-02-16  
**Feature**: [spec.md](../spec.md)

**Note**: This checklist validates whether requirements are complete/clear/consistent/measurable. It does **not** test the implementation.

## Requirement Completeness

- [x] CHK001 Are RBAC requirements explicitly defined for *all* internal messaging endpoints (history, resend, templates, routes, settings, attachments) including which roles can do which actions? [Completeness, Spec §FR-022, Spec §FR-013]
- [x] CHK002 Are privacy/data-minimization requirements specified for webhook payload storage (what is stored vs explicitly prohibited: headers, query strings, secrets)? [Completeness, Spec §FR-023h]
- [x] CHK003 Are log-safety requirements explicit (no raw webhook payloads in logs; only structured metadata)? [Completeness, Spec §FR-023h]
- [x] CHK004 Is attachment retention enforcement behavior fully specified for both “expired” and “deletion pending” states, including operator visibility? [Completeness, Spec §FR-018d]
- [x] CHK005 Does the spec define the canonical separation of **internal status** vs **provider outcomes**, including which outcomes are terminal vs non-terminal? [Completeness, Spec §FR-023g, Spec §Delivery Status Terminology]
- [x] CHK006 Are required delivery audit fields complete for operational investigation (templateKey, channel, customerId/policyId optionality, requested/used language, timestamps, correlationId)? [Completeness, Spec §FR-011, Spec §FR-009c]
- [x] CHK007 Is the storage “source of truth” for resends complete for both channels (SMS body; Email subject/body/text + attachments) and tied to retention rules? [Completeness, Spec §FR-014c, Spec §FR-021, Spec §FR-018]

## Requirement Clarity

- [x] CHK008 Is “store raw webhook payload for audit” defined precisely enough to be testable (where stored, how linked, and what “unmapped” means)? [Clarity, Spec §FR-023e, Spec §FR-023b]
- [x] CHK009 Is the webhook “success response” rule unambiguous across conditions (stored-but-unmapped returns success; rate limited returns 429 only when not stored; >200 SendGrid events stored+success but not processed)? [Clarity, Spec §FR-023b]
- [x] CHK010 Are the rules for “retryable vs poison” failures explicit and non-overlapping (so the same failure can’t be both retryable and poison)? [Clarity, Spec §FR-024c, Spec §FR-024d]
- [x] CHK011 Is the retry eligibility rule complete and deterministic (eligible status + nextAttemptAt + attemptCount vs maxAttempts)? [Clarity, Spec §FR-024a, Spec §FR-025c]
- [x] CHK012 Is the jitter/backoff rule independently verifiable (formula, bounds, what is recorded)? [Clarity, Spec §FR-024b]
- [x] CHK013 Are placeholder rules for “invalid-but-present” values precise (what types are allowed; how `Date` is formatted; UTC requirement)? [Clarity, Spec §FR-007c, Spec §FR-008b]
- [x] CHK014 Is “HTML minification” bounded (deterministic; whitespace/comment-only; and what exact string is stored vs sent)? [Clarity, Spec §FR-014d]
- [x] CHK015 Is “asynchronous” defined as a requirement (no provider/render work before returning) and expressed in measurable terms? [Clarity, Spec §FR-010a, Spec §FR-010b]

## Requirement Consistency

- [x] CHK016 Do user stories and FRs consistently describe what “status updated by webhooks” means without contradicting “SENT = provider accepted” semantics? [Consistency, Spec §User Story 4, Spec §Delivery Status Terminology, Spec §FR-023d]
- [x] CHK017 Are retention and resend rules consistent (attachments unavailable after expiry; expired still visible in history; resend fails clearly)? [Consistency, Spec §FR-018, Spec §FR-018a, Spec §FR-021]
- [x] CHK018 Are resend rules consistent with “stored rendered content is source of truth” for both channels (no re-render; no regeneration within retention)? [Consistency, Spec §FR-014c, Spec §FR-021a]
- [x] CHK019 Are “unmapped provider events” rules consistent with audit requirements and response behavior (store + success; later linkage optional)? [Consistency, Spec §FR-023e, Spec §Edge Cases]

## Acceptance Criteria Quality (Measurability)

- [x] CHK020 Are propagation expectations for admin configuration changes measurable (routes/settings changes take effect within a defined timeframe, not just “without redeploy”)? [Measurability, Spec §SC-002, Spec §FR-003, Spec §FR-025]
- [x] CHK021 Are retention defaults measurable with a defined start time for each retention clock? [Measurability, Spec §FR-018c]
- [x] CHK022 Are worker processing controls measurable and externally configurable (poll interval, batch size, concurrency) with explicit default values? [Measurability, Spec §FR-025a, Spec §FR-025b]
- [x] CHK023 Are webhook abuse-protection requirements measurable (per-IP/global thresholds + response codes) and consistent with “store-first” rules? [Measurability, Spec §FR-023b, Spec §FR-023a]

## Scenario Coverage

- [x] CHK024 Are requirements defined for malformed webhook payloads (validation outcome, safe errors, and whether payload is stored or rejected)? [Coverage, Spec §Edge Cases, Spec §FR-023h]
- [x] CHK025 Are requirements defined for webhook dedupe when provider event IDs are missing (derived key strategy must be documented per provider)? [Coverage, Spec §FR-023f]
- [x] CHK026 Are requirements defined for out-of-order provider events (e.g., delivered before processed; duplicate; delayed), and how they affect the operator-visible provider outcome view? [Coverage, Spec §FR-023g, Spec §FR-023d]
- [x] CHK027 Are requirements defined for storage failures during webhook ingestion (e.g., DB down): what response is returned and what is recorded? [Gap, Coverage]
- [x] CHK028 Are requirements defined for cleanup job failures (Supabase transient error) including retry behavior and operator visibility? [Coverage, Spec §FR-018d]

## Edge Case Coverage

- [x] CHK029 Are edge cases defined for clock skew/time source issues affecting `nextAttemptAt` eligibility (e.g., “now” from DB vs app) or explicitly deferred? [Gap, Edge Case]
- [x] CHK030 Are edge cases defined for “attachment exists in DB but missing in storage” at resend time (fail reason, retryability) and consistent with poison vs retryable classification? [Coverage, Spec §FR-021, Spec §FR-024c]
- [x] CHK031 Are edge cases defined for customers with unsupported language codes and how fallback is recorded? [Coverage, Spec §Edge Cases, Spec §FR-006]
- [x] CHK032 Are edge cases defined for “route enables neither channel” and whether that is audited/recorded anywhere? [Coverage, Spec §Edge Cases, Spec §User Story 1]

## Non-Functional Requirements

- [x] CHK033 Is multi-instance safety required in requirements language (at-most-once claim/processing per attempt), not only in planning language? [NFR, Spec §FR-010c]
- [x] CHK034 Are monitoring requirements specific and structured (which fields are required; where they appear in UI; which failures must emit monitoring events)? [NFR, Spec §FR-009d]
- [x] CHK035 Are data handling and access requirements defined for stored rendered content and attachments (who can view/download; privacy expectations) beyond just “stored for audit”? [Gap, NFR]

## Dependencies & Assumptions

- [x] CHK036 Are provider-specific assumptions explicitly documented (SendGrid event array semantics/caps; Africa’s Talking event identifiers; possible duplicates/out-of-order) and tied to requirements? [Assumption/Dependency, Spec §FR-023b, Spec §FR-023f]
- [x] CHK037 Are storage assumptions explicit (Supabase bucket privacy; availability expectations; what happens if storage is degraded)? [Gap, Dependency]

## Ambiguities & Conflicts (spot checks)

- [x] CHK038 Are there any remaining stakeholder-facing terms that could be misread operationally (e.g., “delivered” vs “sent”), and is the glossary sufficient to prevent that confusion? [Ambiguity, Spec §Delivery Status Terminology]
- [x] CHK039 Is the line between “store raw payload” (audit) and “data minimization” (privacy) non-contradictory and explicit about what is forbidden to persist? [Conflict check, Spec §FR-023h]

## Notes

- Check items off as completed: `[x]`
- Use `[Gap]` items as prompts to add missing requirements (or explicitly declare them out of scope)
