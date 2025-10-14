# Brand Ambassador Registration Page Fix

## Problem
The Brand Ambassador registration page (`/admin/ba-registration`) was failing with a "Bad Request" error when trying to create a new Brand Ambassador. The console logs showed validation errors from the backend API.

## Root Cause
**Missing Required Field**: The frontend was not sending the `displayName` field that the backend DTO requires.

### Frontend Payload (Before Fix)
```typescript
const baData = {
  email: data.email,
  password: data.password,
  firstName: data.firstName,        // ✅ Required
  lastName: data.lastName,          // ✅ Required
  // displayName: MISSING!          // ❌ Required by backend
  roles: data.roles,                // ✅ Required
  phoneNumber: data.phone,          // ✅ Optional
  perRegistrationRateCents: data.perRegistrationRateCents, // ✅ Required
  isActive: true,                   // ✅ Optional
  createdBy: currentUserId          // ✅ Optional
}
```

### Backend DTO Requirements
```typescript
// CreateBrandAmbassadorRequestDto
{
  email: string;                    // ✅ Required
  password: string;                 // ✅ Required  
  firstName: string;                // ✅ Required
  lastName: string;                 // ✅ Required
  displayName: string;              // ❌ MISSING from frontend!
  roles: string[];                  // ✅ Required
  phoneNumber?: string;             // ✅ Optional
  perRegistrationRateCents: number; // ✅ Required
  isActive?: boolean;               // ✅ Optional
  createdBy?: string;               // ✅ Optional
}
```

## Solution
**Added Missing Field**: Updated the frontend to include the `displayName` field by combining `firstName` and `lastName`.

### Frontend Payload (After Fix)
```typescript
const baData = {
  email: data.email,
  password: data.password,
  firstName: data.firstName,        // ✅ Required
  lastName: data.lastName,          // ✅ Required
  displayName: `${data.firstName} ${data.lastName}`.trim(), // ✅ ADDED!
  roles: data.roles,                // ✅ Required
  phoneNumber: data.phone,          // ✅ Optional
  perRegistrationRateCents: data.perRegistrationRateCents, // ✅ Required
  isActive: true,                   // ✅ Optional
  createdBy: currentUserId          // ✅ Optional
}
```

## Endpoint Architecture

### Two Endpoints for Different Use Cases

1. **`POST /internal/partner-management/partners/:partnerId/brand-ambassadors`**
   - **Purpose**: Create both a new user AND a Brand Ambassador record
   - **Use Case**: Admin creating a completely new Brand Ambassador
   - **Payload**: User creation data + Brand Ambassador data
   - **Used by**: `/admin/ba-registration` page

2. **`POST /internal/partner-management/partners/:partnerId/brand-ambassadors/from-existing-user`**
   - **Purpose**: Create Brand Ambassador record for existing user
   - **Use Case**: Bootstrap process after user is already created
   - **Payload**: Existing user ID + Brand Ambassador data
   - **Used by**: Bootstrap process

## Implementation Details

### File Changed
- **File**: `apps/agent-registration/src/lib/api.ts`
- **Function**: `createBrandAmbassador()`
- **Change**: Added `displayName: \`${data.firstName} ${data.lastName}\`.trim()` to payload

### Code Change
```typescript
// Before
const baData = {
  email: data.email,
  password: data.password,
  firstName: data.firstName,
  lastName: data.lastName,
  roles: data.roles,
  // ... other fields
}

// After  
const baData = {
  email: data.email,
  password: data.password,
  firstName: data.firstName,
  lastName: data.lastName,
  displayName: `${data.firstName} ${data.lastName}`.trim(), // ✅ ADDED
  roles: data.roles,
  // ... other fields
}
```

## Why This Approach

### Single Endpoint Design
We kept the **original endpoint** for the BA registration page because:
1. ✅ **Perfect Use Case**: Admin creating a completely new Brand Ambassador
2. ✅ **Atomic Operation**: Creates both user and BA record in one transaction
3. ✅ **Consistent UX**: User fills out one form, everything gets created
4. ✅ **Error Handling**: If user creation fails, no orphaned BA record

### Bootstrap vs Registration
- **Bootstrap**: User already exists → Use `/from-existing-user` endpoint
- **Registration**: Create new user → Use original `/brand-ambassadors` endpoint

## Testing
To test the Brand Ambassador registration:

1. **Navigate to**: `http://localhost:3000/admin/ba-registration`
2. **Fill out the form**:
   - First Name: `John`
   - Last Name: `Doe` 
   - Email: `john.doe@example.com`
   - Password: (strong password)
   - Phone: `+254700000000`
   - Partner: `Maisha Poa`
   - Rate: `500`
   - Roles: `Brand Ambassador`
3. **Submit** and verify:
   - ✅ User created in Supabase
   - ✅ Brand Ambassador record created in database
   - ✅ Success message displayed
   - ✅ Redirect to BA management page

## Related Documentation
- `BOOTSTRAP_BRAND_AMBASSADOR_FIX.md` - Bootstrap endpoint for existing users
- `BOOTSTRAP_AUTH_FIX.md` - Authentication exemption for bootstrap
- `BOOTSTRAP_SOLUTION_SUMMARY.md` - Complete bootstrap solution

## Files Changed
- ✅ `apps/agent-registration/src/lib/api.ts` - Added missing `displayName` field
- This documentation file
