# Research: Member Numbers and Printable Member Cards

**Feature**: 001-member-cards  
**Date**: 2025-02-05  
**Status**: Complete

## Scope

All technical decisions were provided in the plan command input. This document consolidates those decisions and records rationale where useful for implementation.

---

## 1. Member-cards API shape

**Decision**: New endpoint `GET /internal/customers/:customerId/member-cards` returning `{ memberCardsByPolicy: [...] }`.

**Rationale**: Keeps customer details payload focused; member-cards data is only needed when the user opens the Member cards tab. Clear separation of concerns and smaller default payload for customer detail page.

**Alternatives considered**: Extending GET customer details with `?include=memberCards` was considered; dedicated endpoint chosen for clarity and to avoid conditional expansion in a single response.

---

## 2. Client-side PNG download

**Decision**: Use a browser library (e.g. html-to-image `toPng`) to capture the card DOM node and trigger download; no server-side image generation or storage.

**Rationale**: Spec requires cards generated on demand and not stored; client already has all data and the rendered card. Avoids server image generation dependencies and storage; keeps backend stateless for cards.

**Alternatives considered**: Server-side PDF/PNG generation (rejected: storage and scaling); storing generated images (rejected: out of scope).

---

## 3. Card template selection (package)

**Decision**: Add nullable `packages.card_template_name` (e.g. VarChar 100). Frontend registry maps template name string to React component. When null or unknown, use a single default card layout.

**Rationale**: One template per package aligns with “card template per package”; string name allows new templates to be added without DB enum changes. Default layout ensures every package can show a card (preview and Member cards tab).

**Alternatives considered**: Template keyed by underwriter (rejected in favour of package); enum of template IDs (rejected: less flexible for adding templates).

---

## 4. Scheme name resolution

**Decision**: For a policy, resolve scheme name via: `policy.customerId` + `policy.packageId` → find `PackageSchemeCustomer` for that customer and package → `PackageScheme` → `Scheme.schemeName`.

**Rationale**: Matches existing data model: customer is linked to a package scheme; policy links customer to package; scheme is attached to that package scheme enrollment.

---

## 5. Frontend structure

**Decision**: `src/types/member-card.ts` for MemberCardData and related types; `src/components/member-cards/` for registry and template components (e.g. `card-template-registry.tsx`, `templates/DefaultCardTemplate.tsx`, `templates/WellnessCardTemplate.tsx`).

**Rationale**: Central types for card data; components colocated for discoverability and reuse (customer tab and package preview).

---

## 6. Sample data for package preview

**Decision**: Use fixed sample data: schemeName `"MFANISI"`, principalMemberName `"Jane Doe"`, insuredMemberName `"John Doe"`, memberNumber `"MFG023-00"`, dateOfBirth `"07/05/1983"`, datePrinted `"11/12/2025"`.

**Rationale**: Consistent preview across packages; no real customer data; format matches DD/MM/YYYY and existing sample card imagery.

---

## 7. Access control

**Decision**: No separate permission for viewing or downloading member cards; same access as customer detail page (whoever can view the customer can view and download cards).

**Rationale**: Spec and clarification: “same as customer detail page”. Reduces permission model complexity and matches user expectation.

---

## 8. Date format on cards

**Decision**: Single canonical format DD/MM/YYYY for date of birth and date printed on all cards.

**Rationale**: Spec clarification; avoids locale-driven ambiguity and keeps printed cards consistent.

---

## External Dependencies

- **html-to-image** (or equivalent): for `toPng` in the browser. Confirm compatibility with Next.js and existing bundler (e.g. no SSR of the card capture call).
- No new backend or external service dependencies for card generation.
