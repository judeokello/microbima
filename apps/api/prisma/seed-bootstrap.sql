-- ============================================
-- POST-BOOTSTRAP SEED SCRIPT
-- ============================================
-- This script should be run AFTER creating the bootstrap user
-- It seeds essential data that requires a createdBy user reference
--
-- Usage:
--   1. Create bootstrap user in auth.users
--   2. Run this script with the user's UUID
--   3. Or run via: psql -f seed-bootstrap.sql
-- ============================================

-- Seed Maisha Poa partner (using first user from auth.users for createdBy)
INSERT INTO "partners" ("id", "partnerName", "website", "officeLocation", "isActive", "createdAt", "updatedAt", "createdBy")
SELECT 
    1 AS id,
    'Maisha Poa' AS "partnerName",
    'www.maishapoa.co.ke' AS website,
    'Lotus Plaza, Parklands, Nairobi' AS "officeLocation",
    true AS "isActive",
    CURRENT_TIMESTAMP AS "createdAt",
    CURRENT_TIMESTAMP AS "updatedAt",
    (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1) AS "createdBy"
WHERE NOT EXISTS (
    SELECT 1 FROM "partners" WHERE id = 1
);

-- Seed MfanisiGo bundled product
INSERT INTO "bundled_products" ("name", "description", "created_by")
SELECT 
    'MfanisiGo' AS name,
    'Owned by the OOD drivers' AS description,
    (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1) AS created_by
WHERE NOT EXISTS (
    SELECT 1 FROM "bundled_products" WHERE "name" = 'MfanisiGo'
);

-- Verification
DO $$
DECLARE
    v_partner_count INTEGER;
    v_product_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_partner_count FROM "partners" WHERE id = 1;
    SELECT COUNT(*) INTO v_product_count FROM "bundled_products" WHERE name = 'MfanisiGo';
    
    IF v_partner_count > 0 THEN
        RAISE NOTICE '✓ Maisha Poa partner seeded successfully';
    ELSE
        RAISE WARNING '✗ Maisha Poa partner not created';
    END IF;
    
    IF v_product_count > 0 THEN
        RAISE NOTICE '✓ MfanisiGo product seeded successfully';
    ELSE
        RAISE WARNING '✗ MfanisiGo product not created';
    END IF;
END $$;

