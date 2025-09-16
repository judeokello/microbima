# ADR-004: Standardized Error Handling

**Status:** Implemented  
**Date:** 2025-09-16  
**Authors:** Assistant, Development Team  

## Context

The MicroBima API needed a consistent, comprehensive error handling system that would:

1. **Provide Multiple Field Errors**: Return all validation errors at once instead of one-by-one
2. **Standardize Error Codes**: Enable programmatic error handling for API consumers
3. **Environment-Specific Details**: Show appropriate information based on deployment environment
4. **Consistent Structure**: Use the same error format across all endpoints and error types
5. **Debugging Support**: Include correlation IDs, timestamps, and stack traces where appropriate

### Previous State

Before this implementation, the API had:
- Inconsistent error response formats
- Single validation error responses (required multiple round trips to fix all issues)
- Raw database exception messages exposed to API consumers
- No standardized error codes for programmatic handling
- Missing correlation IDs in error responses

## Decision

We have implemented a comprehensive standardized error handling system with the following components:

### 1. Error Response Schema

**New Standard Format:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "status": 422,
    "message": "One or more fields failed validation",
    "details": {
      "email": "Email address already exists",
      "id_number": "ID number already exists for this ID type"
    },
    "correlationId": "req-12345-67890",
    "timestamp": "2025-09-15T10:32:45.123Z",
    "path": "/api/v1/customers",
    "stack": "ValidationException: One or more fields failed validation..." // development only
  }
}
```

### 2. Error Codes Enum

Created comprehensive error codes for all scenarios:

**Validation Errors (422):**
- `VALIDATION_ERROR`, `DUPLICATE_EMAIL`, `DUPLICATE_ID_NUMBER`
- `INVALID_FORMAT`, `REQUIRED_FIELD_MISSING`, `FIELD_TOO_LONG`

**Client Errors (400):**
- `MALFORMED_REQUEST`, `INVALID_JSON`, `MISSING_REQUIRED_HEADERS`

**Authentication Errors (401):**
- `AUTHENTICATION_ERROR`, `INVALID_API_KEY`, `API_KEY_EXPIRED`

**Authorization Errors (403):**
- `AUTHORIZATION_ERROR`, `INSUFFICIENT_PERMISSIONS`

**Not Found Errors (404):**
- `NOT_FOUND`, `CUSTOMER_NOT_FOUND`, `PARTNER_NOT_FOUND`

**Server Errors (500):**
- `INTERNAL_SERVER_ERROR`, `DATABASE_ERROR`, `EXTERNAL_SERVICE_ERROR`

### 3. Enhanced ValidationException

Updated to support multiple field errors:

```typescript
// Single field error
throw ValidationException.forField('email', 'Email address already exists');

// Multiple field errors
throw ValidationException.withMultipleErrors({
  'email': 'Email address already exists',
  'id_number': 'ID number already exists for this ID type'
});
```

### 4. Environment-Specific Behavior

**Development Environment:**
- Full stack traces included
- All error details visible
- Path information included

**Staging/Production Environment:**
- No stack traces
- Minimal error details
- User-friendly messages for database errors
- Path information included for debugging

### 5. Database Error Handling

**Before:**
```json
{
  "message": "Invalid `this.prismaService.customer.create()` invocation\n\nUnique constraint failed on the fields: (`email`)"
}
```

**After:**
```json
{
  "error": {
    "code": "DUPLICATE_EMAIL",
    "status": 422,
    "message": "Email address already exists"
  }
}
```

## HTTP Status Code Standards

| Status | Use Case | Error Codes |
|--------|----------|-------------|
| **400** | Malformed requests (bad JSON, invalid query params) | `MALFORMED_REQUEST`, `INVALID_JSON` |
| **401** | Authentication failures | `INVALID_API_KEY`, `MISSING_API_KEY` |
| **403** | Authorization failures | `INSUFFICIENT_PERMISSIONS` |
| **404** | Resource not found | `CUSTOMER_NOT_FOUND`, `PARTNER_NOT_FOUND` |
| **409** | Resource conflicts | `POLICY_ALREADY_ACTIVE` |
| **422** | Validation failures | `DUPLICATE_EMAIL`, `VALIDATION_ERROR` |
| **429** | Rate limiting | `RATE_LIMIT_EXCEEDED` |
| **500** | Server errors | `DATABASE_ERROR`, `INTERNAL_SERVER_ERROR` |

## Implementation Details

### Files Created/Modified:

1. **`src/dto/common/standard-error-response.dto.ts`** - New error response schema
2. **`src/enums/error-codes.enum.ts`** - Comprehensive error codes
3. **`src/exceptions/validation.exception.ts`** - Enhanced validation exception
4. **`src/filters/global-exception.filter.ts`** - Updated to use new format
5. **`src/services/customer.service.ts`** - Multiple validation error support

### Multiple Validation Example:

**Before (Multiple Round Trips):**
```bash
POST /customers → 422: "Email already exists"
# Fix email, retry
POST /customers → 422: "ID number already exists" 
# Fix ID number, retry
POST /customers → 201: Success
```

**After (Single Round Trip):**
```bash
POST /customers → 422: {
  "details": {
    "email": "Email already exists",
    "id_number": "ID number already exists"
  }
}
# Fix both fields
POST /customers → 201: Success
```

## Benefits

1. **Improved Developer Experience**: API consumers get all validation errors at once
2. **Programmatic Handling**: Standardized error codes enable automated error handling
3. **Better Debugging**: Correlation IDs and timestamps aid in troubleshooting
4. **Security**: Raw database errors hidden in production
5. **Consistency**: Same error format across all endpoints
6. **Performance**: Fewer round trips needed to fix validation issues

## Future Considerations

### Upcoming Features:
- Error code documentation in Swagger
- Client SDK error handling examples
- Monitoring dashboard for error patterns
- Automatic retry strategies for specific error codes

### Migration Path:
- **Phase 1**: ✅ Core infrastructure implemented
- **Phase 2**: Gradual rollout to other endpoints
- **Phase 3**: Client SDK updates
- **Phase 4**: Legacy format deprecation

## Related Documents

- [Development Guide](../../development/coding-standards.md)
- [Error Handling Standards](../../development/error-handling-guide.md)
- [API Testing Guide](../../API_Testing_Guide.md)

## Examples for Different Environments

### Development Environment Response:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "status": 422,
    "message": "2 fields failed validation",
    "details": {
      "email": "Email address already exists",
      "phone_number": "Invalid phone number format"
    },
    "correlationId": "req-12345-67890",
    "timestamp": "2025-09-15T10:32:45.123Z",
    "path": "/api/v1/customers",
    "stack": "ValidationException: 2 fields failed validation\n    at CustomerService.createCustomer..."
  }
}
```

### Production Environment Response:
```json
{
  "error": {
    "code": "VALIDATION_ERROR", 
    "status": 422,
    "message": "2 fields failed validation",
    "details": {
      "email": "Email address already exists",
      "phone_number": "Invalid phone number format"
    },
    "correlationId": "req-12345-67890",
    "timestamp": "2025-09-15T10:32:45.123Z",
    "path": "/api/v1/customers"
  }
}
```

## Success Metrics

- **Reduction in API calls**: Multiple validation errors handled in single request
- **Developer satisfaction**: Improved error messages and debugging capability  
- **Support ticket reduction**: Better error messages reduce confusion
- **API consistency**: Standardized format across all endpoints
