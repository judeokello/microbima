# Error Handling Standards

This guide outlines how to implement consistent error handling across the MicroBima API. All new endpoints and services must follow these standards.

## Table of Contents

1. [Overview](#overview)
2. [Error Response Format](#error-response-format)
3. [Error Codes](#error-codes)
4. [HTTP Status Codes](#http-status-codes)
5. [Validation Errors](#validation-errors)
6. [Service Layer Implementation](#service-layer-implementation)
7. [Examples](#examples)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)

## Overview

The MicroBima API uses a standardized error handling system that provides:

- **Multiple validation errors** in a single response
- **Standardized error codes** for programmatic handling
- **Environment-specific details** (stack traces in development only)
- **Correlation IDs** for request tracing
- **User-friendly messages** (no raw database errors in production)

## Error Response Format

All error responses follow this structure:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "status": 422,
    "message": "Human-readable error message",
    "details": {
      "field_name": "Field-specific error message"
    },
    "correlationId": "req-12345-67890",
    "timestamp": "2025-09-15T10:32:45.123Z",
    "path": "/api/v1/endpoint",
    "stack": "Stack trace (development only)"
  }
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | ✅ | Standardized error code for programmatic handling |
| `status` | number | ✅ | HTTP status code (ALWAYS use "status", never "statusCode") |
| `message` | string | ✅ | Human-readable error message |
| `details` | object | ❌ | Field-specific error details (for validation errors) |
| `correlationId` | string | ✅ | Request correlation ID for tracing |
| `timestamp` | string | ✅ | ISO timestamp when error occurred |
| `path` | string | ✅ | API endpoint where error occurred |
| `stack` | string | ❌ | Stack trace (development environment only) |

## Error Codes

Import and use standardized error codes:

```typescript
import { ErrorCodes } from '../enums/error-codes.enum';
```

### Available Error Codes

#### Validation Errors (422)
```typescript
ErrorCodes.VALIDATION_ERROR          // Generic validation failure
ErrorCodes.DUPLICATE_EMAIL           // Email already exists
ErrorCodes.DUPLICATE_ID_NUMBER       // ID number already exists
ErrorCodes.INVALID_FORMAT            // Invalid data format
ErrorCodes.REQUIRED_FIELD_MISSING    // Required field not provided
ErrorCodes.FIELD_TOO_LONG            // Field exceeds max length
ErrorCodes.FIELD_TOO_SHORT           // Field below min length
ErrorCodes.INVALID_DATE              // Invalid date format
ErrorCodes.FUTURE_DATE_NOT_ALLOWED   // Date cannot be in future
ErrorCodes.INVALID_PHONE_NUMBER      // Invalid phone format
ErrorCodes.INVALID_EMAIL_FORMAT      // Invalid email format
```

#### Client Errors (400)
```typescript
ErrorCodes.MALFORMED_REQUEST         // Bad request structure
ErrorCodes.INVALID_JSON              // Invalid JSON payload
ErrorCodes.INVALID_QUERY_PARAMETERS  // Invalid query params
ErrorCodes.MISSING_REQUIRED_HEADERS  // Missing required headers
```

#### Authentication Errors (401)
```typescript
ErrorCodes.AUTHENTICATION_ERROR      // Generic auth failure
ErrorCodes.INVALID_API_KEY           // Invalid API key
ErrorCodes.API_KEY_EXPIRED           // Expired API key
ErrorCodes.MISSING_API_KEY           // API key not provided
```

#### Authorization Errors (403)
```typescript
ErrorCodes.AUTHORIZATION_ERROR       // Generic authorization failure
ErrorCodes.INSUFFICIENT_PERMISSIONS  // Insufficient permissions
ErrorCodes.PARTNER_ACCESS_DENIED     // Partner access denied
```

#### Not Found Errors (404)
```typescript
ErrorCodes.NOT_FOUND                 // Generic not found
ErrorCodes.CUSTOMER_NOT_FOUND        // Customer not found
ErrorCodes.PARTNER_NOT_FOUND         // Partner not found
ErrorCodes.POLICY_NOT_FOUND          // Policy not found
ErrorCodes.ENDPOINT_NOT_FOUND        // Endpoint not found
```

#### Conflict Errors (409)
```typescript
ErrorCodes.RESOURCE_CONFLICT         // Generic resource conflict
ErrorCodes.POLICY_ALREADY_ACTIVE     // Policy already active
ErrorCodes.CUSTOMER_ALREADY_EXISTS   // Customer already exists
```

#### Server Errors (500)
```typescript
ErrorCodes.INTERNAL_SERVER_ERROR     // Generic server error
ErrorCodes.DATABASE_ERROR            // Database operation failed
ErrorCodes.EXTERNAL_SERVICE_ERROR    // External service failure
ErrorCodes.SERVICE_UNAVAILABLE       // Service temporarily unavailable
ErrorCodes.TIMEOUT_ERROR             // Operation timeout
ErrorCodes.CONFIGURATION_ERROR       // Configuration issue
```

## HTTP Status Codes

Use appropriate HTTP status codes for different error types:

| Status | Use Case | Example Error Codes |
|--------|----------|-------------------|
| **400** | Malformed requests | `MALFORMED_REQUEST`, `INVALID_JSON` |
| **401** | Authentication failures | `INVALID_API_KEY`, `MISSING_API_KEY` |
| **403** | Authorization failures | `INSUFFICIENT_PERMISSIONS` |
| **404** | Resource not found | `CUSTOMER_NOT_FOUND` |
| **409** | Resource conflicts | `POLICY_ALREADY_ACTIVE` |
| **422** | Validation failures | `DUPLICATE_EMAIL`, `VALIDATION_ERROR` |
| **429** | Rate limiting | `RATE_LIMIT_EXCEEDED` |
| **500** | Server errors | `DATABASE_ERROR`, `INTERNAL_SERVER_ERROR` |

## Validation Errors

### Single Field Validation

```typescript
import { ValidationException } from '../exceptions/validation.exception';
import { ErrorCodes } from '../enums/error-codes.enum';

// Single field error
if (existingEmail) {
  throw ValidationException.forField(
    'email', 
    'Email address already exists',
    ErrorCodes.DUPLICATE_EMAIL
  );
}
```

### Multiple Field Validation

```typescript
// Collect all validation errors
const validationErrors: Record<string, string> = {};

// Check email uniqueness
if (existingEmail) {
  validationErrors['email'] = 'Email address already exists';
}

// Check ID number uniqueness
if (existingIdNumber) {
  validationErrors['id_number'] = 'ID number already exists for this ID type';
}

// Check required fields
if (!customer.firstName) {
  validationErrors['first_name'] = 'First name is required';
}

// Throw all errors at once
if (Object.keys(validationErrors).length > 0) {
  throw ValidationException.withMultipleErrors(
    validationErrors, 
    ErrorCodes.VALIDATION_ERROR
  );
}
```

## Service Layer Implementation

### Pre-Save Validation Pattern

```typescript
import { Injectable } from '@nestjs/common';
import { ValidationException } from '../exceptions/validation.exception';
import { ErrorCodes } from '../enums/error-codes.enum';

@Injectable()
export class CustomerService {
  async createCustomer(customerData: CreateCustomerDto): Promise<Customer> {
    // 1. Collect all validation errors
    const validationErrors: Record<string, string> = {};

    // 2. Entity validation
    const customer = new Customer(customerData);
    const entityValidation = customer.validateBeforeSave();
    if (!entityValidation.valid) {
      entityValidation.errors.forEach(error => {
        // Parse field-specific errors from entity validation
        const fieldMatch = error.match(/^(\w+)\s+(.+)$/);
        if (fieldMatch) {
          validationErrors[fieldMatch[1]] = fieldMatch[2];
        } else {
          validationErrors['general'] = error;
        }
      });
    }

    // 3. Database uniqueness checks
    if (customer.email) {
      const existingEmail = await this.checkEmailExists(customer.email);
      if (existingEmail) {
        validationErrors['email'] = 'Email address already exists';
      }
    }

    if (customer.idNumber) {
      const existingId = await this.checkIdExists(customer.idType, customer.idNumber);
      if (existingId) {
        validationErrors['id_number'] = 'ID number already exists for this ID type';
      }
    }

    // 4. Business rule validation
    if (customer.dateOfBirth > new Date()) {
      validationErrors['date_of_birth'] = 'Date of birth cannot be in the future';
    }

    // 5. Throw all errors at once
    if (Object.keys(validationErrors).length > 0) {
      throw ValidationException.withMultipleErrors(
        validationErrors,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // 6. Save to database
    return await this.prisma.customer.create({ data: customer });
  }

  private async checkEmailExists(email: string): Promise<boolean> {
    const existing = await this.prisma.customer.findFirst({
      where: { email }
    });
    return !!existing;
  }

  private async checkIdExists(idType: string, idNumber: string): Promise<boolean> {
    const existing = await this.prisma.customer.findFirst({
      where: { idType, idNumber }
    });
    return !!existing;
  }
}
```

### Database Error Handling

The `GlobalExceptionFilter` automatically handles common database errors:

```typescript
// Prisma unique constraint errors are automatically converted to:
{
  "error": {
    "code": "DUPLICATE_EMAIL",  // or DUPLICATE_ID_NUMBER
    "status": 422,
    "message": "Email address already exists"
  }
}

// Prisma foreign key errors are automatically converted to:
{
  "error": {
    "code": "MALFORMED_REQUEST",
    "status": 400,
    "message": "Invalid reference to related data"
  }
}
```

## Examples

### Customer Creation with Multiple Errors

**Request:**
```bash
POST /api/v1/customers
{
  "principalMember": {
    "firstName": "",  // Missing required field
    "email": "existing@email.com",  // Already exists
    "idNumber": "12345678"  // Already exists
  }
}
```

**Response:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "status": 422,
    "message": "3 fields failed validation",
    "details": {
      "first_name": "First name is required",
      "email": "Email address already exists", 
      "id_number": "ID number already exists for this ID type"
    },
    "correlationId": "req-12345-67890",
    "timestamp": "2025-09-15T10:32:45.123Z",
    "path": "/api/v1/customers"
  }
}
```

### Authentication Error

**Request:**
```bash
GET /api/v1/customers
# Missing x-api-key header
```

**Response:**
```json
{
  "error": {
    "code": "MISSING_API_KEY",
    "status": 401,
    "message": "API key is required",
    "correlationId": "req-12345-67890",
    "timestamp": "2025-09-15T10:32:45.123Z",
    "path": "/api/v1/customers"
  }
}
```

### Not Found Error

**Request:**
```bash
GET /api/v1/customers/non-existent-id
```

**Response:**
```json
{
  "error": {
    "code": "CUSTOMER_NOT_FOUND",
    "status": 404,
    "message": "Customer not found",
    "correlationId": "req-12345-67890",
    "timestamp": "2025-09-15T10:32:45.123Z", 
    "path": "/api/v1/customers/non-existent-id"
  }
}
```

## Testing

### Unit Testing Validation Errors

```typescript
describe('CustomerService', () => {
  it('should return multiple validation errors', async () => {
    // Arrange
    const invalidData = {
      firstName: '',  // Missing
      email: 'existing@email.com',  // Duplicate
      idNumber: '12345678'  // Duplicate
    };

    // Act & Assert
    await expect(customerService.createCustomer(invalidData))
      .rejects
      .toThrow(ValidationException);

    try {
      await customerService.createCustomer(invalidData);
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationException);
      expect(error.errorCode).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(error.errorDetails).toEqual({
        'first_name': 'First name is required',
        'email': 'Email address already exists',
        'id_number': 'ID number already exists for this ID type'
      });
    }
  });
});
```

### Integration Testing Error Responses

```typescript
describe('Customer API', () => {
  it('should return standardized error format', async () => {
    // Act
    const response = await request(app)
      .post('/api/v1/customers')
      .send({ invalidData: true })
      .expect(422);

    // Assert
    expect(response.body.error).toMatchObject({
      code: expect.any(String),
      status: 422,
      message: expect.any(String),
      correlationId: expect.any(String),
      timestamp: expect.any(String),
      path: '/api/v1/customers'
    });
  });
});
```

## Troubleshooting

### Common Issues

#### 1. Using "statusCode" Instead of "status"

**Problem:** Error responses use "statusCode" field instead of "status".

**Solution:** ALWAYS use "status" field in error responses:

```typescript
// ✅ Correct
{
  "error": {
    "status": 422,
    "message": "Validation failed"
  }
}

// ❌ Incorrect
{
  "error": {
    "statusCode": 422,  // Wrong field name
    "message": "Validation failed"
  }
}
```

#### 2. ValidationException Not Using New Format

**Problem:** ValidationException still returns old error format.

**Solution:** Ensure ValidationException is properly imported and used:

```typescript
// ✅ Correct
import { ValidationException } from '../exceptions/validation.exception';
throw ValidationException.withMultipleErrors(errors);

// ❌ Incorrect
import { HttpException } from '@nestjs/common';
throw new HttpException('Error', 422);
```

#### 3. Missing Error Details

**Problem:** Error response doesn't include field-specific details.

**Solution:** Collect validation errors in an object:

```typescript
// ✅ Correct
const validationErrors: Record<string, string> = {};
validationErrors['email'] = 'Email already exists';
throw ValidationException.withMultipleErrors(validationErrors);

// ❌ Incorrect
throw new ValidationException(ErrorCodes.VALIDATION_ERROR, 'Email already exists');
```

#### 4. Database Errors Still Showing Raw Messages

**Problem:** Raw Prisma errors appear in production.

**Solution:** Ensure GlobalExceptionFilter is properly registered in `main.ts`:

```typescript
// In main.ts
app.useGlobalFilters(new GlobalExceptionFilter(externalIntegrationsService));
```

#### 5. Missing Correlation IDs

**Problem:** Error responses don't include correlation IDs.

**Solution:** Ensure CorrelationIdMiddleware is applied:

```typescript
// In app.module.ts
consumer
  .apply(CorrelationIdMiddleware)
  .forRoutes('*');
```

### Debugging Tips

1. **Check Server Logs**: Look for the original exception before it's transformed
2. **Verify Environment**: Stack traces only appear in development
3. **Test with curl**: Ensure headers are properly set
4. **Check Error Codes**: Verify error codes match expected values

```bash
# Test error handling
curl -X POST http://localhost:3000/api/v1/customers \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-key" \
  -H "x-correlation-id: test-123" \
  -d '{"invalid": "data"}'
```

## Best Practices

1. **Always collect multiple validation errors** before throwing
2. **Use specific error codes** instead of generic ones
3. **Provide helpful error messages** that guide users to solutions
4. **Include field names** in validation error details
5. **Test error scenarios** as thoroughly as success scenarios
6. **Document custom error codes** in API documentation
7. **Log errors** with correlation IDs for debugging
8. **Don't expose sensitive information** in error messages

## Related Files

- `/src/dto/common/standard-error-response.dto.ts` - Error response schema
- `/src/enums/error-codes.enum.ts` - Error code definitions
- `/src/exceptions/validation.exception.ts` - Validation exception class
- `/src/filters/global-exception.filter.ts` - Global error handling
- `/docs/architecture/decisions/004-standardized-error-handling.md` - Architecture decision
