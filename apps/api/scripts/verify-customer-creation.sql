-- Customer Creation Verification Queries
-- ============================================
-- CONFIGURATION: Replace 'YOUR_CUSTOMER_ID_HERE' with your actual customer UUID
-- Search and replace throughout this file:
--   YOUR_CUSTOMER_ID_HERE → your actual UUID
--   YOUR_PARTNER_ID → your partner ID
-- ============================================

-- ============================================
-- QUERY 1: Check if customer exists
-- ============================================
SELECT 
    '📋 Query 1: Customer Exists Check' AS query_info,
    id,
    "firstName" || ' ' || COALESCE("middleName" || ' ', '') || "lastName" AS full_name,
    email,
    "phoneNumber",
    status,
    "createdAt",
    "createdByPartnerId"
FROM customers
WHERE id = 'YOUR_CUSTOMER_ID_HERE'  -- ⬅️ Replace this value
   OR email = 'customer@example.com'  -- Optional: Replace if searching by email
   OR "phoneNumber" = '1234567890';  -- Optional: Replace if searching by phone

-- ============================================
-- QUERY 2: Check partner_customers table
-- ============================================
SELECT 
    '📋 Query 2: Partner-Customer Relationship' AS query_info,
    pc.id,
    pc."partnerId",
    pc."customerId",
    pc."partnerCustomerId",
    pc."createdAt",
    p."partnerName"
FROM partner_customers pc
JOIN partners p ON pc."partnerId" = p.id
WHERE pc."customerId" = 'YOUR_CUSTOMER_ID_HERE'  -- ⬅️ Replace this value
   OR pc."partnerId" = 0;  -- Optional: Replace with your partner ID

-- ============================================
-- QUERY 3: Check dependants (children and spouses)
-- ============================================
SELECT 
    '📋 Query 3: Dependants' AS query_info,
    d.id,
    d."customerId",
    d."firstName" || ' ' || COALESCE(d."middleName" || ' ', '') || d."lastName" AS full_name,
    d.relationship,
    d.gender,
    d."dateOfBirth",
    d.email,
    d."phoneNumber",
    d."createdAt",
    c."firstName" || ' ' || COALESCE(c."middleName" || ' ', '') || c."lastName" AS parent_customer
FROM dependants d
JOIN customers c ON d."customerId" = c.id
WHERE d."customerId" = 'YOUR_CUSTOMER_ID_HERE'  -- ⬅️ Replace this value
ORDER BY d.relationship, d."createdAt";

-- ============================================
-- QUERY 4: Check beneficiaries
-- ============================================
SELECT 
    '📋 Query 4: Beneficiaries' AS query_info,
    b.id,
    b."customerId",
    b."firstName" || ' ' || COALESCE(b."middleName" || ' ', '') || b."lastName" AS full_name,
    b.relationship,
    b.percentage,
    b."idType",
    b."idNumber",
    b."createdAt",
    c."firstName" || ' ' || COALESCE(c."middleName" || ' ', '') || c."lastName" AS customer_name
FROM beneficiaries b
JOIN customers c ON b."customerId" = c.id
WHERE b."customerId" = 'YOUR_CUSTOMER_ID_HERE'  -- ⬅️ Replace this value
ORDER BY b."createdAt";

-- ============================================
-- QUERY 5: Comprehensive summary
-- ============================================
WITH customer_data AS (
    SELECT 
        c.id,
        c."firstName" || ' ' || COALESCE(c."middleName" || ' ', '') || c."lastName" AS customer_name,
        c.email,
        c."phoneNumber",
        c.status,
        c."createdAt"
    FROM customers c
    WHERE c.id = 'YOUR_CUSTOMER_ID_HERE'  -- ⬅️ Replace this value
)
SELECT 
    '📋 Query 5: Summary' AS query_info,
    'Customer' AS table_name,
    COUNT(*) AS record_count,
    MIN("createdAt") AS earliest_record,
    MAX("createdAt") AS latest_record
FROM customer_data
UNION ALL
SELECT 
    '📋 Query 5: Summary' AS query_info,
    'Partner Customers' AS table_name,
    COUNT(*) AS record_count,
    MIN("createdAt") AS earliest_record,
    MAX("createdAt") AS latest_record
FROM partner_customers
WHERE "customerId" = 'YOUR_CUSTOMER_ID_HERE'  -- ⬅️ Replace this value
UNION ALL
SELECT 
    '📋 Query 5: Summary' AS query_info,
    'Dependants (Total)' AS table_name,
    COUNT(*) AS record_count,
    MIN("createdAt") AS earliest_record,
    MAX("createdAt") AS latest_record
