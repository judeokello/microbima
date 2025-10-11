-- ============================================
-- CREATE BRAND AMBASSADOR
-- Date: 2025-01-15
-- Description: Create brand ambassador for user 81541faf-1ca7-4f51-ad37-beb70a0066d2
-- ============================================

INSERT INTO brand_ambassadors (
    "id",
    "userId", 
    "partnerId",
    "displayName",
    "phoneNumber",
    "perRegistrationRateCents",
    "isActive",
    "createdAt",
    "updatedAt"
) VALUES (
    gen_random_uuid(),                           -- id (auto-generated UUID)
    '81541faf-1ca7-4f51-ad37-beb70a0066d2',     -- userId (Supabase user ID)
    1,                                           -- partnerId (Maisha Poa)
    'MP Main Ambassador',                        -- displayName
    '254700000000',                              -- phoneNumber (optional, using placeholder)
    500,                                         -- perRegistrationRateCents (500 = 5.00 KES)
    true,                                        -- isActive
    CURRENT_TIMESTAMP,                           -- createdAt
    CURRENT_TIMESTAMP                            -- updatedAt
);

-- Verify the insertion
SELECT 
    id,
    "userId",
    "partnerId", 
    "displayName",
    "phoneNumber",
    "perRegistrationRateCents",
    "isActive",
    "createdAt"
FROM brand_ambassadors 
WHERE "userId" = '81541faf-1ca7-4f51-ad37-beb70a0066d2';
