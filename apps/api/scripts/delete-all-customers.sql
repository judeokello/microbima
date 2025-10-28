-- Delete All Customers Script
-- ============================================
-- WARNING: This will DELETE ALL customer records and related data
-- This is IRREVERSIBLE and should only be used in development/testing
-- ============================================

-- Show what will be deleted before executing
SELECT 
    '⚠️  WARNING: This will delete ALL customers and related data' AS warning,
    (SELECT COUNT(*) FROM customers) AS total_customers,
    (SELECT COUNT(*) FROM partner_customers) AS total_partner_customers,
    (SELECT COUNT(*) FROM package_scheme_customers) AS total_package_scheme_customers,
    (SELECT COUNT(*) FROM dependants) AS total_dependants,
    (SELECT COUNT(*) FROM beneficiaries) AS total_beneficiaries,
    (SELECT COUNT(*) FROM agent_registrations) AS total_registrations,
    (SELECT COUNT(*) FROM missing_requirements) AS total_missing_requirements;

-- Uncomment the lines below to actually delete the data
-- WARNING: This is IRREVERSIBLE!

-- Delete in correct order to avoid foreign key constraint violations

-- 1. Delete missing requirements (references agent_registrations, customers, partners)
-- DELETE FROM missing_requirements;

-- 2. Delete BA payouts related to registrations
-- DELETE FROM ba_payouts WHERE "registrationId" IS NOT NULL;

-- 3. Delete agent registrations (references customers)
-- DELETE FROM agent_registrations;

-- 4. Delete beneficiaries (references customers)
-- DELETE FROM beneficiaries;

-- 5. Delete dependants (references customers)
-- DELETE FROM dependants;

-- 6. Delete package scheme customers (references customers)
-- DELETE FROM package_scheme_customers;

-- 7. Delete partner customers (references customers)
-- DELETE FROM partner_customers;

-- 8. Delete addresses (references customers)
-- DELETE FROM addresses;

-- 9. Delete onboarding progress (references customers)
-- DELETE FROM onboarding_progress;

-- 10. Delete KYC verifications (references customers)
-- DELETE FROM kyc_verifications;

-- 11. Delete policies (references customers)
-- DELETE FROM policies;

-- 12. Finally delete customers
-- DELETE FROM customers;

-- Verify deletion - Check all affected tables
-- SELECT 
--     '✅ Deletion Complete - Verification' AS status,
--     (SELECT COUNT(*) FROM customers) AS remaining_customers,
--     (SELECT COUNT(*) FROM partner_customers) AS remaining_partner_customers,
--     (SELECT COUNT(*) FROM package_scheme_customers) AS remaining_package_scheme_customers,
--     (SELECT COUNT(*) FROM dependants) AS remaining_dependants,
--     (SELECT COUNT(*) FROM beneficiaries) AS remaining_beneficiaries,
--     (SELECT COUNT(*) FROM agent_registrations) AS remaining_agent_registrations,
--     (SELECT COUNT(*) FROM missing_requirements) AS remaining_missing_requirements,
--     (SELECT COUNT(*) FROM ba_payouts WHERE "registrationId" IS NOT NULL) AS remaining_ba_payouts,
--     (SELECT COUNT(*) FROM addresses) AS remaining_addresses,
--     (SELECT COUNT(*) FROM onboarding_progress) AS remaining_onboarding_progress,
--     (SELECT COUNT(*) FROM kyc_verifications) AS remaining_kyc_verifications,
--     (SELECT COUNT(*) FROM policies) AS remaining_policies;

-- ============================================
-- To execute this script:
-- 1. Review the warning counts above
-- 2. Uncomment the DELETE statements
-- 3. Run the script
-- 4. Check the verification counts at the end
-- ============================================
