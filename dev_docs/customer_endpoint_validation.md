# Principal Member Management API Validation Documentation

This document provides a comprehensive overview of validation rules implemented for the Principal Member Management endpoints in the Birdview Insurance API.

## Table of Contents

1. [Principal Member Creation](#principal-member-creation)
2. [Beneficiaries Management](#beneficiaries-management)
3. [Children Management](#children-management)
4. [Spouses Management](#spouses-management)
5. [Common Validation Patterns](#common-validation-patterns)

---
Test

## Principal Member Creation

### POST /api/principal-member

**Purpose**: Create a new principal member with beneficiaries, spouses, and children.

#### Request Validation

**Required Fields**:
- `correlationId`: Must be a non-empty string
- `product.productId`: Must be a non-empty string
- `product.planId`: Must be a non-empty string
- `principalMember`: Object containing principal member details

**Principal Member Validation**:
- `firstName`: Required, must be a non-empty string
- `surName`: Required, must be a non-empty string
- `middleName`: Optional, must be a string if provided
- `dateOfBirth`: Required, must be in YYYY-MM-DD format and valid date
- `gender`: Optional, must be "male" or "female" if provided
- `email`: Optional, must be valid email format if provided
- `idType`: Required, must be one of: "national", "alien", "passport"
- `idNumber`: Required, must be a non-empty string
- `partnerCustomerId`: Required, must be a non-empty string

**Beneficiaries Validation** (Optional array):
- `firstName`: Required, must be non-empty string
- `surName`: Required, must be non-empty string
- `dateOfBirth`: Required, must be in YYYY-MM-DD format
- `relationship`: Required, must be one of: "spouse", "child", "parent", "sibling", "friend", "other"
- `relationshipDescription`: Required when relationship is "other"
- `idType`: Required, must be one of: "national", "alien", "passport", "birth_certificate"
- `idNumber`: Required, must be non-empty string
- `email`: Optional, must be valid email format if provided
- `phoneNumber`: Optional, must be valid Kenyan phone number if provided

**Children Validation** (Optional array):
- `firstName`: Required, must be non-empty string
- `surName`: Required, must be non-empty string
- `dateOfBirth`: Required, must be in YYYY-MM-DD format
- `idType`: Optional, must be "birth_certificate" for minors, or "national"/"alien" for adults (18+ years)
- `idNumber`: Optional, required when `idType` is provided
- **ID Type Business Rules**:
  - If `idType` is "birth_certificate": No age restriction (for minors)
  - If `idType` is "national" or "alien": Child must be 18+ years old (calculated from `dateOfBirth`)

**Spouses Validation** (Optional array):
- `firstName`: Required, must be non-empty string
- `surName`: Required, must be non-empty string
- `dateOfBirth`: Required, must be in YYYY-MM-DD format
- `idType`: Required, must be one of: "national", "alien", "passport"
- `idNumber`: Required, must be non-empty string
- `email`: Optional, must be valid email format if provided

**Business Logic Validation**:
- Unique constraint check for `partnerCustomerId` within tenant
- Unique constraint check for person (idType + idNumber combination) within tenant
- Product pricing validation based on family composition
- Maximum family member limits per product

---

## Beneficiaries Management

### POST /api/principal-member/{principalId}/beneficiaries

**Purpose**: Add beneficiaries to an existing principal member.

#### Request Validation

**Required Fields**:
- `correlationId`: Must be a non-empty string
- `principalId`: Must be provided in URL path
- `beneficiaries`: Must be non-empty array

**API Key Validation**:
- `x-api-key` header: Required and must be valid

**Beneficiaries Array Validation**:
- Must contain at least one beneficiary
- Each beneficiary validated using shared beneficiary validation logic
- Same validation rules as in principal member creation

---

## Children Management

### POST /api/principal-member/{principalId}/children

**Purpose**: Add children to an existing principal member.

#### Request Validation

**Required Fields**:
- `correlationId`: Must be a non-empty string
- `principalId`: Must be provided in URL path
- `children`: Must be non-empty array

**API Key Validation**:
- `x-api-key` header: Required and must be valid

**Children Array Validation**:
- Must contain at least one child
- Each child validated using shared child validation logic
- Same validation rules as in principal member creation

---

## Spouses Management

### POST /api/principal-member/{principalId}/spouses

**Purpose**: Add spouses to an existing principal member.

#### Request Validation

**Required Fields**:
- `correlationId`: Must be a non-empty string
- `principalId`: Must be provided in URL path
- `spouses`: Must be non-empty array

**API Key Validation**:
- `x-api-key` header: Required and must be valid

**Spouses Array Validation**:
- Must contain at least one spouse
- Each spouse validated using shared spouse validation logic
- Same validation rules as in principal member creation


## Common Validation Patterns

### Email Validation
```javascript
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
```

### Date Validation
```javascript
function validateDate(dateString: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) return false;
  
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}
```

### Phone Number Validation
- Uses shared `validatePhoneNumber()` function
- Validates Kenyan phone number formats
- Imported from `@/lib/api/validation`

### ID Type Validation
```javascript
function validateIdType(idType: string): boolean {
  return ['national', 'alien', 'passport', 'birth_certificate'].includes(idType);
}
```

### Gender Validation
```javascript
function validateGender(gender: string): boolean {
  return ['male', 'female'].includes(gender);
}
```

### Relationship Validation
```javascript
function validateRelationship(relationship: string): boolean {
  return ['spouse', 'child', 'parent', 'sibling', 'friend', 'other'].includes(relationship);
}
```

---

## Error Response Patterns

### Standard Error Response
```json
{
  "status": 400,
  "correlationId": "CORR-123456789",
  "error": "Validation failed",
  "errorCode": "VALIDATION_FAILED",
  "errorCategory": "validation",
  "details": ["Specific validation error messages"]
}
```

### Dependants Validation Error
```json
{
  "status": 400,
  "correlationId": "CORR-123456789",
  "error": "Dependants validation failed",
  "errorCode": "DEPENDANTS_VALIDATION_FAILED",
  "errorCategory": "dependants_validation",
  "dependantsErrors": {
    "spouses": ["spouse-specific errors"],
    "children": ["child-specific errors"],
    "general": ["general errors"]
  }
}
```

---

## Security Validations

### API Key Validation
- All protected endpoints require `x-api-key` header
- API keys validated against internal mapping
- Invalid keys return 401 Unauthorized
- API key mapping errors logged to Sentry

---

## Logging and Monitoring

### Validation Logging
- All validation failures logged to Sentry
- Validation patterns tracked for analytics
- Performance metrics captured
- Full request/response logging with privacy controls

### Error Categorization
- Validation errors: Field-level validation failures
- Business logic errors: Duplicate checks, constraints
- Internal API errors: External service failures
- Authentication errors: API key validation failures
- System errors: Unexpected exceptions

---
