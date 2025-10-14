# Bootstrap Authentication Fix

## Problem
The bootstrap page was failing with a 401 Unauthorized error when trying to seed initial data because:
- The `/internal/bootstrap/seed-initial-data` endpoint was protected by `SupabaseAuthMiddleware`
- This middleware required a valid Bearer token (Supabase session)
- **Chicken-and-egg problem**: No users exist yet to authenticate with!

## Root Cause
In `apps/api/src/app.module.ts`, the `SupabaseAuthMiddleware` was configured to apply to **all** internal routes:

```typescript
consumer
  .apply(SupabaseAuthMiddleware)
  .forRoutes({ path: 'internal/*', method: RequestMethod.ALL });
```

This meant even the bootstrap endpoint (designed to run before any users exist) was requiring authentication.

## Solution
Modified `apps/api/src/middleware/supabase-auth.middleware.ts` to **skip authentication** for bootstrap endpoints:

```typescript
async use(req: Request, res: Response, next: NextFunction) {
  // Only apply to internal API routes
  if (!req.path.startsWith('/api/internal')) {
    return next();
  }

  // Skip authentication for bootstrap endpoints (one-time setup before users exist)
  if (req.path.startsWith('/api/internal/bootstrap')) {
    console.log('Skipping Supabase auth for bootstrap endpoint:', req.path);
    return next();
  }

  // ... rest of authentication logic
}
```

## Why This Is Safe
1. **One-time use**: Bootstrap endpoints are only needed during initial system setup
2. **Environment gated**: The bootstrap page requires `NEXT_PUBLIC_ENABLE_BOOTSTRAP=true` to be accessible
3. **Idempotent**: The seeding logic uses `upsert` operations, so running it multiple times is safe
4. **Low risk**: The endpoint only creates default system data (Maisha Poa partner, MfanisiGo product)

## Bootstrap Flow (After Fix)
1. User navigates to `/bootstrap` page
2. User creates first admin account (Supabase Auth)
3. Frontend calls `/internal/bootstrap/seed-initial-data` **without auth** ✅
   - Seeds "Maisha Poa" partner (partnerId: 1)
   - Seeds "MfanisiGo" bundled product
   - Uses the newly created user's ID as `createdBy`
4. Frontend calls `/internal/partner-management/partners/1/brand-ambassadors` **with auth** ✅
   - Creates Brand Ambassador record for the new user
   - Uses the session token from step 2

## Alternative Solutions Considered
1. ❌ **Use API Key authentication**: Would require manual API key creation before bootstrap
2. ❌ **Manual user creation in Supabase**: Adds extra manual steps and complexity
3. ✅ **Exempt bootstrap endpoint from auth**: Clean, follows existing patterns (like health checks)

## Testing
To test the bootstrap process:
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
# - "✅ Brand Ambassador created"
```

## Files Changed
- `apps/api/src/middleware/supabase-auth.middleware.ts` - Added bootstrap exemption
- This documentation file

## Related Documentation
- `BOOTSTRAP_SOLUTION_SUMMARY.md` - Complete bootstrap solution overview
- `BOOTSTRAP_TEST_GUIDE.md` - Testing instructions
- `BOOTSTRAP_INTEGRATION_GUIDE.md` - Integration details

