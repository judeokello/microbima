# Bootstrap Brand Ambassador Creation Fix

## Problem
The bootstrap flow was failing at the Brand Ambassador creation step with validation errors:

```
"property userId should not exist"
"email must be an email" 
"password must be a string"
"firstName must be a string"
"lastName must be a string"
"each value in roles must be an array"
```

## Root Cause
The existing Brand Ambassador endpoint (`POST /internal/partner-management/partners/:partnerId/brand-ambassadors`) was designed to **create a new user** in Supabase AND create a Brand Ambassador record. It expected:

- `email`, `password`, `firstName`, `lastName`, `roles` (user creation data)
- `displayName`, `phoneNumber`, `perRegistrationRateCents` (Brand Ambassador data)

But the bootstrap flow already had a user created and was trying to send:
- `userId` (existing user ID)
- `displayName`, `phoneNumber`, `perRegistrationRateCents`

This created a **mismatch** between what the endpoint expected vs. what the bootstrap flow provided.

## Solution
Created a **new dedicated endpoint** for creating Brand Ambassadors from existing users:

### New Endpoint
```
POST /internal/partner-management/partners/:partnerId/brand-ambassadors/from-existing-user
```

### New DTO
```typescript
// CreateBrandAmbassadorFromExistingUserRequestDto
{
  userId: string;                    // UUID of existing user
  displayName: string;               // BA display name
  phoneNumber?: string;              // Optional phone
  perRegistrationRateCents: number;  // Rate in cents
  isActive?: boolean;               // Optional active status
  createdBy?: string;               // Optional creator UUID
}
```

### Service Method
```typescript
async createBrandAmbassadorFromExistingUser(
  partnerId: number,
  brandAmbassadorData: {
    userId: string;
    displayName: string;
    phoneNumber?: string;
    perRegistrationRateCents: number;
    isActive?: boolean;
    createdBy?: string;
  },
  correlationId: string
)
```

## Implementation Details

### 1. Created New DTO
- **File**: `apps/api/src/dto/partner-management/create-brand-ambassador-from-existing-user-request.dto.ts`
- **Purpose**: Validates payload for existing user Brand Ambassador creation
- **Validation**: Uses `@IsUUID()` for `userId`, standard validators for other fields

### 2. Added Service Method
- **File**: `apps/api/src/services/partner-management.service.ts`
- **Method**: `createBrandAmbassadorFromExistingUser()`
- **Features**:
  - Validates partner exists and is active
  - Optionally verifies user exists in Supabase (with graceful fallback)
  - Checks for duplicate Brand Ambassador records
  - Creates Brand Ambassador record with proper audit fields

### 3. Added Controller Endpoint
- **File**: `apps/api/src/controllers/internal/partner-management.controller.ts`
- **Route**: `POST partners/:partnerId/brand-ambassadors/from-existing-user`
- **Features**:
  - Full Swagger documentation
  - Proper error handling and logging
  - Uses existing response DTO for consistency

### 4. Updated Bootstrap Page
- **File**: `apps/agent-registration/src/app/bootstrap/page.tsx`
- **Change**: Updated API call to use new endpoint
- **URL**: Changed from `/brand-ambassadors` to `/brand-ambassadors/from-existing-user`

## Bootstrap Flow (After Fix)
1. ✅ User creates first admin account (Supabase Auth)
2. ✅ Frontend calls `/internal/bootstrap/seed-initial-data` **without auth**
   - Seeds "Maisha Poa" partner (partnerId: 1)
   - Seeds "MfanisiGo" bundled product
3. ✅ Frontend calls `/internal/partner-management/partners/1/brand-ambassadors/from-existing-user` **with auth**
   - Creates Brand Ambassador record for the new user
   - Uses the session token from step 1

## Benefits of This Approach
1. ✅ **Clean API Design**: Separate endpoints for different use cases
2. ✅ **Single Responsibility**: Each endpoint has one clear purpose
3. ✅ **Backward Compatible**: Existing Brand Ambassador creation endpoint unchanged
4. ✅ **Bootstrap Optimized**: New endpoint perfectly fits bootstrap scenario
5. ✅ **Validation**: Proper DTO validation for each use case
6. ✅ **Documentation**: Full Swagger docs for both endpoints

## Files Changed
- ✅ `apps/api/src/dto/partner-management/create-brand-ambassador-from-existing-user-request.dto.ts` (new)
- ✅ `apps/api/src/services/partner-management.service.ts` (added new method)
- ✅ `apps/api/src/controllers/internal/partner-management.controller.ts` (added new endpoint)
- ✅ `apps/agent-registration/src/app/bootstrap/page.tsx` (updated API call)

## Testing
To test the complete bootstrap process:
```bash
# 1. Start services
pnpm dev:all

# 2. Navigate to bootstrap page
# http://localhost:3000/bootstrap

# 3. Create first admin user
# - Email: admin@maishapoa.co.ke
# - Password: (strong password)
# - Display Name: System Administrator

# 4. Verify in logs:
# - "Skipping Supabase auth for bootstrap endpoint"
# - "✅ Seeded Maisha Poa partner"
# - "✅ Seeded MfanisiGo product"
# - "✅ Brand Ambassador created successfully from existing user"
```

## Related Documentation
- `BOOTSTRAP_AUTH_FIX.md` - Authentication exemption fix
- `BOOTSTRAP_SOLUTION_SUMMARY.md` - Complete bootstrap solution overview
- `BOOTSTRAP_TEST_GUIDE.md` - Testing instructions
