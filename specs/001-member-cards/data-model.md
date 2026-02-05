# Data Model: Member Numbers and Printable Member Cards

**Feature**: 001-member-cards  
**Date**: 2025-02-05  
**Status**: Design Complete

## Overview

This feature extends the existing data model to support:
1. **Package card template** - Optional template name per package for membership card layout
2. **Member card payload (DTO)** - Structure used by API and frontend for rendering and download (no new stored entity)
3. **Extended customer details** - Principal and dependant member numbers and creation dates in existing customer-details response

Existing entities used: `Customer`, `Dependant`, `Policy`, `Package`, `PackageScheme`, `PackageSchemeCustomer`, `Scheme`, `PolicyMemberPrincipal`, `PolicyMemberDependant`.

---

## Schema Change (Prisma)

### Package (existing model) – add field

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `cardTemplateName` | `String? @db.VarChar(100)` | Nullable | Template name used by frontend registry to select card layout. Not exposed in package create/update DTOs. When null, frontend uses default layout. |

**Migration**: `npx prisma migrate dev --name add_package_card_template_name`

**Location**: `apps/api/prisma/schema.prisma` – add to existing `Package` model.

---

## DTOs / Response Shapes (no new tables)

### MemberCardData

Used in API response and frontend for each card (principal or dependant). All dates formatted as DD/MM/YYYY.

| Field | Type | Description |
|-------|------|-------------|
| `schemeName` | string | Scheme name from Scheme.schemeName (via policy’s package and customer’s PackageSchemeCustomer). |
| `principalMemberName` | string | Full name of the principal (policy holder). |
| `insuredMemberName` | string | Full name of the person this card is for (principal or dependant). |
| `memberNumber` | string \| null | Member number from PolicyMemberPrincipal or PolicyMemberDependant; null if not yet assigned (show placeholder, disable download). |
| `dateOfBirth` | string | DD/MM/YYYY. |
| `datePrinted` | string | DD/MM/YYYY from PolicyMemberPrincipal.createdAt or PolicyMemberDependant.createdAt (date part only). |

### MemberCardsByPolicyItem

One per policy in `memberCardsByPolicy` array.

| Field | Type | Description |
|-------|------|-------------|
| `policyId` | string | Policy UUID. |
| `policyNumber` | string \| null | Policy number if present. |
| `packageId` | number | Package id. |
| `packageName` | string | Package name. |
| `cardTemplateName` | string \| null | Package’s card template name; null → use default. |
| `schemeName` | string | Resolved scheme name for this policy. |
| `principal` | MemberCardData | Card data for principal. |
| `dependants` | MemberCardData[] | Card data for each dependant on this policy. |

### Extended Customer Details (add to existing response)

**Customer** (principal) – add:

| Field | Type | Description |
|-------|------|-------------|
| `memberNumber` | string \| null | From PolicyMemberPrincipal for this customer; null if none. |
| `memberNumberCreatedAt` | string \| null | ISO 8601 datetime of PolicyMemberPrincipal.createdAt; optional for “date printed”. |

**Dependants** (each item) – add:

| Field | Type | Description |
|-------|------|-------------|
| `memberNumber` | string \| null | From PolicyMemberDependant for this dependant; null if none. |
| `memberNumberCreatedAt` | string \| null | ISO 8601 datetime of PolicyMemberDependant.createdAt; optional. |

---

## Entity Relationships (existing)

- **Policy** → Customer (customerId), Package (packageId).
- **PolicyMemberPrincipal** → Customer (customerId); one row per customer with member number.
- **PolicyMemberDependant** → Dependant (dependantId); one row per dependant with member number.
- **PackageSchemeCustomer** → Customer (customerId), PackageScheme (packageSchemeId). PackageScheme → Package (packageId), Scheme (schemeId).

**Scheme resolution for a policy**: For `policy.customerId` and `policy.packageId`, find `PackageSchemeCustomer` where `customerId` = policy.customerId and `packageScheme.packageId` = policy.packageId; then `packageScheme.scheme.schemeName`.

---

## Validation Rules

- `cardTemplateName`: max length 100; no format constraint (opaque string for frontend registry).
- Member card dates: API returns DD/MM/YYYY for dateOfBirth and datePrinted; backend formats from UTC stored dates using DD/MM/YYYY.
- When a principal or dependant has no PolicyMemberPrincipal/PolicyMemberDependant row, `memberNumber` and `datePrinted` are null; frontend shows placeholder “Not assigned” and disables download for that card.

---

## State / Lifecycle

- Member numbers are created by existing policy activation flow (PolicyMemberPrincipal and PolicyMemberDependant). This feature only reads and displays them.
- No new state transitions or lifecycle for card template; it is configuration on Package.
