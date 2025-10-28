-- Test script to verify package_scheme_customers insertion
-- This verifies that the customer creation now includes package scheme customers

-- First, let's check if we have the required package_scheme (packageSchemeId = 1)
SELECT 
    'Checking Required Data' AS test,
    COUNT(*) AS package_scheme_count,
    CASE WHEN COUNT(*) > 0 THEN '✅ Package Scheme 1 exists' ELSE '❌ MISSING Package Scheme 1' END AS status
FROM package_schemes
WHERE "packageId" = 1 AND "schemeId" = 1;

-- Let's see what package schemes we have
SELECT 
    'Available Package Schemes' AS info,
    ps.id AS package_scheme_id,
    p.name AS package_name,
    s."schemeName" AS scheme_name
FROM package_schemes ps
JOIN packages p ON ps."packageId" = p.id
JOIN schemes s ON ps."schemeId" = s.id;

-- Check if there are any records in package_scheme_customers
SELECT 
    'Current package_scheme_customers Records' AS info,
    COUNT(*) AS total_records
FROM package_scheme_customers;

-- If there are no records, this explains why customer creation isn't working
-- The migration script needs to be run first to create the initial data

