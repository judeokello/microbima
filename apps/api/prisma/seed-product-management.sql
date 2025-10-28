-- Seed data for product management tables
-- This script should be run after the migration

-- Seed underwriters
INSERT INTO "underwriters" ("name", "shortName", "website", "officeLocation") VALUES
('Definite Assurance company Ltd', 'Definite', 'https://definiteassurance.com', 'ABSA TOWERS ,1st Floor, Loita Street, Nairobi Kenya'),
('AAR Insurance Limited', 'AAR', 'https://aar-insurance.com', 'Kiambu road'),
('UAP Old Mutual Insurance Ltd', 'UAP-Old Mutual', 'https://www.oldmutual.co.ke/personal/insure/health-insurance/', 'Upper hill');

-- Seed product types
INSERT INTO "product_types" ("name", "description") VALUES
('Medical', 'This contains medical related (sub)products'),
('Hospital Cash', 'This is a cash reimbursement to the customer when they''re unable to work.'),
('Emergency Rescue Services', 'This is a service offered in case of emergencies eg. ambulances, breakdowns etc'),
('Personal accident', 'This is a fixed fee that is paid when a customer is covered for an accident.'),
('Funeral cover', 'This is a fixed fee for covering the cost of a funeral expense');

-- Seed products
INSERT INTO "products" ("productTypeId", "productName", "description") VALUES
(1, 'Medical', 'general medical'),
(1, 'Hospital Cash', 'Hospital cash reimbursement'),
(1, 'Emergency Ambulance Rescue Services', 'Ambulance service provided by 3rd Parties'),
(1, 'Personal accident', 'Cover in case of accident'),
(1, 'Funeral cover', 'Coverage for funeral expenses');

-- Seed packages
INSERT INTO "packages" ("name", "description", "underwriterId") VALUES
('MfanisiGo', 'Product targeting drivers and riders in the logistics space', 1),
('Mfanisi', 'A product targeted for SMEs', 1),
('Mzalendo', 'Product that allows customers to pay a monthly fee and select a particular hospital for all treatments', 1);

-- Seed package products (linking packages to products)
INSERT INTO "package_products" ("packageId", "productId") VALUES
(1, 1), -- MfanisiGo -> Medical
(1, 2), -- MfanisiGo -> Hospital Cash
(1, 3), -- MfanisiGo -> Emergency Ambulance Rescue Services
(1, 4); -- MfanisiGo -> Personal accident

-- Seed schemes
INSERT INTO "schemes" ("schemeName", "description") VALUES
('OOD Drivers', 'organization of Online drivers');

-- Seed package schemes (linking packages to schemes)
INSERT INTO "package_schemes" ("packageId", "schemeId") VALUES
(1, 1); -- MfanisiGo -> OOD Drivers

