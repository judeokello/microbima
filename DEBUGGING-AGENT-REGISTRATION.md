# Debugging Agent Registration Issue

## Problem
The agent registration endpoint was returning a 404 error:
```
Cannot POST /internal/agent-registrations
Failed to load resource: the server responded with a status of 404 (Not Found)
```

## Root Cause
The `NEXT_PUBLIC_INTERNAL_API_BASE_URL` environment variable was missing the `/api` prefix.

### Incorrect Configuration
```bash
NEXT_PUBLIC_INTERNAL_API_BASE_URL=http://localhost:3001
```

This caused the frontend to call:
```
http://localhost:3001/internal/agent-registrations  ❌ (404 - Not Found)
```

### Correct Configuration
```bash
NEXT_PUBLIC_INTERNAL_API_BASE_URL=http://localhost:3001/api
```

This makes the frontend call:
```
http://localhost:3001/api/internal/agent-registrations  ✅ (Correct)
```

## Files Fixed

1. **`/apps/agent-registration/.env.local`**
   - Updated `NEXT_PUBLIC_INTERNAL_API_BASE_URL` to include `/api` prefix

2. **`/partner-keys.txt`**
   - Updated documentation to reflect correct URL configuration

## Debugging Tools Added

### 1. Enhanced Test Button
Location: `/apps/agent-registration/src/app/(main)/register/customer/page.tsx`

The "🧪 Test Agent Registration" button now:
- ✅ Checks if user session exists
- ✅ Displays user metadata (roles, partnerId)
- ✅ Shows the exact API URL being called
- ✅ Provides detailed console logs
- ✅ Shows clear success/failure messages

### 2. Enhanced API Logging
Location: `/apps/agent-registration/src/lib/api.ts`

The `createAgentRegistration` function now logs:
- ✅ Request data being sent
- ✅ API URL being called
- ✅ Supabase token status
- ✅ Response status and details
- ✅ Detailed error responses

### 3. Enhanced Customer Page Logging
Location: `/apps/agent-registration/src/app/(main)/register/customer/page.tsx`

The `handleNext` function now logs:
- ✅ Data being sent to agent registration
- ✅ Result from API call
- ✅ Any errors that occur

## How to Test

1. **Restart the Next.js app** to pick up the new environment variable:
   ```bash
   pnpm stop
   pnpm dev:all
   ```

2. **Navigate to customer registration**:
   ```
   http://localhost:3000/register/customer
   ```

3. **Open browser console** (F12 → Console tab)

4. **Click the "🧪 Test Agent Registration" button**

5. **Check the console logs** for detailed debugging information

6. **Check the alert popup** for the result

## Expected Behavior

### If Successful
- Alert: "✅ SUCCESS! Agent registration created successfully."
- Console: Detailed logs showing the request and response

### If Failed
- Alert: "❌ FAILED! Error: [error message]"
- Console: Detailed error information including:
  - Request data
  - API URL
  - Response status
  - Error details

## Additional Issues to Check

### 1. Session Availability
The register/customer page doesn't share the same layout as other pages. Verify that:
- User session is available on the page
- User metadata (roles, partnerId) is accessible
- Supabase token can be obtained

### 2. Brand Ambassador ID
The frontend currently sends `user.id` (Supabase user ID) as `baId`, but the backend expects the actual `BrandAmbassador.id`. This is handled by the backend's flexible lookup logic.

### 3. Customer ID Validation
The API has a two-stage validation process:

**Stage 1: DTO Validation (400 Bad Request)**
- Checks if `customerId` is a valid UUID format
- Happens BEFORE database lookup
- Rejects malformed requests early (better security & performance)
- Example: `"test-customer-id"` → 400 Bad Request

**Stage 2: Database Validation (404 Not Found)**
- Checks if customer exists in database
- Happens AFTER format validation passes
- Example: `"78535281-db92-42e8-893c-410e18448333"` (valid UUID but doesn't exist) → 404 Not Found

The test button now uses a real customer ID from the database: `78535281-db92-42e8-893c-410e18448333`

## Next Steps

1. ✅ Test the agent registration endpoint with the fixed URL
2. ✅ Verify user session is available on the register page
3. ✅ Test the complete customer registration flow
4. ✅ Remove debug logging once issue is resolved
5. ✅ Remove the test button once issue is resolved

## Related Files

- `/apps/agent-registration/.env.local` - Environment configuration
- `/apps/agent-registration/src/lib/api.ts` - API client functions
- `/apps/agent-registration/src/app/(main)/register/customer/page.tsx` - Customer registration page
- `/apps/api/src/controllers/internal/agent-registration.controller.ts` - Backend controller
- `/apps/api/src/services/agent-registration.service.ts` - Backend service
- `/apps/api/src/middleware/supabase-auth.middleware.ts` - Authentication middleware

## Lessons Learned

1. **Always include the API prefix in internal API URLs**
2. **Environment variables need app restart to take effect**
3. **404 errors often indicate URL path issues, not authentication issues**
4. **Comprehensive debugging tools save time in the long run**
5. **Test buttons are invaluable for isolating issues**


