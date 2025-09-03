# API Key Authentication Architecture

## Overview

The API key authentication system provides secure access to public API endpoints using `x-api-key` headers.

## Components

### 1. ApiKeyAuthMiddleware
**Purpose**: Global middleware that validates API keys for all public routes
**Location**: `src/middleware/api-key-auth.middleware.ts`
**Usage**: Applied globally via `AppModule.configure()`

**Features**:
- Validates `x-api-key` header
- Skips internal routes (`/api/internal`)
- Skips health checks (`/health`, `/api/health`)
- Skips Swagger docs in development
- Adds validated API key to request object

### 2. ApiKeyService
**Purpose**: Service for database-based API key validation and partner management
**Location**: `src/services/api-key.service.ts`
**Usage**: Injected into controllers/services for advanced validation

**Features**:
- Database validation (future implementation)
- Partner information extraction
- Permission checking
- Usage logging
- Rate limiting support

### 3. Decorators (@ApiKey, @PartnerId)
**Purpose**: Extract authentication data from requests in controllers
**Location**: `src/decorators/api-key.decorator.ts`
**Usage**: Controller method parameters

**Example**:
```typescript
@Post('/api/v1/principal-member')
async createPrincipalMember(
  @Body() dto: CreatePrincipalMemberRequestDto,
  @ApiKey() apiKey: string,        // Extracts validated API key
  @PartnerId() partnerId: string    // Extracts partner ID
) {
  // Use apiKey and partnerId directly
}
```

## Architecture Flow

```
Request → Middleware → Controller → Service
   ↓         ↓           ↓          ↓
x-api-key → Validate → @ApiKey() → Business Logic
```

1. **Request comes in** with `x-api-key` header
2. **Middleware validates** the API key format and adds it to request
3. **Controller uses decorators** to extract the validated data
4. **Service performs** business logic with partner context

## Future Enhancements

### Database Integration
- Store API keys in database with expiration
- Link API keys to partner accounts
- Implement key rotation and revocation

### Advanced Features
- Rate limiting per API key
- Permission-based access control
- Audit logging and analytics
- API key usage monitoring

## Usage Examples

### Basic Controller
```typescript
@Controller('api/v1')
export class PublicApiController {
  @Post('/principal-member')
  async createPrincipalMember(
    @Body() dto: CreatePrincipalMemberRequestDto,
    @ApiKey() apiKey: string,
    @PartnerId() partnerId: string
  ) {
    // API key is already validated by middleware
    // Use partnerId for business logic
    return this.customerService.createCustomer(dto, partnerId);
  }
}
```

### Testing
```bash
# Valid request
curl -H "x-api-key: valid-api-key-12345" \
     -H "Content-Type: application/json" \
     -X POST http://localhost:3000/api/v1/principal-member

# Invalid request (missing API key)
curl -H "Content-Type: application/json" \
     -X POST http://localhost:3000/api/v1/principal-member
# Returns: 401 Unauthorized
```

## Security Considerations

- API keys should be at least 16 characters
- Use HTTPS in production
- Implement key rotation
- Monitor for suspicious activity
- Store keys securely (hashed in database)
