-- Delete Specific Customers by IDs
-- ============================================
-- CONFIGURATION: Set your customer IDs here (comma-separated)
-- ============================================
-- Replace the UUIDs below with your actual customer IDs

-- Example: 'customer-id-1', 'customer-id-2', 'customer-id-3'
-- Use this temporary table approach for PostgreSQL compatibility
CREATE TEMP TABLE IF NOT EXISTS customers_to_delete (
    customer_id UUID
);

-- Clear the temp table first
TRUNCATE TABLE customers_to_delete;

-- Insert the customer IDs you want to delete
INSERT INTO customers_to_delete (customer_id) VALUES
('YOUR_CUSTOMER_ID_1'),  -- ⬅️ Replace with actual UUID
('YOUR_CUSTOMER_ID_2'),  -- ⬅️ Replace with actual UUID
('YOUR_CUSTOMER_ID_3');  -- ⬅️ Replace with actual UUID
-- Add more as needed, or remove lines you don't need

-- ============================================
-- Preview what will be deleted
-- ============================================
SELECT 
    '⚠️  PREVIEW: Records that will be deleted' AS warning;

SELECT 
    'Customers' AS table_name,
    COUNT(*) AS records_to_delete
FROM customers c
WHERE c.id IN (SELECT customer_id FROM customers_to_delete)
UNION ALL
SELECT 
    'Partner Customers' AS table_name,
    COUNT(*) AS records_to_delete
FROM partner_customers pc
WHERE pc."customerId" IN (SELECT customer_id FROM customers_to_delete)
UNION ALL
SELECT 
    'Package Scheme Customers' AS table_name,
    COUNT(*) AS records_to_delete
FROM package_scheme_customers psc
WHERE psc."customerId" IN (SELECT customer_id FROM customers_to_delete)
UNION ALL
SELECT 
    'Dependants' AS table_name,
    COUNT(*) AS records_to_delete
FROM dependants d
WHERE d."customerId" IN (SELECT customer_id FROM customers_to_delete)
UNION ALL
SELECT 
    'Beneficiaries' AS table_name,
    COUNT(*) AS records_to_delete
FROM beneficiaries b
WHERE b."customerId" IN (SELECT customer_id FROM customers_to_delete)
UNION ALL
SELECT 
    'Agent Registrations' AS table_name,
    COUNT(*) AS records_to_delete
FROM agent_registrations ar
WHERE ar."customerId" IN (SELECT customer_id FROM customers_to_delete)
UNION ALL
SELECT 
    'Missing Requirements' AS table_name,
    COUNT(*) AS records_to_delete
FROM missing_requirements mr
WHERE mr."customerId" IN (SELECT customer_id FROM customers_to_delete);

-- Show customer details before deletion
SELECT 
    '📋 Customer Details Before Deletion' AS info;

SELECT 
    c.id,
    c."firstName" || ' ' || COALESCE(c."middleName" || ' ', '') || c."lastName" AS full_name,
    c.email,
    c."phoneNumber",
    c.status,
    c."createdAt"
FROM customers c
WHERE c.id IN (SELECT customer_id FROM customers_to_delete);

-- ============================================
-- DELETION (Uncomment to execute)
-- WARNING: This is IRREVERSIBLE!
-- ============================================

-- 1. Delete missing requirements
-- DELETE FROM missing_requirements 
-- WHERE "customerId" IN (SELECT customer_id FROM customers_to_delete);

-- 2. Delete BA payouts related to these customers' registrations
-- DELETE FROM ba_payouts 
-- WHERE "registrationId" IN (
--     SELECT id FROM agent_registrations 
--     WHERE "customerId" IN (SELECT customer_id FROM customers_to_delete)
-- );

-- 3. Delete agent registrations
-- DELETE FROM agent_registrations 
-- WHERE "customerId" IN (SELECT customer_id FROM customers_to_delete);

-- 4. Delete beneficiaries
-- DELETE FROM beneficiaries 
-- WHERE "customerId" IN (SELECT customer_id FROM customers_to_delete);

-- 5. Delete dependants
-- DELETE FROM dependants 
-- WHERE "customerId" IN (SELECT customer_id FROM customers_to_delete);

-- 6. Delete package scheme customers
-- DELETE FROM package_scheme_customers 
-- WHERE "customerId" IN (SELECT customer_id FROM customers_to_delete);

