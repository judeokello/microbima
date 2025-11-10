# Product Requirements Document: Scheme Management & Payment Enhancements

**Document Version:** 1.0  
**Date:** November 10, 2025  
**Status:** Implemented  
**Project:** MicroBima Insurance Platform

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Background & Context](#background--context)
3. [Feature Overview](#feature-overview)
4. [Detailed Requirements](#detailed-requirements)
5. [Technical Implementation](#technical-implementation)
6. [Database Schema Changes](#database-schema-changes)
7. [API Endpoints](#api-endpoints)
8. [User Interface Changes](#user-interface-changes)
9. [Business Logic](#business-logic)
10. [Validation Rules](#validation-rules)
11. [Error Handling](#error-handling)
12. [Future Considerations](#future-considerations)

---

## Executive Summary

This document outlines the comprehensive enhancements to the MicroBima platform's scheme management, payment processing, and policy allocation systems. The primary objectives are to:

1. Enable postpaid insurance schemes with flexible payment frequencies
2. Implement unique payment account number generation for policies and schemes
3. Add scheme contact management capabilities
4. Enhance policy activation workflows for both prepaid and postpaid scenarios
5. Improve payment matching and reconciliation processes
6. Add mandatory scheme assignment during customer registration

These enhancements support MicroBima's expansion into corporate and group insurance markets where postpaid billing is required.

---

## Background & Context

### Business Need
MicroBima traditionally operates on a prepaid model where customers pay upfront for insurance coverage. However, to expand into corporate and group insurance markets, the platform needs to support postpaid billing where:

- Organizations are billed monthly/quarterly for employee coverage
- Payment is collected after service delivery
- Flexible payment cadences are required (e.g., every 10 days, bi-weekly, etc.)

### User Personas
1. **Insurance Administrators**: Configure schemes with postpaid settings
2. **Brand Ambassadors**: Register customers under prepaid or postpaid schemes
3. **Finance Teams**: Process and reconcile payments against policies and schemes
4. **System Administrators**: Manage scheme contacts and payment account numbers

---

## Feature Overview

### 1. Postpaid Scheme Management
Enable insurance schemes to be configured as postpaid with customizable payment frequencies and cadences.

**Key Capabilities:**
- Toggle schemes between prepaid and postpaid modes
- Define payment frequency (Daily, Weekly, Monthly, Quarterly, Yearly, Custom)
- Set custom payment cadence (e.g., every 10 days)
- Automatically generate unique payment account numbers for postpaid schemes

### 2. Payment Account Number Generation
Implement a sophisticated unique ID generation system for tracking payments at policy and scheme levels.

**Key Capabilities:**
- Generate unique numeric IDs excluding digits 0 and 1 (avoid confusion with letters O, I, L)
- Start with 3-digit numbers (222), expand to 4, 5 digits as needed
- Prefix scheme account numbers with 'G' (e.g., G222)
- Ensure uniqueness across both policies and schemes tables
- Use first policy: customer's ID number; subsequent policies: generated unique number

### 3. Scheme Contact Management
Allow administrators to maintain up to 5 contact persons per scheme for coordination and support.

**Key Capabilities:**
- Add, edit, delete scheme contacts
- Store contact details (name, phone, email, designation, notes)
- Enforce maximum of 5 contacts per scheme
- Track who created each contact and when

### 4. Enhanced Policy Allocation
Differentiate policy creation and activation workflows based on scheme payment type.

**Key Capabilities:**
- **Prepaid Policies**: Immediately active, policy number generated, start/end dates set
- **Postpaid Policies**: Pending activation status, no policy number initially, null dates
- Policy activation function that generates member numbers and updates status
- Support for manual and automated policy activation

### 5. Payment Frequency Selection
Allow agents to select payment frequencies during customer registration based on scheme type.

**Key Capabilities:**
- **Prepaid customers**: Active frequency dropdown with custom option
- **Postpaid customers**: Disabled dropdown showing scheme's fixed frequency
- Validation for custom cadence input (max 999 days, numbers only)

### 6. Mandatory Scheme Assignment
Ensure every customer is assigned to a package and scheme during registration.

**Key Capabilities:**
- Cascading dropdowns (Package → Scheme) on customer registration page
- Persist last selected package/scheme in localStorage for convenience
- Validate both selections before allowing registration
- Clear error messages for invalid or empty selections

---

## Detailed Requirements

### FR-1: Postpaid Scheme Configuration

**User Story:**  
As an Insurance Administrator, I want to configure schemes as postpaid with flexible payment frequencies so that I can support corporate billing models.

**Acceptance Criteria:**
- [ ] Scheme creation dialog includes "Postpaid" checkbox
- [ ] When postpaid is selected:
  - [ ] Payment frequency dropdown appears (Daily, Weekly, Monthly, Quarterly, Yearly, Custom)
  - [ ] Each frequency shows days in brackets (e.g., "Weekly (7 days)")
  - [ ] Custom option shows cadence text box (max 3 digits, numbers only)
- [ ] When postpaid is selected and saved:
  - [ ] `schemes.isPostpaid` set to `true`
  - [ ] `schemes.frequency` set to selected frequency
  - [ ] `schemes.paymentCadence` set to cadence value (or calculated from frequency)
  - [ ] `schemes.paymentAcNumber` generated with 'G' prefix
- [ ] Validation ensures frequency is required when postpaid is true
- [ ] Validation ensures cadence is required and valid (1-999) when Custom frequency selected

**Business Rules:**
- Postpaid schemes must have a payment frequency defined
- Custom payment cadence cannot exceed 999 days
- Payment account numbers for schemes are prefixed with 'G'
- Postpaid setting cannot be changed after customers are enrolled (future feature)

---

### FR-2: Payment Account Number Generation

**User Story:**  
As the System, I want to generate unique payment account numbers that are unambiguous and trackable so that payments can be correctly matched to policies and schemes.

**Acceptance Criteria:**
- [ ] Generator starts at 222 (first valid 3-digit number without 0 or 1)
- [ ] Generator skips any number containing digit 0 or 1
- [ ] Generator expands to 4 digits after exhausting 3-digit numbers (after 999)
- [ ] Generator uses database sequence table for atomicity
- [ ] Policies table:
  - [ ] First policy for customer: use `customers.IDnumber`
  - [ ] Subsequent policies: use generated unique number
  - [ ] Postpaid policies: `NULL` payment account number
- [ ] Schemes table:
  - [ ] Postpaid schemes: generate unique number prefixed with 'G'
  - [ ] Non-postpaid schemes: `NULL` payment account number
- [ ] Generated numbers are unique across both policies and schemes tables (excluding 'G' prefix)
- [ ] Database constraint enforces uniqueness on `paymentAcNumber` fields

**Business Rules:**
- Digits 0 and 1 are excluded to avoid confusion with letters O, I, L
- Payment account numbers are immutable once assigned
- Scheme payment account numbers always have 'G' prefix
- Policy payment account numbers never have prefix
- Customer ID number is used for first policy only if scheme is not postpaid

**Technical Approach:**
- Dedicated `payment_account_number_sequences` table with single row
- Transactional increment using `$transaction` in Prisma
- Skip invalid numbers using modulo and digit-checking algorithm
- Automatic digit expansion when current digit limit exhausted

---

### FR-3: Scheme Contact Management

**User Story:**  
As an Insurance Administrator, I want to maintain a list of contact persons for each scheme so that I have easy access to coordinators and stakeholders.

**Acceptance Criteria:**
- [ ] Scheme details page displays "Scheme Contacts" section below customers grid
- [ ] Section shows table with columns: Name, Phone, Email, Designation, Actions
- [ ] "Add Contact" button opens dialog for new contact
- [ ] Add Contact button is disabled when 5 contacts exist
- [ ] Contact dialog includes fields:
  - [ ] First Name (required, max 50 chars)
  - [ ] Other Name (optional, max 50 chars)
  - [ ] Phone Number (optional, max 15 chars)
  - [ ] Phone Number 2 (optional, max 15 chars)
  - [ ] Email (optional, max 100 chars, valid email format)
  - [ ] Designation (optional, max 10 chars)
  - [ ] Notes (optional, max 500 chars)
- [ ] Each contact row has Edit and Delete buttons
- [ ] Delete button requires confirmation
- [ ] Delete action removes contact from database permanently
- [ ] Created contacts track `createdBy` (user ID) and `createdAt` timestamp
- [ ] Updated contacts track `updatedAt` timestamp

**Business Rules:**
- Maximum 5 contacts per scheme
- First name is mandatory for all contacts
- Contacts cannot be created for inactive schemes (future feature)
- Contact deletion is permanent (no soft delete)

**API Endpoints:**
- `POST /internal/product-management/schemes/:schemeId/contacts` - Create contact
- `GET /internal/product-management/schemes/:schemeId/contacts` - List contacts
- `PUT /internal/product-management/schemes/:schemeId/contacts/:contactId` - Update contact
- `DELETE /internal/product-management/schemes/:schemeId/contacts/:contactId` - Delete contact

---

### FR-4: Enhanced Policy Allocation

**User Story:**  
As the System, I want to create policies differently based on whether the scheme is prepaid or postpaid so that activation workflows match payment timing.

**Acceptance Criteria:**

#### For Prepaid Schemes (`scheme.isPostpaid = false`):
- [ ] Policy status set to `ACTIVE`
- [ ] Policy number generated immediately
- [ ] `startDate` set to current date
- [ ] `endDate` set to one year after start date
- [ ] `paymentAcNumber` set to customer ID (first policy) or generated unique number (subsequent)
- [ ] Policy member principals and dependants created immediately
- [ ] Payment frequency and cadence from user selection on payment page

#### For Postpaid Schemes (`scheme.isPostpaid = true`):
- [ ] Policy status set to `PENDING_ACTIVATION`
- [ ] Policy number is `NULL`
- [ ] `startDate` is `NULL`
- [ ] `endDate` is `NULL`
- [ ] `paymentAcNumber` is `NULL`
- [ ] No policy member records created yet
- [ ] Payment frequency and cadence inherited from scheme settings
- [ ] Policy activated later via manual or automated process

**Business Rules:**
- Prepaid policies are immediately usable upon creation
- Postpaid policies require activation (triggered by payment or admin action)
- Member numbers are only generated upon policy activation
- Policy dates are immutable once set
- Payment account numbers are only assigned to prepaid policies

**Policy Activation Function:**
- Input: `policyId`, `correlationId`
- Actions:
  1. If policy number not set: generate policy number
  2. Set `startDate` to current date
  3. Set `endDate` to one year after start date
  4. Update `status` to `ACTIVE`
  5. Create `policy_member_principals` entries with unique member numbers
  6. Create `policy_member_dependants` entries with unique member numbers
  7. If policy number already set: only update status to `ACTIVE`
- Constraints: Idempotent operation, safe to call multiple times

---

### FR-5: Payment Frequency Selection

**User Story:**  
As a Brand Ambassador, I want to select or view the payment frequency for a customer so that billing is set up correctly from the start.

**Acceptance Criteria:**

#### On `/register/payment` Page:
- [ ] Payment frequency dropdown added in Plan/Family Category section
- [ ] Dropdown options: Daily (1 day), Weekly (7 days), Monthly (31 days), Quarterly (90 days), Yearly (365 days), Custom
- [ ] Days displayed in brackets next to each frequency label

#### For Non-Postpaid Customers:
- [ ] Dropdown is active and editable
- [ ] Custom option is available
- [ ] When Custom selected: Cadence text box appears
- [ ] Cadence text box accepts max 3 digits, numbers only
- [ ] Validation requires frequency selection before submission
- [ ] Validation requires cadence value if Custom frequency selected

#### For Postpaid Customers:
- [ ] System fetches customer's scheme information on page load
- [ ] Dropdown is disabled (read-only)
- [ ] Dropdown displays scheme's frequency and cadence
- [ ] Display format: "Weekly (7 days)" or "Custom (10 days)"
- [ ] No validation needed (values pre-set by scheme)

**Business Rules:**
- Postpaid customers cannot choose payment frequency (fixed by scheme)
- Prepaid customers have full flexibility in payment frequency
- Custom cadence is validated to ensure realistic values (1-999 days)
- Payment frequency is stored in policy for billing purposes

---

### FR-6: Mandatory Scheme Assignment

**User Story:**  
As a System Administrator, I want to ensure all customers are assigned to a package and scheme during registration so that there are no orphaned customer records.

**Acceptance Criteria:**

#### On `/register/customer` Page:
- [ ] New "Select Product" card appears above "Customer Information"
- [ ] Card contains two dropdowns: Package and Scheme
- [ ] Package dropdown:
  - [ ] Loads all active packages on page mount
  - [ ] Placeholder: "Select package"
  - [ ] Marked as required (*)
- [ ] Scheme dropdown:
  - [ ] Disabled when no package selected
  - [ ] Loads schemes when package selected
  - [ ] Placeholder: "Select scheme" or "Loading..." while fetching
  - [ ] Marked as required (*)
  - [ ] Shows error "This package has no schemes. Please select another package." if empty
- [ ] Last selected package and scheme persisted in `localStorage`
- [ ] On page load: Restore last selections from `localStorage`
- [ ] Validation on form submission:
  - [ ] Error if package not selected: "Please select both a package and a scheme before continuing"
  - [ ] Error if scheme not selected: "Please select both a package and a scheme before continuing"
  - [ ] Error if packageSchemeId not found: "Invalid package/scheme combination. Please select again."
- [ ] Customer registration request includes required `packageSchemeId` field
- [ ] Backend DTO validates `packageSchemeId` is present and valid integer

**Business Rules:**
- All customers must belong to exactly one scheme at all times
- Customers cannot be created without scheme assignment
- Package-Scheme relationship is validated via `package_schemes` junction table
- Selected package and scheme are "sticky" across registrations (localStorage)
- Scheme dropdown is cleared when package selection changes

**API Integration:**
- Fetch packages: `GET /internal/product-management/packages`
- Fetch schemes: `GET /internal/product-management/packages/:packageId/schemes`
- Response includes `packageSchemeId` for each scheme (junction table ID)
- Customer creation: `POST /internal/customers` with required `packageSchemeId` field

---

### FR-7: Payment Matching Rules

**User Story:**  
As the Finance System, I want to match incoming payments to the correct policies or schemes so that accounts are accurately reconciled.

**Acceptance Criteria:**

#### For Payments with No 'G' Prefix:
- [ ] Look up `paymentAcNumber` in `policies` table only
- [ ] If match found: Update payment status, link to policy
- [ ] If no match found: Flag for manual intervention (suspense account)

#### For Payments with 'G' Prefix:
- [ ] Remove 'G' prefix from account number
- [ ] Look up remaining number in `schemes.paymentAcNumber` (without 'G')
- [ ] If match found:
  - [ ] Identify associated package via `package_schemes.schemeId`
  - [ ] Identify customers via `package_scheme_customers.packageSchemeId`
  - [ ] Update payments for all policies under identified customers and package
- [ ] If no match found: Flag for manual intervention

**Business Rules:**
- Payments without prefix are always policy-specific
- Payments with 'G' prefix are always scheme-level (corporate billing)
- Unmatched payments go to suspense account for manual review
- Payment matching is idempotent (use `transactionReference` for deduplication)
- Manual intervention required for:
  - Invalid account numbers
  - Account numbers not found in system
  - Account numbers that belong to different customer

**Error Handling:**
- Log all unmatched payments with correlation ID
- Send Sentry alerts for pattern of failed matches
- Generate daily suspense account report for finance team

---

## Technical Implementation

### Technology Stack
- **Backend**: NestJS (TypeScript)
- **Database**: PostgreSQL via Prisma ORM
- **Frontend**: Next.js 15 (React 19)
- **UI Components**: Shadcn UI + Radix UI primitives
- **Authentication**: Supabase Auth
- **Error Tracking**: Sentry

### Key Services Created/Modified

#### 1. PaymentAccountNumberService
**Location**: `apps/api/src/services/payment-account-number.service.ts`

**Responsibilities:**
- Generate unique payment account numbers for schemes and policies
- Manage sequence counter via database transaction
- Skip numbers containing digits 0 or 1
- Auto-expand to 4, 5, 6+ digits as needed

**Key Methods:**
- `generateForScheme()`: Generate 'G' prefixed number for postpaid schemes
- `generateForPolicy()`: Generate unprefixed number for policies
- `customerHasExistingPolicies(customerId)`: Check if customer has prior policies

#### 2. SchemeContactService
**Location**: `apps/api/src/services/scheme-contact.service.ts`

**Responsibilities:**
- CRUD operations for scheme contacts
- Enforce max 5 contacts per scheme limit
- Validate contact data before database operations

**Key Methods:**
- `createContact(schemeId, data, userId, correlationId)`
- `getContactsByScheme(schemeId, correlationId)`
- `updateContact(schemeId, contactId, data, correlationId)`
- `deleteContact(schemeId, contactId, correlationId)`

#### 3. PolicyService (Enhanced)
**Location**: `apps/api/src/services/policy.service.ts`

**Modifications:**
- Inject `PaymentAccountNumberService`
- Determine `paymentAcNumber` based on scheme type and customer history
- Conditionally set `policyNumber`, `startDate`, `endDate`, `status` based on `isPostpaid`
- Call `activatePolicy()` immediately for prepaid policies

**New Methods:**
- `activatePolicy(policyId, correlationId)`: Activate pending policy with full member setup
- `generateMemberNumber()`: Generate unique member numbers for principals and dependants

#### 4. ProductManagementService (Enhanced)
**Location**: `apps/api/src/services/product-management.service.ts`

**Modifications:**
- `getPackageSchemes()` now returns `packageSchemeId` for each scheme

---

## Database Schema Changes

### New Tables

#### `scheme_contacts`
```sql
CREATE TABLE scheme_contacts (
  id SERIAL PRIMARY KEY,
  scheme_id INTEGER NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  first_name VARCHAR(50) NOT NULL,
  other_name VARCHAR(50),
  phone_number VARCHAR(15),
  phone_number_2 VARCHAR(15),
  email VARCHAR(100),
  designation VARCHAR(10),
  notes VARCHAR(500),
  created_by UUID NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP
);

CREATE INDEX idx_scheme_contacts_scheme_id ON scheme_contacts(scheme_id);
```

#### `payment_account_number_sequences`
```sql
CREATE TABLE payment_account_number_sequences (
  id INTEGER PRIMARY KEY DEFAULT 1,
  current_value INTEGER NOT NULL DEFAULT 221,
  last_updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT single_row_check CHECK (id = 1)
);

-- Seed initial value
INSERT INTO payment_account_number_sequences (id, current_value) 
VALUES (1, 221) 
ON CONFLICT (id) DO NOTHING;
```

### Modified Tables

#### `schemes` (New Columns)
```sql
ALTER TABLE schemes 
ADD COLUMN is_postpaid BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN frequency VARCHAR(20), -- DAILY, WEEKLY, MONTHLY, QUARTERLY, ANNUALLY, CUSTOM
ADD COLUMN payment_cadence INTEGER, -- Days for custom frequency
ADD COLUMN payment_ac_number VARCHAR(50) UNIQUE;

-- Add check constraint for postpaid schemes
ALTER TABLE schemes
ADD CONSTRAINT check_postpaid_frequency 
CHECK (
  (is_postpaid = FALSE) OR 
  (is_postpaid = TRUE AND frequency IS NOT NULL)
);
```

#### `policies` (New/Modified Columns)
```sql
ALTER TABLE policies
ADD COLUMN payment_ac_number VARCHAR(50) UNIQUE,
ALTER COLUMN start_date DROP NOT NULL; -- Allow NULL for postpaid policies

-- Note: start_date changed from DateTime to DateTime? (nullable)
```

### Indexes
```sql
CREATE UNIQUE INDEX idx_schemes_payment_ac_number 
ON schemes(payment_ac_number) 
WHERE payment_ac_number IS NOT NULL;

CREATE UNIQUE INDEX idx_policies_payment_ac_number 
ON policies(payment_ac_number) 
WHERE payment_ac_number IS NOT NULL;
```

---

## API Endpoints

### Scheme Contacts

#### Create Scheme Contact
```
POST /internal/product-management/schemes/:schemeId/contacts
Authorization: Bearer {token}
x-correlation-id: {correlationId}

Request Body:
{
  "firstName": "John",
  "otherName": "Doe",
  "phoneNumber": "+254712345678",
  "phoneNumber2": "+254798765432",
  "email": "john.doe@example.com",
  "designation": "Manager",
  "notes": "Primary contact for scheme queries"
}

Response (201):
{
  "status": 201,
  "correlationId": "req-123",
  "message": "Contact created successfully",
  "data": {
    "id": 1,
    "schemeId": 5,
    "firstName": "John",
    ...
  }
}
```

#### List Scheme Contacts
```
GET /internal/product-management/schemes/:schemeId/contacts
Authorization: Bearer {token}
x-correlation-id: {correlationId}

Response (200):
{
  "status": 200,
  "correlationId": "req-124",
  "message": "Contacts retrieved successfully",
  "data": [
    {
      "id": 1,
      "schemeId": 5,
      "firstName": "John",
      ...
    }
  ]
}
```

#### Update Scheme Contact
```
PUT /internal/product-management/schemes/:schemeId/contacts/:contactId
Authorization: Bearer {token}
x-correlation-id: {correlationId}

Request Body: (same as create, all fields optional)

Response (200):
{
  "status": 200,
  "correlationId": "req-125",
  "message": "Contact updated successfully",
  "data": { ... }
}
```

#### Delete Scheme Contact
```
DELETE /internal/product-management/schemes/:schemeId/contacts/:contactId
Authorization: Bearer {token}
x-correlation-id: {correlationId}

Response (200):
{
  "status": 200,
  "correlationId": "req-126",
  "message": "Contact deleted successfully"
}
```

### Customer Management

#### Get Customer Scheme
```
GET /internal/customers/:customerId/scheme
Authorization: Bearer {token}
x-correlation-id: {correlationId}

Response (200):
{
  "status": 200,
  "correlationId": "req-127",
  "message": "Scheme information retrieved successfully",
  "data": {
    "id": 5,
    "schemeName": "Corporate Health Plan",
    "isPostpaid": true,
    "frequency": "MONTHLY",
    "paymentCadence": 31,
    "paymentAcNumber": "G222"
  }
}

Response (404):
{
  "error": {
    "code": "NOT_FOUND",
    "status": 404,
    "message": "Customer not found or not enrolled in a scheme",
    ...
  }
}
```

### Package & Scheme Management

#### List Active Packages
```
GET /internal/product-management/packages
Authorization: Bearer {token}
x-correlation-id: {correlationId}

Response (200):
{
  "status": 200,
  "correlationId": "req-128",
  "message": "Packages retrieved successfully",
  "data": [
    {
      "id": 1,
      "name": "Basic Health Cover",
      ...
    }
  ]
}
```

#### List Package Schemes (Enhanced)
```
GET /internal/product-management/packages/:packageId/schemes
Authorization: Bearer {token}
x-correlation-id: {correlationId}

Response (200):
{
  "status": 200,
  "correlationId": "req-129",
  "message": "Schemes retrieved successfully",
  "data": [
    {
      "id": 5,
      "name": "Corporate Scheme",
      "description": "For large organizations",
      "packageSchemeId": 12  // Junction table ID for customer assignment
    }
  ]
}
```

---

## User Interface Changes

### 1. Scheme Creation Dialog
**Location**: `/admin/underwriters/packages/:packageId`

**New Elements:**
- [ ] "Postpaid" checkbox (above frequency selection)
- [ ] "Payment Frequency" dropdown (visible when postpaid checked)
  - Options: Daily (1 day), Weekly (7 days), Monthly (31 days), Quarterly (90 days), Yearly (365 days), Custom
- [ ] "Cadence" text box (visible when Custom frequency selected)
  - Max 3 digits, numbers only
  - Label: "Cadence (days)"

**Validation:**
- Frequency required when postpaid is true
- Cadence required when Custom frequency selected
- Cadence must be 1-999

**Behavior:**
- When postpaid unchecked: Hide frequency and cadence fields
- When postpaid checked: Show frequency dropdown
- When Custom selected: Show cadence input

### 2. Package Details Page
**Location**: `/admin/underwriters/packages/:packageId`

**New Elements:**
- [ ] "Postpaid" badge pill next to scheme name in schemes table
  - Displayed when `scheme.isPostpaid === true`
  - Color: Purple
  - Text: "Postpaid"

**Example:**
```
Scheme Name                          Status    Actions
Corporate Health Plan  [Postpaid]    Active    View | Edit
Individual Plan                      Active    View | Edit
```

### 3. Scheme Details Page
**Location**: `/admin/underwriters/packages/:packageId/schemes/:schemeId`

**New Elements:**

#### Scheme Information Section:
- [ ] "Postpaid" badge pill (when applicable)
- [ ] "Payment Frequency" field (for postpaid schemes)
  - Display: "Monthly (31 days)" or "Custom (10 days)"
- [ ] "Payment Account Number" field (for postpaid schemes)
  - Display: "G222"

#### Scheme Contacts Section (new section below Customers grid):
- [ ] Section heading: "Scheme Contacts"
- [ ] "Add Contact" button (top right)
  - Disabled when 5 contacts exist
  - Tooltip: "Maximum 5 contacts allowed"
- [ ] Contacts table with columns:
  - Name (First + Other)
  - Phone Number(s)
  - Email
  - Designation
  - Actions (Edit | Delete)
- [ ] Empty state: "No contacts added yet. Click 'Add Contact' to get started."

#### Contact Dialog:
- [ ] Form fields:
  - First Name* (required, max 50 chars)
  - Other Name (optional, max 50 chars)
  - Phone Number (optional, max 15 chars)
  - Phone Number 2 (optional, max 15 chars)
  - Email (optional, email validation)
  - Designation (optional, max 10 chars)
  - Notes (optional, max 500 chars, textarea)
- [ ] Action buttons: Cancel | Save Contact

### 4. Customer Registration Page
**Location**: `/register/customer`

**New Section** (above "Customer Information"):

#### "Select Product" Card:
- [ ] Two-column layout on desktop, single column on mobile
- [ ] Left column: "Package *" dropdown
  - Loads all active packages on mount
  - Placeholder: "Select package"
- [ ] Right column: "Scheme *" dropdown
  - Disabled when no package selected
  - Placeholder: "Select scheme" or "Loading..." while fetching
  - Error message: "This package has no schemes. Please select another package."
- [ ] Asterisks indicate required fields

**Validation Messages:**
- "Please select both a package and a scheme before continuing"
- "Invalid package/scheme combination. Please select again."
- "Failed to load packages. Please refresh the page."
- "Failed to load schemes for this package."

**Persistence:**
- Selected package ID saved to `localStorage.lastSelectedPackageId`
- Selected scheme ID saved to `localStorage.lastSelectedSchemeId`
- On page load: Restore selections if present

**Existing Modifications:**
- [ ] Principal ID Number: `maxLength="10"`
- [ ] Spouse ID Number: `maxLength="10"`
- [ ] Next of Kin/Beneficiary ID Number: `maxLength="10"`

### 5. Payment Registration Page
**Location**: `/register/payment`

**New Elements** (in Plan/Family Category section):

#### Payment Frequency Dropdown:
- [ ] Label: "Payment Frequency *"
- [ ] Options: Daily (1 day), Weekly (7 days), Monthly (31 days), Quarterly (90 days), Yearly (365 days), Custom
- [ ] Display format: "Frequency (X days)"

#### Custom Cadence Input:
- [ ] Visible when "Custom" frequency selected
- [ ] Label: "Cadence *"
- [ ] Type: number
- [ ] Max length: 3 digits
- [ ] Min: 1, Max: 999
- [ ] Placeholder: "Enter days"

**Conditional Behavior:**

**For Non-Postpaid Customers:**
- Dropdown enabled and editable
- All frequency options including Custom available
- User must select frequency
- Validation error if not selected: "Please select a payment frequency"

**For Postpaid Customers:**
- System fetches customer scheme on page load via API
- Dropdown disabled (read-only)
- Displays scheme's frequency and cadence
- Example: "Monthly (31 days)" or "Custom (10 days)"
- No user interaction needed

**Existing Modifications:**
- [ ] Transaction Reference: `maxLength="15"`

---

## Business Logic

### Payment Account Number Generation Algorithm

```typescript
// Pseudocode
function generatePaymentAccountNumber() {
  let currentValue = getFromDatabase();
  
  do {
    currentValue++;
    if (containsZeroOrOne(currentValue)) {
      continue; // Skip this number
    }
    break; // Valid number found
  } while (true);
  
  saveToDatabase(currentValue);
  return currentValue.toString();
}

function containsZeroOrOne(number: number): boolean {
  const str = number.toString();
  return str.includes('0') || str.includes('1');
}
```

**Number Sequence Examples:**
- Valid: 222, 223, 224, ..., 229, 232, 233, ..., 999
- Invalid (skipped): 220, 221, 230, 231, 240, 241, 250, 251, 260, 261, 270, 271, 280, 281, 290, 291, 300, 301, 302, 310, 311, etc.
- After 999: 2222, 2223, 2224, ..., 2999, 3222, ...

### Policy Activation Logic

```typescript
// Pseudocode
async function activatePolicy(policyId: string) {
  const policy = await fetchPolicy(policyId);
  
  // Generate policy number if not already set
  if (!policy.policyNumber) {
    policy.policyNumber = await generatePolicyNumber();
  }
  
  // Set dates if not already set
  if (!policy.startDate) {
    policy.startDate = new Date();
    policy.endDate = addYears(policy.startDate, 1);
  }
  
  // Update status
  policy.status = 'ACTIVE';
  await savePolicy(policy);
  
  // Create member records if not already created
  if (!memberRecordsExist(policyId)) {
    await createPrincipalMembers(policyId);
    await createDependantMembers(policyId);
  }
}
```

### Payment Matching Logic

```typescript
// Pseudocode
async function matchPayment(accountNumber: string, amount: number, reference: string) {
  // Check for 'G' prefix (scheme payment)
  if (accountNumber.startsWith('G')) {
    const numericPart = accountNumber.substring(1);
    const scheme = await findSchemeByPaymentNumber(numericPart);
    
    if (scheme) {
      const customers = await getCustomersInScheme(scheme.id);
      await updateCustomerPolicies(customers, amount, reference);
      return { matched: true, type: 'scheme', scheme };
    } else {
      return { matched: false, reason: 'Scheme not found', requiresManualIntervention: true };
    }
  }
  
  // Policy payment (no prefix)
  const policy = await findPolicyByPaymentNumber(accountNumber);
  
  if (policy) {
    await updatePolicyPayment(policy.id, amount, reference);
    return { matched: true, type: 'policy', policy };
  } else {
    return { matched: false, reason: 'Policy not found', requiresManualIntervention: true };
  }
}
```

---

## Validation Rules

### Scheme Validation

| Field | Rule |
|-------|------|
| `isPostpaid` | Boolean, defaults to `false` |
| `frequency` | Required if `isPostpaid = true`, must be valid enum value |
| `paymentCadence` | Required if `frequency = CUSTOM`, integer 1-999 |
| `paymentAcNumber` | Auto-generated for postpaid schemes, must be unique if present |

### Scheme Contact Validation

| Field | Rule |
|-------|------|
| `firstName` | Required, max 50 chars |
| `otherName` | Optional, max 50 chars |
| `phoneNumber` | Optional, max 15 chars |
| `phoneNumber2` | Optional, max 15 chars |
| `email` | Optional, max 100 chars, valid email format if provided |
| `designation` | Optional, max 10 chars |
| `notes` | Optional, max 500 chars |
| Contacts per scheme | Maximum 5 contacts allowed |

### Policy Validation

| Field | Rule |
|-------|------|
| `paymentAcNumber` | Required for prepaid policies, NULL for postpaid, must be unique if present |
| `policyNumber` | Required for ACTIVE status, can be NULL for PENDING_ACTIVATION |
| `startDate` | Required for ACTIVE status, NULL for PENDING_ACTIVATION |
| `endDate` | Required for ACTIVE status, NULL for PENDING_ACTIVATION |
| `status` | Must be valid PolicyStatus enum |

### Customer Registration Validation

| Field | Rule |
|-------|------|
| `packageSchemeId` | Required (not optional), must be valid integer, must exist in `package_schemes` table |
| `principalMember.idNumber` | Max 10 characters |
| `spouses[].idNumber` | Max 10 characters if provided |
| `beneficiaries[].idNumber` | Max 10 characters |

### Payment Registration Validation

| Field | Rule |
|-------|------|
| `transactionReference` | Required, max 15 characters |
| `frequency` | Required for prepaid customers, inherited from scheme for postpaid |
| `paymentCadence` | Required if `frequency = CUSTOM`, integer 1-999 |

---

## Error Handling

### Error Codes

All errors follow the standardized error handling format as defined in `src/enums/error-codes.enum.ts`:

| Error Code | HTTP Status | Description | Use Case |
|------------|-------------|-------------|----------|
| `VALIDATION_ERROR` | 422 | General validation failure | Multiple field errors |
| `REQUIRED_FIELD_MISSING` | 422 | Required field not provided | Missing packageSchemeId |
| `DUPLICATE_EMAIL` | 422 | Email already exists | Duplicate scheme contact email |
| `NOT_FOUND` | 404 | Resource not found | Scheme, contact, or customer not found |
| `CUSTOMER_NOT_FOUND` | 404 | Customer not found | Invalid customer ID |
| `INSUFFICIENT_PERMISSIONS` | 403 | User lacks required permissions | Unauthorized scheme modification |
| `DATABASE_ERROR` | 500 | Database operation failed | Prisma transaction failure |

### Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "status": 422,
    "message": "Validation failed",
    "details": {
      "packageSchemeId": "Package scheme ID is required",
      "frequency": "Payment frequency is required for postpaid schemes"
    },
    "correlationId": "req-12345",
    "timestamp": "2025-11-10T10:32:45.123Z",
    "path": "/internal/customers"
  }
}
```

### Validation Exception Usage

```typescript
// Multiple field errors
const errors: Record<string, string> = {};
if (!packageSchemeId) errors['packageSchemeId'] = 'Package scheme is required';
if (!frequency && isPostpaid) errors['frequency'] = 'Frequency required for postpaid';
throw ValidationException.withMultipleErrors(errors);

// Single field error
throw ValidationException.forField('frequency', 'Invalid payment frequency');
```

### Sentry Integration

All errors are logged to Sentry with appropriate tags and context:

```typescript
Sentry.captureException(error, {
  tags: {
    component: 'SchemeManagement',
    action: 'createScheme',
    isPostpaid: true
  },
  extra: {
    schemeId,
    frequency,
    paymentCadence,
    errorMessage: error.message
  }
});
```

---

## Future Considerations

### Phase 2 Enhancements

1. **Postpaid to Prepaid Conversion**
   - Allow changing `isPostpaid` flag for schemes with active policies
   - Generate payment account numbers for all existing policies
   - Migrate payment history to new account numbers
   - Send notifications to affected customers

2. **Bulk Policy Activation**
   - Admin page to activate multiple PENDING_ACTIVATION policies at once
   - Filter by scheme, date range, or customer group
   - Preview activation impact before confirming
   - Generate activation report for audit trail

3. **Payment Reconciliation Dashboard**
   - Visual dashboard for unmatched payments
   - Search and filter suspense account transactions
   - Manual matching interface with suggestions
   - Audit trail for all manual interventions

4. **Scheme Contact Enhancements**
   - Increase limit from 5 to unlimited contacts
   - Add contact roles/permissions (primary, billing, technical)
   - Contact verification workflow (email/phone validation)
   - Contact activity history (who contacted when)

5. **Advanced Payment Cadence Options**
   - Bi-monthly (every 2 months)
   - Specific day of month (e.g., 1st of every month)
   - Specific day of week (e.g., every Friday)
   - Multiple payment schedules per scheme

6. **Payment Account Number Customization**
   - Allow partners to define their own prefix (not just 'G')
   - Support alphanumeric account numbers
   - Configurable number length and format
   - Import existing account numbers from legacy systems

### Technical Debt

1. **Radix UI Dialog Dependency**
   - Currently installed via package.json but was missing initially
   - All dialogs in app use `@radix-ui/react-dialog`
   - Consider consolidating all Radix UI dependencies in one place
   - Document required Radix UI packages for new features

2. **Prisma Client Type Generation**
   - Some type assertions used as workaround (e.g., `startDate as any`)
   - Need to run `npx prisma generate` after schema changes
   - Consider adding post-migration hook to auto-regenerate types

3. **Payment Account Number Sequence**
   - Current implementation uses single-row table
   - Consider moving to database sequence (SERIAL/BIGSERIAL)
   - Benchmark performance for high-concurrency scenarios

4. **Frontend Error Handling**
   - Standardize error display across all forms
   - Create reusable error component
   - Implement toast notifications for background operations

---

## Appendices

### A. Payment Frequency Enum Values

```typescript
enum PaymentFrequency {
  DAILY = 'DAILY',           // 1 day
  WEEKLY = 'WEEKLY',         // 7 days
  MONTHLY = 'MONTHLY',       // 31 days
  QUARTERLY = 'QUARTERLY',   // 90 days
  ANNUALLY = 'ANNUALLY',     // 365 days
  CUSTOM = 'CUSTOM'          // User-defined cadence
}
```

### B. Policy Status Values

```typescript
enum PolicyStatus {
  ACTIVE = 'ACTIVE',
  PENDING_ACTIVATION = 'PENDING_ACTIVATION',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED'
}
```

### C. Valid Payment Account Numbers

**3-digit numbers (excluding 0 and 1):**
- Range: 222-999
- Valid examples: 222, 223, 224, 225, 226, 227, 228, 229, 232, 233, 234, 235, 236, 237, 238, 239, 242, 243, ..., 999
- Invalid examples (skipped): 220, 221, 230, 231, 240, 241, 250, 251, ..., 100, 101, 110, 111, etc.

**4-digit numbers (after exhausting 3-digit):**
- Range: 2222-9999
- Valid examples: 2222, 2223, 2224, ..., 2229, 2232, ..., 9999
- Invalid examples: 2220, 2221, 2230, 1000, 1001, etc.

**Scheme account numbers:**
- Format: G{number}
- Examples: G222, G223, G2222, G3456

### D. Database Migration Commands

```bash
# Generate Prisma migration (development)
npx prisma migrate dev --name add_scheme_features

# Apply pending migrations (production)
npx prisma migrate deploy

# Push schema changes without migration (for rapid prototyping only)
npx prisma db push --accept-data-loss

# Regenerate Prisma client types
npx prisma generate

# Seed initial sequence value
psql -d microbima -f apps/api/prisma/seed-payment-sequence.sql
```

### E. API Testing Examples

#### Create Postpaid Scheme
```bash
curl -X POST http://localhost:3000/internal/product-management/schemes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -H "x-correlation-id: req-test-001" \
  -d '{
    "packageId": 1,
    "schemeName": "Corporate Health Plan",
    "description": "For large organizations",
    "isActive": true,
    "isPostpaid": true,
    "frequency": "MONTHLY",
    "paymentCadence": 31
  }'
```

#### Register Customer with Scheme
```bash
curl -X POST http://localhost:3000/internal/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -H "x-correlation-id: req-test-002" \
  -d '{
    "principalMember": {
      "firstName": "John",
      "lastName": "Doe",
      "idNumber": "12345678",
      ...
    },
    "product": {
      "productId": "default-product",
      "planId": "default-plan"
    },
    "packageSchemeId": 12
  }'
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-10 | System | Initial PRD created based on implementation |

---

## References

- [MicroBima Error Handling Guide](./error-handling-guide.md)
- [Architecture Decision: Standardized Error Handling](../architecture/decisions/004-standardized-error-handling.md)
- [Deployment Checklist](./deployment-checklist.md)
- [Database Deployment Strategy](./database-deployment-strategy.md)

---

**End of Document**

