# Unit Tests for English Checklist: Unified Customer Messaging (Templates + Worker)

**Purpose**: Validate the messaging requirements are complete, unambiguous, and internally consistent (focused on templates/language/placeholder rendering and the outbox worker/retries lifecycle).  
**Created**: 2026-02-16  
**Feature**: [spec.md](../spec.md) (see also [plan.md](../plan.md))

## Requirement Completeness

- [ ] CHK001 Are all supported **channels** explicitly enumerated and used consistently (SMS, Email) without introducing extra channels implicitly? [Completeness, Spec §FR-001]
- [ ] CHK002 Are the required **template dimensions** fully specified (template key + channel + language) and described as a stable identifier set? [Completeness, Spec §FR-002, Spec §FR-004]
- [ ] CHK003 Is the **system default language** requirement explicitly defined as a configurable setting (not implied), including where it is sourced from? [Completeness, Spec §FR-006, Spec §FR-025]
- [ ] CHK004 Are the **inputs to rendering** (customer/event/policy data) clearly scoped so reviewers can tell what data is allowed to populate placeholders? [Gap, Spec §FR-007]
- [ ] CHK005 Are the **placeholder requirements** complete (syntax, required vs optional placeholders, and how “required” is determined)? [Gap, Spec §FR-007, Spec §FR-008]
- [ ] CHK006 Are the worker’s **eligible statuses** for processing explicitly listed (e.g., pending/retry-wait) and mapped to state transitions? [Gap, Plan §Delivery lifecycle and worker algorithm]
- [ ] CHK007 Are **retry defaults** and “configurable per channel only” stated together so there is no ambiguity about whether templates/routes can override retries? [Completeness, Spec §FR-024]

## Requirement Clarity

- [ ] CHK008 Is the meaning of “**asynchronous**” quantified in requirements (e.g., “enqueue must complete within X ms” or “must not wait for provider calls”) rather than left as a vague adjective? [Ambiguity, Spec §FR-010, Spec §SC-004]
- [ ] CHK009 Is “**enqueue quickly**” expressed with a measurable threshold or observable behavior suitable for acceptance criteria? [Ambiguity, Spec §FR-010]
- [ ] CHK010 Are the **language fallback steps** written as an explicit deterministic algorithm (preferred → system default → fail) including what gets recorded? [Clarity, Spec §FR-006, Spec §User Story 2]
- [ ] CHK011 Are “**missing placeholder values**” defined precisely (missing key vs empty string vs null) so the failure condition is testable? [Ambiguity, Spec §FR-008]
- [ ] CHK012 Does the spec define what constitutes a “**clear render error**” (minimum fields: error message, which placeholder(s) missing, where it appears in admin views)? [Clarity, Spec §FR-009, Spec §Clarifications]
- [ ] CHK013 Is the rule “store **full rendered content exactly as sent**” explicit about SMS vs Email fields (subject/body/text alternative) and whether encoding/normalization is allowed? [Ambiguity, Spec §FR-014]
- [ ] CHK014 Is the worker’s definition of “**batch**” and “process in batches” clarified (batch size, interval) or explicitly deferred as a configurable setting? [Gap, Plan §Claiming rows safely]
- [ ] CHK015 Is the **retry schedule** described in a way that’s independently verifiable (what makes an attempt eligible, how `nextAttemptAt` is computed, and how jitter is bounded)? [Gap, Spec §FR-024]

## Requirement Consistency

- [ ] CHK016 Do the resend requirements consistently state that resend is **per selected delivery/channel** and never implies “resend both”? [Consistency, Spec §FR-020, Spec §Clarifications, Spec §User Story 3]
- [ ] CHK017 Are resend semantics consistent between SMS and Email (both create a new linked delivery), while still keeping channel-specific rules (SMS reuse original rendered text; Email reuse original content + attachments)? [Consistency, Spec §FR-019–FR-021a]
- [ ] CHK018 Do success criteria and functional requirements align on timing (e.g., “visible within 1 minute”) without contradicting “not blocked” workflow requirements? [Consistency, Spec §SC-001, Spec §SC-004, Spec §FR-010]
- [ ] CHK019 Are delivery status terms used consistently across spec (e.g., “sent”, “delivered”, “failed”, “attempted send”), or is there a glossary mapping to avoid mixed meanings? [Ambiguity, Spec §Key Concepts, Spec §FR-023]
- [ ] CHK020 Are “delivery lifecycle events” consistent with “delivery status” expectations (i.e., does spec clarify whether provider delivery/bounce updates replace or extend the internal status)? [Gap, Spec §FR-023, Spec §User Story 4]

