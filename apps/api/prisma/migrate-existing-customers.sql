-- One-time migration script: Copy partner_customers to package_scheme_customers
-- This script migrates existing customer data to the new package scheme structure
-- Run this AFTER the main migration and seed data have been applied

-- Copy all existing partner_customers records to package_scheme_customers
-- All existing customers will be assigned to packageSchemeId = 1 (MfanisiGo -> OOD Drivers)
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
    "partnerId",
    "customerId",
    "partnerCustomerId",
    "createdAt",
    "updatedAt"
FROM "partner_customers";

-- Verify the migration
-- Uncomment the following lines to check the results:
-- SELECT COUNT(*) as "Total partner_customers" FROM "partner_customers";
-- SELECT COUNT(*) as "Total package_scheme_customers" FROM "package_scheme_customers";
-- SELECT COUNT(*) as "Customers in package scheme 1" FROM "package_scheme_customers" WHERE "packageSchemeId" = 1;
