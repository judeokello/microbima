-- Seed data for product management tables
-- This script is idempotent and can be run multiple times safely
-- Uses ON CONFLICT DO NOTHING to skip existing records
-- Explicitly sets updatedAt to work around Prisma @updatedAt behavior

-- Seed underwriters (idempotent)
-- Get first user ID for createdBy field
DO $$
DECLARE
    first_user_id TEXT;
BEGIN
    -- Get first user ID from auth.users
    SELECT id INTO first_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;
    
    -- If no user exists, use a placeholder (shouldn't happen in production)
    IF first_user_id IS NULL THEN
        first_user_id := '00000000-0000-0000-0000-000000000000';
        RAISE WARNING 'No users found in auth.users, using placeholder UUID';
    END IF;

    -- Insert underwriters with createdBy and isActive fields
    INSERT INTO "underwriters" ("id", "name", "shortName", "website", "officeLocation", "isActive", "createdBy", "updatedAt") VALUES
    (1, 'Definite Assurance company Ltd', 'Definite', 'https://definiteassurance.com', 'ABSA TOWERS ,1st Floor, Loita Street, Nairobi Kenya', true, first_user_id, CURRENT_TIMESTAMP),
    (2, 'AAR Insurance Limited', 'AAR', 'https://aar-insurance.com', 'Kiambu road', true, first_user_id, CURRENT_TIMESTAMP),
    (3, 'UAP Old Mutual Insurance Ltd', 'UAP-Old Mutual', 'https://www.oldmutual.co.ke/personal/insure/health-insurance/', 'Upper hill', true, first_user_id, CURRENT_TIMESTAMP)
    ON CONFLICT (id) DO NOTHING;
END $$;

-- Seed product types (idempotent)
INSERT INTO "product_types" ("id", "name", "description", "updatedAt") VALUES
(1, 'Medical', 'This contains medical related (sub)products', CURRENT_TIMESTAMP),
(2, 'Hospital Cash', 'This is a cash reimbursement to the customer when they''re unable to work.', CURRENT_TIMESTAMP),
(3, 'Emergency Rescue Services', 'This is a service offered in case of emergencies eg. ambulances, breakdowns etc', CURRENT_TIMESTAMP),
(4, 'Personal accident', 'This is a fixed fee that is paid when a customer is covered for an accident.', CURRENT_TIMESTAMP),
(5, 'Funeral cover', 'This is a fixed fee for covering the cost of a funeral expense', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- Seed products (idempotent)
INSERT INTO "products" ("id", "productTypeId", "productName", "description", "updatedAt") VALUES
(1, 1, 'Medical', 'general medical', CURRENT_TIMESTAMP),
(2, 1, 'Hospital Cash', 'Hospital cash reimbursement', CURRENT_TIMESTAMP),
(3, 1, 'Emergency Ambulance Rescue Services', 'Ambulance service provided by 3rd Parties', CURRENT_TIMESTAMP),
(4, 1, 'Personal accident', 'Cover in case of accident', CURRENT_TIMESTAMP),
(5, 1, 'Funeral cover', 'Coverage for funeral expenses', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- Seed packages (idempotent)
INSERT INTO "packages" ("id", "name", "description", "underwriterId", "updatedAt") VALUES
(1, 'MfanisiGo', 'Product targeting drivers and riders in the logistics space', 1, CURRENT_TIMESTAMP),
(2, 'Mfanisi', 'A product targeted for SMEs', 1, CURRENT_TIMESTAMP),
(3, 'Mzalendo', 'Product that allows customers to pay a monthly fee and select a particular hospital for all treatments', 1, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- Seed package products (idempotent - using composite unique constraint)
INSERT INTO "package_products" ("packageId", "productId") VALUES
(1, 1), -- MfanisiGo -> Medical
(1, 2), -- MfanisiGo -> Hospital Cash
(1, 3), -- MfanisiGo -> Emergency Ambulance Rescue Services
(1, 4)  -- MfanisiGo -> Personal accident
ON CONFLICT ("packageId", "productId") DO NOTHING;

-- Seed schemes (idempotent)
INSERT INTO "schemes" ("id", "schemeName", "description", "updatedAt") VALUES
(1, 'OOD Drivers', 'organization of Online drivers', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- Seed package schemes (idempotent - using composite unique constraint)
INSERT INTO "package_schemes" ("packageId", "schemeId") VALUES
(1, 1) -- MfanisiGo -> OOD Drivers
ON CONFLICT ("packageId", "schemeId") DO NOTHING;

-- Update packages with policy and member number formats (idempotent)
UPDATE "packages" 
SET 
  "policyNumberFormat" = 'MP/MFG/{auto-increasing-policy-number}',
  "memberNumberFormat" = 'MFG{auto-increasing-policy-number}-{auto-increasing-member-number}',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE id = 1;

UPDATE "packages" 
SET 
  "policyNumberFormat" = 'MP/MFS/{auto-increasing-policy-number}',
  "memberNumberFormat" = 'MFS{auto-increasing-policy-number}-{auto-increasing-member-number}',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE id = 2;

UPDATE "packages" 
SET 
  "policyNumberFormat" = 'MP/MZD/{auto-increasing-policy-number}',
  "memberNumberFormat" = 'MZD{auto-increasing-policy-number}-{auto-increasing-member-number}',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE id = 3;

-- Seed package_plans for all three packages (idempotent)
-- MfanisiGo Plans (packageId=1)
INSERT INTO "package_plans" ("name", "description", "packageId", "isActive", "createdBy", "updatedBy", "updatedAt") 
VALUES ('Silver', 'the silver plan', 1, true,
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1),
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1),
  CURRENT_TIMESTAMP)
ON CONFLICT ("packageId", "name") DO NOTHING;

INSERT INTO "package_plans" ("name", "description", "packageId", "isActive", "createdBy", "updatedBy", "updatedAt") 
VALUES ('Gold', 'the Gold plan', 1, true,
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1),
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1),
  CURRENT_TIMESTAMP)
ON CONFLICT ("packageId", "name") DO NOTHING;

-- Mfanisi Plans (packageId=2)
INSERT INTO "package_plans" ("name", "description", "packageId", "isActive", "createdBy", "updatedBy", "updatedAt") 
VALUES ('Silver', 'the silver plan', 2, true,
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1),
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1),
  CURRENT_TIMESTAMP)
ON CONFLICT ("packageId", "name") DO NOTHING;

INSERT INTO "package_plans" ("name", "description", "packageId", "isActive", "createdBy", "updatedBy", "updatedAt") 
VALUES ('Gold', 'the Gold plan', 2, true,
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1),
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1),
  CURRENT_TIMESTAMP)
ON CONFLICT ("packageId", "name") DO NOTHING;

-- Mzalendo Plans (packageId=3)
INSERT INTO "package_plans" ("name", "description", "packageId", "isActive", "createdBy", "updatedBy", "updatedAt") 
VALUES ('Silver', 'the silver plan', 3, true,
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1),
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1),
  CURRENT_TIMESTAMP)
ON CONFLICT ("packageId", "name") DO NOTHING;

INSERT INTO "package_plans" ("name", "description", "packageId", "isActive", "createdBy", "updatedBy", "updatedAt") 
VALUES ('Gold', 'the Gold plan', 3, true,
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1),
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1),
  CURRENT_TIMESTAMP)
ON CONFLICT ("packageId", "name") DO NOTHING;

