-- ============================================
-- CREATE TEST BRAND AMBASSADOR
-- Date: 2025-10-11
-- Description: Creates a test BA with verified email
-- ============================================

-- Step 1: Create user in auth.users (Supabase)
-- Note: You'll need to run this in your Supabase SQL editor or psql
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    invited_at,
    confirmation_token,
    confirmation_sent_at,
    recovery_token,
    recovery_sent_at,
    email_change_token_new,
    email_change,
    email_change_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    phone,
    phone_confirmed_at,
    phone_change,
    phone_change_token,
    phone_change_sent_at,
    email_change_token_current,
    email_change_confirm_status,
    banned_until,
    reauthentication_token,
    reauthentication_sent_at,
    is_sso_user,
    deleted_at,
    is_anonymous
) VALUES (
    '00000000-0000-0000-0000-000000000000', -- instance_id
    gen_random_uuid(), -- id (will be used in brand_ambassadors table)
    'authenticated', -- aud
    'authenticated', -- role
    'test.ba@microbima.com', -- email
    crypt('password123', gen_salt('bf')), -- encrypted_password
    NOW(), -- email_confirmed_at (verified email)
    NULL, -- invited_at
    '', -- confirmation_token
    NULL, -- confirmation_sent_at
    '', -- recovery_token
    NULL, -- recovery_sent_at
    '', -- email_change_token_new
    '', -- email_change
    NULL, -- email_change_sent_at
    NULL, -- last_sign_in_at
    '{"provider": "email", "providers": ["email"]}', -- raw_app_meta_data
    '{"roles": ["brand_ambassador"], "partnerId": 1, "displayName": "Test BA", "phone": "+254700000001", "perRegistrationRateCents": 500}', -- raw_user_meta_data
    false, -- is_super_admin
    NOW(), -- created_at
    NOW(), -- updated_at
    NULL, -- phone
    NULL, -- phone_confirmed_at
    '', -- phone_change
    '', -- phone_change_token
    NULL, -- phone_change_sent_at
    '', -- email_change_token_current
    0, -- email_change_confirm_status
    NULL, -- banned_until
    '', -- reauthentication_token
    NULL, -- reauthentication_sent_at
    false, -- is_sso_user
    NULL, -- deleted_at
    false -- is_anonymous
);

-- Step 2: Get the user ID (you'll need to replace this with the actual UUID from step 1)
-- First, let's find the user ID we just created
DO $$
DECLARE
    user_uuid UUID;
BEGIN
    -- Get the user ID
    SELECT id INTO user_uuid FROM auth.users WHERE email = 'test.ba@microbima.com';
    
    -- Insert into brand_ambassadors table
    INSERT INTO brand_ambassadors (
        id,
        "userId",
        "partnerId",
        "displayName",
        "phoneNumber",
        "perRegistrationRateCents",
        "isActive",
        "createdAt",
        "updatedAt",
        "createdBy",
        "updatedBy"
    ) VALUES (
        gen_random_uuid(), -- id
        user_uuid, -- userId (from auth.users)
        1, -- partnerId (assuming partner with ID 1 exists)
        'Test BA', -- displayName
        '+254700000001', -- phoneNumber
        500, -- perRegistrationRateCents (5.00 KES)
        true, -- isActive
        NOW(), -- createdAt
        NOW(), -- updatedAt
        user_uuid, -- createdBy (same as userId for this test)
        user_uuid -- updatedBy (same as userId for this test)
    );
    
    RAISE NOTICE 'Brand Ambassador created successfully for user: %', user_uuid;
END $$;

-- ============================================
-- ALTERNATIVE: Manual approach if the above doesn't work
-- ============================================

-- If you prefer to do this manually:
-- 1. First, create the user in auth.users and note the UUID
-- 2. Then run this insert with the actual UUID:

/*
INSERT INTO brand_ambassadors (
    id,
    "userId",
    "partnerId", 
    "displayName",
    "phoneNumber",
    "perRegistrationRateCents",
    "isActive",
    "createdAt",
    "updatedAt",
    "createdBy",
    "updatedBy"
) VALUES (
    gen_random_uuid(),
    'REPLACE_WITH_ACTUAL_USER_UUID', -- Replace with the UUID from auth.users
    1, -- Make sure this partner ID exists in your partners table
    'Test BA',
    '+254700000001',
    500,
    true,
    NOW(),
    NOW(),
    'REPLACE_WITH_ACTUAL_USER_UUID', -- Replace with the UUID from auth.users
    'REPLACE_WITH_ACTUAL_USER_UUID' -- Replace with the UUID from auth.users
);
*/

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check if the user was created
SELECT id, email, email_confirmed_at, raw_user_meta_data, created_at 
FROM auth.users 
WHERE email = 'test.ba@microbima.com';

-- Check if the brand ambassador was created
SELECT 
    ba.id,
    ba."displayName",
    ba."phoneNumber",
    ba."perRegistrationRateCents",
    ba."isActive",
    ba."createdAt",
    p."partnerName"
FROM brand_ambassadors ba
JOIN partners p ON ba."partnerId" = p.id
WHERE ba."displayName" = 'Test BA';

-- Check if partner with ID 1 exists
SELECT id, "partnerName", "isActive" FROM partners WHERE id = 1;