## Acceptance Criteria Quality (Measurability)

- [ ] CHK021 Are the acceptance scenarios for language fallback measurable and include evidence fields (requested vs used language captured)? [Measurability, Spec §User Story 2]
- [ ] CHK022 Is there an acceptance scenario that makes the “**missing placeholder** → fail + Sentry + admin visibility” requirement objectively checkable without implementation assumptions? [Measurability, Spec §FR-009, Spec §Clarifications]
- [ ] CHK023 Are retry defaults (SMS=2, Email=5) traceable to system settings and acceptance criteria (i.e., not just stated, but testable)? [Measurability, Spec §FR-024]
- [ ] CHK024 Are the retention defaults (history 7 years, attachments 90 days) expressed in a way that is measurable and unambiguous about start time (createdAt vs sentAt vs deliveredAt)? [Ambiguity, Spec §FR-018, Spec §Clarifications]

## Scenario Coverage

- [ ] CHK025 Do requirements cover a **template missing after fallback** case with explicit failure reason and visibility in history? [Coverage, Spec §FR-006, Spec §User Story 2]
- [ ] CHK026 Do requirements cover the alternate flow where a route enables a channel but the customer lacks the recipient detail (phone/email) and clarify whether to create-and-fail vs skip? [Coverage, Spec §FR-026, Spec §Edge Cases]
- [ ] CHK027 Do requirements cover resend for both channels, including “resend SMS but not Email” for the same event? [Coverage, Spec §User Story 3, Spec §FR-020]
- [ ] CHK028 Do requirements cover how the system behaves when provider status events arrive **before** the internal delivery record has a provider message ID (e.g., delayed mapping)? [Gap, Spec §FR-023]

## Edge Case Coverage

- [ ] CHK029 Are edge cases for duplicate webhook notifications tied to an explicit idempotency rule and a dedupe key strategy requirement (provider event IDs when available)? [Coverage, Spec §Edge Cases, Spec §FR-023]
- [ ] CHK030 Are edge cases for transient provider failures linked to retry policy rules, including when to stop retrying (max attempts) and what “poison” means in requirements terms? [Gap, Spec §FR-024]
- [ ] CHK031 Are edge cases for placeholder data being present but malformed (e.g., wrong format) defined (fail vs sanitize), or explicitly out of scope? [Gap, Spec §FR-007–FR-008]

## Non-Functional Requirements (as written)

- [ ] CHK032 Are there explicit requirements for worker concurrency safety (no double processing) stated in requirements language (not only in plan language)? [Gap, Spec §FR-010]
- [ ] CHK033 Are rate limiting requirements quantified (even if approximate) or explicitly defined as “basic per-IP + global cap” with the expectation that thresholds are configurable settings? [Clarity, Spec §FR-023a, Spec §Clarifications]
- [ ] CHK034 Are observability requirements specific about what is captured (Sentry event fields, correlation IDs, error reasons) vs generic “tracked in Sentry”? [Clarity, Spec §FR-009]

## Dependencies & Assumptions

- [ ] CHK035 Are assumptions about customer contact availability (phone/email optionality) consistent across all scenarios and requirements? [Consistency, Spec §Edge Cases, Spec §FR-026]
- [ ] CHK036 Are external dependency behaviors that affect requirements (provider webhooks can duplicate, can arrive late, may omit IDs) explicitly acknowledged in requirements? [Dependency, Spec §FR-023]

## Ambiguities & Conflicts (spot checks)

- [ ] CHK037 Is the delivery terminology unambiguous: does “SENT” mean “provider accepted” and not “delivered to handset/inbox,” and is that distinction documented for stakeholders? [Ambiguity, Spec §Key Concepts, Spec §FR-023]
- [ ] CHK038 Are there any “must be fast/robust/scalable” phrases left in the spec without quantification or explicit deferral to system settings? [Ambiguity, Spec §SC-001–SC-005]

## Notes

- Audience: **Spec author (self-check)**  
- Depth: **Standard (~30–35 items)**  
- Focus: **Templates/language/placeholder rendering** + **Worker/outbox/retry lifecycle**  
