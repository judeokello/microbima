-- Seed data for product management tables
-- This script is idempotent and can be run multiple times safely
-- Uses ON CONFLICT DO NOTHING to skip existing records
-- Explicitly sets updatedAt to work around Prisma @updatedAt behavior

-- Seed underwriters (idempotent)
INSERT INTO "underwriters" ("id", "name", "shortName", "website", "officeLocation", "updatedAt") VALUES
(1, 'Definite Assurance company Ltd', 'Definite', 'https://definiteassurance.com', 'ABSA TOWERS ,1st Floor, Loita Street, Nairobi Kenya', CURRENT_TIMESTAMP),
(2, 'AAR Insurance Limited', 'AAR', 'https://aar-insurance.com', 'Kiambu road', CURRENT_TIMESTAMP),
(3, 'UAP Old Mutual Insurance Ltd', 'UAP-Old Mutual', 'https://www.oldmutual.co.ke/personal/insure/health-insurance/', 'Upper hill', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

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

