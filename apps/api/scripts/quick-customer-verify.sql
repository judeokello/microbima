-- Quick Customer Verification Script
-- ============================================
-- CONFIGURATION: Replace 'YOUR_CUSTOMER_ID_HERE' with your actual customer UUID
-- ============================================

-- ============================================
-- Verification Report
-- ============================================

-- Show configuration
SELECT 
    '⚙️  CONFIGURATION' AS section,
    'Customer ID: YOUR_CUSTOMER_ID_HERE' AS setting;  -- ⬅️ Replace this value

-- 1. Customer Record
SELECT 
    '1️⃣ Customer Record' AS check_point,
    COUNT(*) AS found,
    CASE WHEN COUNT(*) > 0 THEN '✅' ELSE '❌' END AS status
FROM customers
WHERE id = 'YOUR_CUSTOMER_ID_HERE';  -- ⬅️ Replace this value

-- 2. Partner Customer Relationship
SELECT 
    '2️⃣ Partner-Customer Relationship' AS check_point,
    COUNT(*) AS found,
    CASE WHEN COUNT(*) > 0 THEN '✅' ELSE '❌' END AS status
FROM partner_customers
WHERE "customerId" = 'YOUR_CUSTOMER_ID_HERE';  -- ⬅️ Replace this value

-- 3. Dependants (Children + Spouses)
SELECT 
    '3️⃣ Dependants (Children + Spouses)' AS check_point,
    COUNT(*) AS found,
    CASE WHEN COUNT(*) >= 0 THEN '✅' ELSE '❌' END AS status
FROM dependants
WHERE "customerId" = 'YOUR_CUSTOMER_ID_HERE';  -- ⬅️ Replace this value

-- 4. Beneficiaries
SELECT 
    '4️⃣ Beneficiaries (Next of Kin)' AS check_point,
    COUNT(*) AS found,
    CASE WHEN COUNT(*) >= 0 THEN '✅' ELSE '❌' END AS status
FROM beneficiaries
WHERE "customerId" = 'YOUR_CUSTOMER_ID_HERE';  -- ⬅️ Replace this value

-- 5. Package Scheme Customers (NEW)
SELECT 
    '5️⃣ Package Scheme Customers' AS check_point,
    COUNT(*) AS found,
    CASE WHEN COUNT(*) > 0 THEN '✅' ELSE '⚠️ NOT YET MIGRATED' END AS status
FROM package_scheme_customers
WHERE "customerId" = 'YOUR_CUSTOMER_ID_HERE';  -- ⬅️ Replace this value

-- 6. Detailed Breakdown
SELECT 
    '📊 DETAILED BREAKDOWN' AS section;

-- Count by relationship type
SELECT 
    'Dependants by Type' AS category,
    COALESCE(relationship, 'Unknown') AS type,
    COUNT(*) AS count
FROM dependants
WHERE "customerId" = 'YOUR_CUSTOMER_ID_HERE'  -- ⬅️ Replace this value
GROUP BY relationship;

-- Show all records created for this customer
WITH all_records AS (
    SELECT 'customers' AS table_name, COUNT(*) AS record_count FROM customers WHERE id = 'YOUR_CUSTOMER_ID_HERE'  -- ⬅️ Replace this value
    UNION ALL
    SELECT 'partner_customers', COUNT(*) FROM partner_customers WHERE "customerId" = 'YOUR_CUSTOMER_ID_HERE'  -- ⬅️ Replace this value
    UNION ALL
    SELECT 'dependants', COUNT(*) FROM dependants WHERE "customerId" = 'YOUR_CUSTOMER_ID_HERE'  -- ⬅️ Replace this value
    UNION ALL
    SELECT 'beneficiaries', COUNT(*) FROM beneficiaries WHERE "customerId" = 'YOUR_CUSTOMER_ID_HERE'  -- ⬅️ Replace this value
    UNION ALL
    SELECT 'package_scheme_customers', COUNT(*) FROM package_scheme_customers WHERE "customerId" = 'YOUR_CUSTOMER_ID_HERE'  -- ⬅️ Replace this value
)
SELECT 
    'All Records for Customer' AS summary,
    table_name,
    record_count
FROM all_records
ORDER BY table_name;

-- Customer Details
SELECT 
    'Customer Details' AS section;

SELECT 
    'Customer Information' AS info_type,
    c.id AS customer_id,
    c."firstName" || ' ' || COALESCE(c."middleName" || ' ', '') || c."lastName" AS full_name,
    c.email,
    c."phoneNumber",
    c.status,
    c."createdAt"
FROM customers c
WHERE c.id = 'YOUR_CUSTOMER_ID_HERE';  -- ⬅️ Replace this value

-- Summary
SELECT 
    '✅ VERIFICATION COMPLETE' AS section;