-- 7. Delete partner customers
-- DELETE FROM partner_customers 
-- WHERE "customerId" IN (SELECT customer_id FROM customers_to_delete);

-- 8. Delete addresses
-- DELETE FROM addresses 
-- WHERE "customerId" IN (SELECT customer_id FROM customers_to_delete);

-- 9. Delete onboarding progress
-- DELETE FROM onboarding_progress 
-- WHERE "customerId" IN (SELECT customer_id FROM customers_to_delete);

-- 10. Delete KYC verifications
-- DELETE FROM kyc_verifications 
-- WHERE "customerId" IN (SELECT customer_id FROM customers_to_delete);

-- 11. Delete policies
-- DELETE FROM policies 
-- WHERE "customerId" IN (SELECT customer_id FROM customers_to_delete);

-- 12. Finally delete customers
-- DELETE FROM customers 
-- WHERE id IN (SELECT customer_id FROM customers_to_delete);

-- Verify deletion - Check all affected tables
-- SELECT 
--     '✅ Deletion Complete - Verification' AS status;

-- SELECT 
--     'Customers' AS table_name,
--     COUNT(*) AS remaining_records
-- FROM customers
-- WHERE id IN (SELECT customer_id FROM customers_to_delete)
-- UNION ALL
-- SELECT 
--     'Partner Customers' AS table_name,
--     COUNT(*) AS remaining_records
-- FROM partner_customers
-- WHERE "customerId" IN (SELECT customer_id FROM customers_to_delete)
-- UNION ALL
-- SELECT 
--     'Package Scheme Customers' AS table_name,
--     COUNT(*) AS remaining_records
-- FROM package_scheme_customers
-- WHERE "customerId" IN (SELECT customer_id FROM customers_to_delete)
-- UNION ALL
-- SELECT 
--     'Dependants' AS table_name,
--     COUNT(*) AS remaining_records
-- FROM dependants
-- WHERE "customerId" IN (SELECT customer_id FROM customers_to_delete)
-- UNION ALL
-- SELECT 
--     'Beneficiaries' AS table_name,
--     COUNT(*) AS remaining_records
-- FROM beneficiaries
-- WHERE "customerId" IN (SELECT customer_id FROM customers_to_delete)
-- UNION ALL
-- SELECT 
--     'Agent Registrations' AS table_name,
--     COUNT(*) AS remaining_records
-- FROM agent_registrations
-- WHERE "customerId" IN (SELECT customer_id FROM customers_to_delete)
-- UNION ALL
-- SELECT 
--     'Missing Requirements' AS table_name,
--     COUNT(*) AS remaining_records
-- FROM missing_requirements
-- WHERE "customerId" IN (SELECT customer_id FROM customers_to_delete)
-- UNION ALL
-- SELECT 
--     'BA Payouts' AS table_name,
--     COUNT(*) AS remaining_records
-- FROM ba_payouts
-- WHERE "registrationId" IN (
--     SELECT id FROM agent_registrations 
--     WHERE "customerId" IN (SELECT customer_id FROM customers_to_delete)
-- )
-- UNION ALL
-- SELECT 
--     'Addresses' AS table_name,
--     COUNT(*) AS remaining_records
-- FROM addresses
-- WHERE "customerId" IN (SELECT customer_id FROM customers_to_delete)
-- UNION ALL
-- SELECT 
--     'Onboarding Progress' AS table_name,
--     COUNT(*) AS remaining_records
-- FROM onboarding_progress
-- WHERE "customerId" IN (SELECT customer_id FROM customers_to_delete)
-- UNION ALL
-- SELECT 
--     'KYC Verifications' AS table_name,
--     COUNT(*) AS remaining_records
-- FROM kyc_verifications
-- WHERE "customerId" IN (SELECT customer_id FROM customers_to_delete)
-- UNION ALL
-- SELECT 
--     'Policies' AS table_name,
--     COUNT(*) AS remaining_records
-- FROM policies
-- WHERE "customerId" IN (SELECT customer_id FROM customers_to_delete)
-- ORDER BY table_name;

-- Clean up temp table
-- DROP TABLE IF EXISTS customers_to_delete;

-- ============================================
-- USAGE INSTRUCTIONS:
-- ============================================
-- 1. Replace the placeholder UUIDs with actual customer IDs
-- 2. Review the preview counts to ensure correct customers selected
-- 3. Uncomment the DELETE statements
-- 4. Run the script
-- 5. Check the verification count at the end
-- ============================================