FROM dependants
WHERE "customerId" = 'YOUR_CUSTOMER_ID_HERE'  -- ⬅️ Replace this value
UNION ALL
SELECT 
    '📋 Query 5: Summary' AS query_info,
    'Children' AS table_name,
    COUNT(*) AS record_count,
    MIN("createdAt") AS earliest_record,
    MAX("createdAt") AS latest_record
FROM dependants
WHERE "customerId" = 'YOUR_CUSTOMER_ID_HERE' AND relationship = 'CHILD'  -- ⬅️ Replace this value
UNION ALL
SELECT 
    '📋 Query 5: Summary' AS query_info,
    'Spouses' AS table_name,
    COUNT(*) AS record_count,
    MIN("createdAt") AS earliest_record,
    MAX("createdAt") AS latest_record
FROM dependants
WHERE "customerId" = 'YOUR_CUSTOMER_ID_HERE' AND relationship = 'SPOUSE'  -- ⬅️ Replace this value
UNION ALL
SELECT 
    '📋 Query 5: Summary' AS query_info,
    'Beneficiaries' AS table_name,
    COUNT(*) AS record_count,
    MIN("createdAt") AS earliest_record,
    MAX("createdAt") AS latest_record
FROM beneficiaries
WHERE "customerId" = 'YOUR_CUSTOMER_ID_HERE'  -- ⬅️ Replace this value
ORDER BY table_name;

-- ============================================
-- QUERY 6: Check package_scheme_customers (NEW TABLE)
-- ============================================
SELECT 
    '📋 Query 6: Package Scheme Customers' AS query_info,
    psc.id,
    psc."packageSchemeId",
    psc."partnerId",
    psc."customerId",
    psc."partnerCustomerId",
    psc."createdAt",
    p.name AS "packageName",
    s."schemeName"
FROM package_scheme_customers psc
LEFT JOIN package_schemes ps ON psc."packageSchemeId" = ps.id
LEFT JOIN packages p ON ps."packageId" = p.id
LEFT JOIN schemes s ON ps."schemeId" = s.id
WHERE psc."customerId" = 'YOUR_CUSTOMER_ID_HERE'  -- ⬅️ Replace this value
   OR psc."partnerId" = 0;  -- Optional: Replace with your partner ID

-- ============================================
-- QUERY 7: Find recently created customers (last 10) - NO REPLACEMENT NEEDED
-- ============================================
SELECT 
    '📋 Query 7: Recent Customers' AS query_info,
    c.id,
    c."firstName" || ' ' || COALESCE(c."middleName" || ' ', '') || c."lastName" AS customer_name,
    c.email,
    c."phoneNumber",
    c.status,
    c."createdAt",
    p."partnerName",
    pc."partnerCustomerId",
    (
        SELECT COUNT(*) 
        FROM dependants d 
        WHERE d."customerId" = c.id
    ) AS dependant_count,
    (
        SELECT COUNT(*) 
        FROM beneficiaries b 
        WHERE b."customerId" = c.id
    ) AS beneficiary_count,
    (
        SELECT COUNT(*) 
        FROM package_scheme_customers psc 
        WHERE psc."customerId" = c.id
    ) AS package_scheme_count
FROM customers c
LEFT JOIN partner_customers pc ON c.id = pc."customerId"
LEFT JOIN partners p ON pc."partnerId" = p.id
ORDER BY c."createdAt" DESC
LIMIT 10;

-- ============================================
-- QUERY 8: Check for orphaned or incomplete records - NO REPLACEMENT NEEDED
-- ============================================
SELECT 
    '📋 Query 8a: Customers without partner_customers' AS query_info,
    c.id,
    c."firstName" || ' ' || COALESCE(c."middleName" || ' ', '') || c."lastName" AS customer_name,
    c."createdAt"
FROM customers c
LEFT JOIN partner_customers pc ON c.id = pc."customerId"
WHERE pc.id IS NULL
ORDER BY c."createdAt" DESC;

SELECT 
    '📋 Query 8b: Customers without package_scheme_customers' AS query_info,
    c.id,
    c."firstName" || ' ' || COALESCE(c."middleName" || ' ', '') || c."lastName" AS customer_name,
    c."createdAt"
FROM customers c
LEFT JOIN package_scheme_customers psc ON c.id = psc."customerId"
WHERE psc.id IS NULL
ORDER BY c."createdAt" DESC;