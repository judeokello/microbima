-- Idempotent migration script: Copy partner_customers to package_scheme_customers
-- This script migrates existing customer data to the new package scheme structure
-- Run this AFTER the main migration and seed data have been applied
-- Safe to run multiple times (idempotent)

-- Copy all existing partner_customers records to package_scheme_customers
-- All existing customers will be assigned to packageSchemeId = 1 (MfanisiGo -> OOD Drivers)
-- Only inserts records that don't already exist in package_scheme_customers
INSERT INTO "package_scheme_customers" (
    "packageSchemeId",
    "partnerId",
    "customerId",
    "partnerCustomerId",
    "createdAt",
    "updatedAt"
)
SELECT 
    1 as "packageSchemeId",  -- Hardcoded to 1 (MfanisiGo -> OOD Drivers)
    pc."partnerId",
    pc."customerId",
    pc."partnerCustomerId",
    pc."createdAt",
    pc."updatedAt"
FROM "partner_customers" pc
WHERE NOT EXISTS (
    SELECT 1 
    FROM "package_scheme_customers" psc 
    WHERE psc."customerId" = pc."customerId" 
    AND psc."partnerId" = pc."partnerId"
);

-- Verify the migration
-- Uncomment the following lines to check the results:
-- SELECT COUNT(*) as "Total partner_customers" FROM "partner_customers";
-- SELECT COUNT(*) as "Total package_scheme_customers" FROM "package_scheme_customers";
-- SELECT COUNT(*) as "Customers in package scheme 1" FROM "package_scheme_customers" WHERE "packageSchemeId" = 1;

