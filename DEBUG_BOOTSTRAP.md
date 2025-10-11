# Bootstrap Page Debugging Guide

## Potential Issues and Solutions

### 1. **Environment Variables Not Set Properly**

The bootstrap page might be failing because environment variables aren't properly configured in the staging deployment.

**Check:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` 
- `NEXT_PUBLIC_ENABLE_BOOTSTRAP`

### 2. **Supabase Client Configuration**

The Supabase client might be using fallback values instead of real credentials.

**Debug Steps:**

1. **Open Browser Developer Tools** (F12)
2. **Go to Console tab**
3. **Try to submit the bootstrap form**
4. **Look for errors like:**
   - `Supabase client not initialized`
   - `Invalid Supabase URL`
   - `Authentication failed`
   - `Network errors`

### 3. **API Connectivity Issues**

The bootstrap page tries to create a Brand Ambassador via API call.

**Test the API endpoint manually:**

```bash
# Test if partner exists
curl "https://microbima-staging-internal-api.fly.dev/api/internal/partner-management/partners/1" \
  -H "Authorization: Bearer test"

# Expected: Should return partner data or 401 error
```

### 4. **Database Schema Issues**

Even though you created the partner, there might be missing foreign key constraints.

**Check in Supabase SQL Editor:**

```sql
-- Verify partner exists
SELECT * FROM partners WHERE id = 1;

-- Check if brand_ambassadors table exists
SELECT * FROM brand_ambassadors LIMIT 1;

-- Check foreign key constraints
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name='brand_ambassadors';
```

### 5. **Browser Console Debugging**

**Steps to debug in browser:**

1. **Open** `https://maishapoa-staging-agent-registration.fly.dev/bootstrap`
2. **Press F12** to open Developer Tools
3. **Go to Console tab**
4. **Fill out the form and submit**
5. **Look for any error messages**

**Common errors to look for:**
- `process.env.NEXT_PUBLIC_ENABLE_BOOTSTRAP !== 'true'`
- `Supabase auth signUp failed`
- `API call to create Brand Ambassador failed`
- `Network error` or `CORS error`

### 6. **Manual Testing Steps**

**Test Supabase connection:**

```javascript
// In browser console, test if Supabase is working:
console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('Bootstrap enabled:', process.env.NEXT_PUBLIC_ENABLE_BOOTSTRAP);

// Test Supabase client
const { data, error } = await supabase.auth.signUp({
  email: 'test@example.com',
  password: 'testpassword123'
});
console.log('SignUp test:', { data, error });
```

### 7. **Alternative: Create User Manually**

If bootstrap continues to fail, you can create the user manually:

**In Supabase SQL Editor:**

```sql
-- Create user manually in auth.users (if needed)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_user_meta_data
) VALUES (
  '00000000-0000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated', 
  'admin@example.com',
  crypt('yourpassword', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"roles": ["registration_admin", "brand_ambassador"], "displayName": "Admin User"}'
);

-- Then create Brand Ambassador record
INSERT INTO brand_ambassadors (
  "userId",
  "partnerId", 
  "displayName",
  "phoneNumber",
  "perRegistrationRateCents",
  "isActive"
) VALUES (
  (SELECT id FROM auth.users WHERE email = 'admin@example.com'),
  1,
  'Admin User',
  '+254700000000',
  500,
  true
);
```

## Next Steps

1. **Check browser console** for errors when submitting the form
2. **Verify environment variables** are set correctly
3. **Test Supabase connection** manually
4. **Check database constraints** are properly set up
5. **If all else fails**, create the user manually using SQL

## Quick Test

Try this in your browser console on the bootstrap page:

```javascript
// Check if environment variables are set
console.log({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  bootstrapEnabled: process.env.NEXT_PUBLIC_ENABLE_BOOTSTRAP,
  apiBaseUrl: process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL
});
```
