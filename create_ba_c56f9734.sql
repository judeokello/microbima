-- ============================================
-- CREATE BRAND AMBASSADOR
-- Date: 2025-10-11
-- User ID: c56f9734-736e-4ef0-a7ef-709f554ecd7e
-- Description: Clean up incorrect data, then create brand ambassador with correct metadata
-- ============================================

-- Step 0: CLEANUP - Delete incorrect brand ambassador entry if it exists
DELETE FROM brand_ambassadors
WHERE "userId" = 'c56f9734-736e-4ef0-a7ef-709f554ecd7e';

-- Verify deletion
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'Successfully deleted old brand ambassador record'
        ELSE 'Warning: Brand ambassador record still exists'
    END as cleanup_status
FROM brand_ambassadors
WHERE "userId" = 'c56f9734-736e-4ef0-a7ef-709f554ecd7e';

-- Step 1: Update user metadata with correct structure
-- Note: This matches the structure of working BA users
UPDATE auth.users
SET raw_user_meta_data = jsonb_build_object(
    'sub', id::text,
    'email', email,
    'roles', jsonb_build_array('brand_ambassador'),
    'displayName', 'Brand Ambassador',  -- CUSTOMIZE THIS
    'email_verified', CASE WHEN email_confirmed_at IS NOT NULL THEN true ELSE false END,
    'phone_verified', CASE WHEN phone_confirmed_at IS NOT NULL THEN true ELSE false END
)
WHERE id = 'c56f9734-736e-4ef0-a7ef-709f554ecd7e';

-- Alternative: If you want to ADD brand_ambassador to existing roles array
-- UPDATE auth.users
-- SET raw_user_meta_data = jsonb_set(
--     COALESCE(raw_user_meta_data, '{}'::jsonb),
--     '{roles}',
--     COALESCE(raw_user_meta_data->'roles', '[]'::jsonb) || '["brand_ambassador"]'::jsonb
-- )
-- WHERE id = 'c56f9734-736e-4ef0-a7ef-709f554ecd7e';

-- Alternative: If you want to add multiple roles (e.g., both registration_admin and brand_ambassador)
-- UPDATE auth.users
-- SET raw_user_meta_data = jsonb_build_object(
--     'sub', id::text,
--     'email', email,
--     'roles', jsonb_build_array('registration_admin', 'brand_ambassador'),
--     'displayName', 'Brand Ambassador Name',
--     'email_verified', CASE WHEN email_confirmed_at IS NOT NULL THEN true ELSE false END,
--     'phone_verified', CASE WHEN phone_confirmed_at IS NOT NULL THEN true ELSE false END
-- )
-- WHERE id = 'c56f9734-736e-4ef0-a7ef-709f554ecd7e';

-- Step 2: Create brand ambassador entry
INSERT INTO brand_ambassadors (
    "id",
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
    gen_random_uuid(),                              -- id (auto-generated UUID)
    'c56f9734-736e-4ef0-a7ef-709f554ecd7e',        -- userId (Supabase user ID)
    1,                                              -- partnerId (adjust if needed)
    'Brand Ambassador',                             -- displayName (customize as needed)
    '254700000000',                                 -- phoneNumber (customize as needed)
    500,                                            -- perRegistrationRateCents (500 = 5.00 KES)
    true,                                           -- isActive
    CURRENT_TIMESTAMP,                              -- createdAt
    CURRENT_TIMESTAMP,                              -- updatedAt
    'c56f9734-736e-4ef0-a7ef-709f554ecd7e',        -- createdBy
    'c56f9734-736e-4ef0-a7ef-709f554ecd7e'         -- updatedBy
);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify user metadata update
SELECT 
    id,
    email,
    raw_user_meta_data,
    created_at
FROM auth.users 
WHERE id = 'c56f9734-736e-4ef0-a7ef-709f554ecd7e';

-- Verify brand ambassador creation
SELECT 
    ba.id,
    ba."userId",
    ba."partnerId",
    ba."displayName",
    ba."phoneNumber",
    ba."perRegistrationRateCents",
    ba."isActive",
    ba."createdAt",
    p."partnerName"
FROM brand_ambassadors ba
JOIN partners p ON ba."partnerId" = p.id
WHERE ba."userId" = 'c56f9734-736e-4ef0-a7ef-709f554ecd7e';

-- Check available partners (to verify partnerId exists)
SELECT id, "partnerName", "isActive" FROM partners ORDER BY id;

