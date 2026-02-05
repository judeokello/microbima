# Feature Specification: Member Numbers and Printable Member Cards for Customers

**Feature Branch**: `001-member-cards`  
**Created**: 2025-02-05  
**Status**: Draft  
**Input**: User description: "Feature: Member numbers and printable member cards for customers. Customer care staff and agents need to see and use member identification for each person on a policy (the principal and any dependants)..."

## Clarifications

### Session 2025-02-05

- Q: When a principal or dependant does not yet have a member number assigned, what should the system do? → A: Both: Show the member number field/card with a clear placeholder (e.g. "Not assigned"); in Member cards tab, disable download for that card only until assigned.
- Q: When a package has no card template configured, what should the system do? → A: Use a single default card layout for both the package template preview and for Member cards in the tab (no template = show default layout).
- Q: When staff open the Member cards tab for a customer who has no policies (or no active policy with member data), what should the system do? → A: Show the Member cards tab; when selected, display an empty-state message (e.g. "No member cards available" or "No policies with member data").
- Q: Should viewing and downloading member cards use the same access rules as the customer detail page, or a separate permission? → A: Same as customer detail page: no separate permission; whoever can view the customer can view and download member cards.
- Q: Should date of birth and date printed on the card use a single canonical format or be locale-dependent? → A: Single canonical format DD/MM/YYYY for all users; same format for date of birth and date printed on the card.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View member numbers on customer detail screen (Priority: P1)

Customer care staff or agents open the customer detail page for a customer who has a policy with a principal member and optionally dependants (e.g. spouse, children). The existing cards that display the principal member's information and each dependant's information also show the **member number** for that person. Staff can see at a glance which member number belongs to the principal and to each dependant without leaving the page or opening another system.

**Why this priority**: Staff need to verify and communicate member identification daily; showing member numbers on the same screen where they view customer and family details removes friction and avoids errors from switching systems.

**Independent Test**: Can be fully tested by opening a customer detail page for a customer with at least one policy and dependants, and verifying that the principal card and each dependant card display the correct member number.

**Acceptance Scenarios**:

1. **Given** a customer with at least one active policy and a principal member number assigned, **When** staff open the customer detail page and view the principal (customer) information card, **Then** the member number for the principal is visible on that card.
2. **Given** a customer with dependants who have member numbers assigned, **When** staff view the dependant cards (e.g. Spouse, Children), **Then** each dependant card displays that dependant's member number.
3. **Given** staff use either the admin customer page or the non-admin (e.g. dashboard) customer page, **When** they view customer details, **Then** member numbers are shown consistently on both.

---

### User Story 2 - View and download membership/medical cards per policy (Priority: P2)

Staff open the customer detail page and select a new tab called "Member cards". The tab shows one set of membership/medical cards per policy. For each policy, one card is shown for the principal member and one for each dependant. Each card displays: scheme name, principal member name, insured member name (the person the card is for), member number, date of birth, and date printed (date the member record was created). Each card has a download action that allows the user to save the card as a PNG image for printing or sharing. Cards are generated on demand from current data and are not stored as files on the server.

**Why this priority**: Enables staff to provide members with a proper, printable card for use at healthcare providers or for their records, directly from the customer detail screen.

**Independent Test**: Can be fully tested by opening the Member cards tab for a customer with at least one policy, verifying cards are grouped by policy and that each card shows the required fields and that download produces a valid PNG image.

**Acceptance Scenarios**:

1. **Given** a customer with one or more policies, **When** staff open the "Member cards" tab, **Then** they see one group of cards per policy, clearly grouped (e.g. by policy or scheme name).
2. **Given** a policy with a principal and dependants, **When** staff view that policy's group in the Member cards tab, **Then** they see one card for the principal and one card per dependant.
3. **Given** any displayed card, **When** staff use the download action, **Then** the card is saved as a PNG image file suitable for printing or sharing.
4. **Given** a card is displayed, **When** staff view it, **Then** it shows scheme name, principal member name, insured member name, member number, date of birth, and date printed (date only).
5. **Given** the principal's card, **When** staff view it, **Then** insured member name is the same as principal member name; for a dependant's card, insured member name is that dependant's name.

---

### User Story 3 - Preview card template on package management screen (Priority: P3)

Staff responsible for viewing or managing packages open the screen where packages are viewed or managed. For each package (or when viewing a single package), they can see a **preview** of that package's membership card template. The preview is filled with sample data (e.g. sample names like "Jane Doe", "John Doe", sample member number and dates) so staff can confirm how the card will look without viewing a real customer. The identifier that links the package to a specific card design is not shown or editable in the package form; it is for system use only.

**Why this priority**: Allows configuration and quality assurance of card appearance per product/package without accessing real customer data.

**Independent Test**: Can be fully tested by opening the package view/management screen and verifying that a card preview with sample data is visible for the package and that the template identifier is not exposed in the package create/edit form.

**Acceptance Scenarios**:

1. **Given** staff are on the screen where packages are viewed or managed, **When** they view a package that has a card template associated, **Then** they see a preview of the card filled with sample data (e.g. Jane Doe, John Doe, sample member number and dates).
2. **Given** staff create or edit a package, **When** they use the package form, **Then** the field that identifies which card template to use is not visible or editable.
3. **Given** a package has no card template configured, **When** staff view the package, **Then** the preview shows the default card layout with sample data.

---

### Edge Cases

