# Quick Start Guide: Member Numbers and Printable Member Cards

**Feature**: 001-member-cards  
**Date**: 2025-02-05

## Overview

This guide gives a quick path to implement member numbers on the customer detail page and the Member cards tab with on-demand PNG download. See [spec.md](./spec.md), [data-model.md](./data-model.md), and [contracts/member-cards-api.yaml](./contracts/member-cards-api.yaml) for full detail.

## Prerequisites

- Node.js >= 18, pnpm >= 8, PostgreSQL
- Existing customer details and policy/member data (PolicyMemberPrincipal, PolicyMemberDependant)
- Access to internal API (auth same as customer detail page)

## Implementation Order

### 1. Backend – Schema

```bash
cd apps/api
# In prisma/schema.prisma, add to Package model:
#   cardTemplateName String? @db.VarChar(100)
npx prisma migrate dev --name add_package_card_template_name
npx prisma generate
```

### 2. Backend – Customer details extension

- **DTOs** (`apps/api/src/dto/customers/`): Add `memberNumber` and `memberNumberCreatedAt` (optional) to the principal and dependant shapes used in customer detail response (see [data-model.md](./data-model.md)).
- **Service** (`customer.service.ts`): In `getCustomerDetails`, load `policyMemberPrincipals` for the customer and `policyMemberDependants` for the customer’s dependants; map one principal member number (and createdAt) and per-dependant member number (and createdAt) into the response. Handle “no record” as null.
- **API contract**: Response shape matches extended description in [contracts/member-cards-api.yaml](./contracts/member-cards-api.yaml) for GET details.

### 3. Backend – Member cards endpoint

- **DTOs**: Add `MemberCardDataDto`, `MemberCardsByPolicyItemDto`, `MemberCardsResponseDto` (see data-model and OpenAPI).
- **Service**: New method e.g. `getMemberCards(customerId, userId, userRoles, correlationId)`:
  - Reuse same access check as `getCustomerDetails` (404 if no access).
  - Load customer’s policies with package (and package.cardTemplateName), and for each policy resolve scheme name via PackageSchemeCustomer (customerId + packageId) → PackageScheme → Scheme.schemeName.
  - For each policy: build principal MemberCardData (customer name, DOB, member number, datePrinted from PolicyMemberPrincipal); build dependants MemberCardData list from PolicyMemberDependant + Dependant. Format dates as DD/MM/YYYY.
  - Return `{ memberCardsByPolicy: [...] }`. If no policies or no member data, return empty array.
- **Controller**: New `GET :customerId/member-cards` on internal customer controller, returning the response DTO.

### 4. Frontend – Types and components

- **Types** (`apps/agent-registration/src/types/member-card.ts`): Define `MemberCardData` (and any related types) matching API.
- **Registry** (`apps/agent-registration/src/components/member-cards/card-template-registry.tsx`): Map template name string → React component (e.g. `WellnessCardTemplate`, `DefaultCardTemplate`). Export `CARD_TEMPLATE_REGISTRY` and resolve with fallback to default when key is null or missing.
- **Templates** (`apps/agent-registration/src/components/member-cards/templates/`): At least `DefaultCardTemplate.tsx`; add e.g. `WellnessCardTemplate.tsx` matching sample card layout. Props: `data: MemberCardData`, optional `className`. Use DD/MM/YYYY for dates.
- **Sample data** (`apps/agent-registration/src/components/member-cards/sample-card-data.ts`): Constant object: schemeName `"MFANISI"`, principalMemberName `"Jane Doe"`, insuredMemberName `"John Doe"`, memberNumber `"MFG023-00"`, dateOfBirth `"07/05/1983"`, datePrinted `"11/12/2025"` for package preview.

### 5. Frontend – Customer details tab (member numbers)

- **API** (`lib/api.ts`): Extend `CustomerDetailData` (and any nested types) with `memberNumber` and `memberNumberCreatedAt` for customer and each dependant.
- **Sections**: In `CustomerInfoSection`, `SpouseSection`, `ChildrenSection`, display member number; when null/undefined show placeholder `"Not assigned"`.

### 6. Frontend – Member cards tab

- **API**: Add `getMemberCards(customerId)` calling `GET /internal/customers/:customerId/member-cards`, returning `{ memberCardsByPolicy }`.
- **Tab**: On admin, non-admin, and dashboard customer pages add a third tab “Member cards”. When selected, if `memberCardsByPolicy` is empty show empty-state message (e.g. “No member cards available”); otherwise for each policy render a section and for principal + each dependant render the card via registry (template from `cardTemplateName` or default), pass `MemberCardData`. When `memberNumber` is null, show placeholder and disable download.
- **Download**: Use a wrapper (e.g. `MemberCardWithDownload`) that renders the card in a ref’d container and a button that calls `toPng(containerRef.current, …)` (e.g. from `html-to-image`) and triggers file download (PNG). Disable button when `memberNumber` is null.

### 7. Frontend – Package preview

- On package detail page (`admin/underwriters/packages/[packageId]`), add “Card template preview” section: resolve template from `package.cardTemplateName` or default, render with sample data from `sample-card-data.ts`. Do not add any form field for `cardTemplateName`.

## Key Files (reference)

| Area | File(s) |
|------|--------|
| Schema | `apps/api/prisma/schema.prisma` (Package) |
| Customer details | `apps/api/src/services/customer.service.ts`, DTOs in `dto/customers/` |
| Member cards API | `apps/api/src/controllers/internal/customer.controller.ts`, `customer.service.ts` |
| Contracts | `specs/001-member-cards/contracts/member-cards-api.yaml` |
| Frontend types | `apps/agent-registration/src/types/member-card.ts` |
| Registry + templates | `apps/agent-registration/src/components/member-cards/` |
| Customer pages | `admin/customer/[customerId]/page.tsx`, `customer/[customerId]/page.tsx`, `dashboard/customer/[customerId]/page.tsx` |
| Package preview | `admin/underwriters/packages/[packageId]/page.tsx` |

## Testing

- **Backend**: Jest; unit tests for getMemberCards (scheme resolution, date formatting, empty policies). Reuse existing customer-details access tests for member-cards endpoint.
- **Frontend**: Existing frontend testing approach; manually verify Member cards tab, placeholder when no member number, disabled download, and PNG download when member number present.

## Dependencies

- **html-to-image** (or equivalent): add to `apps/agent-registration` for `toPng`. Use only in browser (e.g. dynamic import or guard for `window`).