- What happens when a customer has no policy or no member numbers assigned yet? (Customer Details: show customer/dependant cards as today; member number field shows a clear placeholder, e.g. "Not assigned", until assigned. Member cards tab: when the customer has no policies or no policies with member data, show the tab and display an empty-state message when selected, e.g. "No member cards available" or "No policies with member data".)
- What happens when a customer has multiple policies? (Member cards tab shows one group per policy; each group shows principal and dependants for that policy context; scheme name and card design follow the policy's package.)
- What happens when a principal or dependant has no member number? (Customer Details: show the member number field with a clear placeholder, e.g. "Not assigned". Member cards tab: show that person's card with the same placeholder; download for that card is disabled until a member number is assigned.)
- How does the system handle a package with no card template configured? (Use a single default card layout for both the package template preview and for Member cards in the tab; no template means show the default layout.)
- What if scheme name cannot be resolved for a policy (e.g. no PackageSchemeCustomer)? (The card displays a fallback value such as empty string or "—"; implementation follows data-model resolution; no separate requirement.)
- How are loading and error states shown for the Member cards tab? (Follow the same patterns as the rest of the customer detail page, e.g. spinner while fetching member-cards data, error message on failure.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST display the principal member's member number on the customer detail page within the existing principal (customer) information card.
- **FR-002**: The system MUST display each dependant's member number on the customer detail page within the corresponding dependant card (e.g. Spouse, Children).
- **FR-003**: The system MUST provide a "Member cards" tab on the customer detail page (alongside Customer Details and Payments), available to both admin and non-admin users who can access the customer detail page. Access to view and download member cards MUST be the same as access to the customer detail page (no separate permission). When the customer has no policies or no policies with member data, the tab MUST be shown and selecting it MUST display an empty-state message (e.g. "No member cards available" or "No policies with member data").
- **FR-004**: The Member cards tab MUST show one set of membership/medical cards per policy; when a customer has multiple policies, cards MUST be grouped by policy and clearly separated.
- **FR-005**: For each policy, the system MUST display one card for the principal member and one card for each dependant on that policy.
- **FR-006**: Each card MUST be generated on demand from current member data and the card design for that product/package; cards MUST NOT be stored as files on the server.
- **FR-007**: Each card MUST display: scheme name, principal member name, insured member name, member number, date of birth, and date printed (the date the member record was created, date only). Date of birth and date printed on the card MUST be formatted in a single canonical format for all users: DD/MM/YYYY.
- **FR-008**: The system MUST provide a download action per card that allows the user to save the card as a PNG image for printing or sharing; the download action MUST be disabled for a card when that member has no member number assigned (placeholder shown instead).
- **FR-009**: The system MUST support different card layouts/branding per package; the choice of card design MUST be determined by a template associated with the package. When no template is configured for a package, the system MUST use a single default card layout for both the package template preview and for Member cards in the tab.
- **FR-010**: The identifier that selects the card template for a package MUST NOT be visible or editable in the package create/edit form in the UI.
- **FR-011**: On the screen where staff view or manage packages, the system MUST show a preview of that package's card template filled with sample data (e.g. sample names, member number, and dates).
- **FR-012**: Member numbers displayed or used on cards MUST be system-generated and MUST NOT be editable from the customer detail or Member cards screen.

### Key Entities

- **Principal member (customer)**: The policy holder; has a member number; name and date of birth appear on their own card and as "principal member name" on all cards for that policy.
- **Dependant**: A family member (e.g. spouse, child) linked to the customer; has a member number; has name and date of birth; appears as "insured member" on their own card.
- **Policy**: Links a customer to a product/package; has an associated scheme name; determines which card template and scheme name are used for that group of cards.
- **Package**: Product offering; has an associated card template (identifier not exposed in UI); used to determine card layout and to show template preview with sample data.
- **Membership/medical card**: A visual card generated on demand showing scheme name, principal and insured names, member number, DOB, and date printed; one per principal and per dependant per policy; downloadable as PNG.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Staff can see the principal and each dependant's member number on the customer detail page without leaving the page or opening another system.
- **SC-002**: Staff can open the Member cards tab and obtain a downloadable PNG for each member (principal and dependants) per policy within the same session.
- **SC-003**: Staff can confirm how a package's card will look by viewing the template preview with sample data on the package view/management screen.
- **SC-004**: Support and verification tasks related to member identification and card provision can be completed from the customer detail screen without relying on other systems.

## Scope Boundaries

**In scope**:

- Customer detail page for both admin and non-admin (e.g. dashboard) users.
- Display of member numbers on existing principal and dependant information cards.
- New "Member cards" tab with one card per principal and per dependant per policy, grouped by policy.
- Download of each card as PNG; cards generated on demand, not stored.
- Card template per package; template preview with sample data on package view/management screen.
- Template identifier: not in package form (see FR-010).

**Out of scope**:

- Storing card images on the server.
- Editing member numbers from the customer detail or Member cards screen (they remain system-generated).
- Exposing the template identifier field in the package create/edit form.

## Assumptions

- Access to view and download member cards is the same as access to the customer detail page; no separate permission is required.
- Member numbers are already assigned by the system when a policy is active; the feature only displays and uses them.
- "Date printed" is the date the member record (principal or dependant) was created; only the date component is shown. Dates on the card (date of birth, date printed) use the canonical format DD/MM/YYYY.
- Scheme name shown on a card is the scheme associated with the policy's package for that customer.
- Card templates are defined and associated with packages outside the scope of this feature (e.g. configuration or deployment); this feature consumes the association to render and preview cards.
