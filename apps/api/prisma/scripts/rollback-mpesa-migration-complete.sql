-- ============================================================================
-- Complete Rollback Script for MPESA Payment Tables Migration
-- ============================================================================
-- This script completely undoes everything the MPESA migration did.
-- Run this directly in Supabase SQL Editor to clean up staging database.
-- After running this, the migration 20251107010514_add_mpesa_payment_tables
-- will run cleanly on the next deployment.
-- ============================================================================

-- Step 1: Drop foreign key constraints (must be done before dropping tables)
DO $$ 
BEGIN
    -- Drop foreign key from mpesa_payment_report_items to mpesa_payment_report_uploads
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'mpesa_payment_report_items_mpesaPaymentReportUploadId_fkey'
        AND table_name = 'mpesa_payment_report_items'
    ) THEN
        ALTER TABLE "mpesa_payment_report_items" 
        DROP CONSTRAINT "mpesa_payment_report_items_mpesaPaymentReportUploadId_fkey";
        RAISE NOTICE 'Dropped foreign key constraint: mpesa_payment_report_items_mpesaPaymentReportUploadId_fkey';
    ELSE
        RAISE NOTICE 'Foreign key constraint does not exist (already dropped or never created)';
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'Table mpesa_payment_report_items does not exist, skipping foreign key drop';
END $$;

-- Step 2: Drop indexes (must be done before dropping tables)
DROP INDEX IF EXISTS "idx_transaction_reference";
DROP INDEX IF EXISTS "idx_mpesa_payment_report_upload_id";

-- Step 3: Drop tables (order matters - drop child table first due to foreign key)
DROP TABLE IF EXISTS "mpesa_payment_report_items" CASCADE;
DROP TABLE IF EXISTS "mpesa_payment_report_uploads" CASCADE;

-- Step 4: Drop enum type (must be done after dropping tables that use it)
DROP TYPE IF EXISTS "MpesaStatementReasonType" CASCADE;

-- Step 5: Remove migration entries from _prisma_migrations table
-- This ensures Prisma will re-run the migration on next deploy
DELETE FROM "_prisma_migrations" 
WHERE "migration_name" IN (
    '20250202150000_add_mpesa_payment_tables',
    '20251107010514_add_mpesa_payment_tables'
);

-- ============================================================================
-- Verification Queries (run these to confirm cleanup)
-- ============================================================================

-- Check if tables still exist (should return 0 rows)
SELECT 
    'Tables Check' as check_type,
    table_name,
    'STILL EXISTS - CLEANUP FAILED' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('mpesa_payment_report_items', 'mpesa_payment_report_uploads')
UNION ALL
SELECT 
    'Tables Check' as check_type,
    'None' as table_name,
    '✅ All tables dropped successfully' as status
WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('mpesa_payment_report_items', 'mpesa_payment_report_uploads')
);

-- Check if enum still exists (should return 0 rows)
SELECT 
    'Enum Check' as check_type,
    typname as enum_name,
    'STILL EXISTS - CLEANUP FAILED' as status
FROM pg_type 
WHERE typname = 'MpesaStatementReasonType'
UNION ALL
SELECT 
    'Enum Check' as check_type,
    'None' as enum_name,
    '✅ Enum dropped successfully' as status
WHERE NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'MpesaStatementReasonType'
);

-- Check migration entries (should return 0 rows)
SELECT 
    'Migration Entries Check' as check_type,
    migration_name,
    'STILL EXISTS - CLEANUP FAILED' as status
FROM "_prisma_migrations" 
WHERE "migration_name" IN (
    '20250202150000_add_mpesa_payment_tables',
    '20251107010514_add_mpesa_payment_tables'
)
UNION ALL
SELECT 
    'Migration Entries Check' as check_type,
    'None' as migration_name,
    '✅ Migration entries removed successfully' as status
WHERE NOT EXISTS (
    SELECT 1 FROM "_prisma_migrations" 
    WHERE "migration_name" IN (
        '20250202150000_add_mpesa_payment_tables',
        '20251107010514_add_mpesa_payment_tables'
    )
);

-- Final status summary
SELECT 
    '✅ CLEANUP COMPLETE' as status,
    'All MPESA migration objects have been removed.' as message,
    'The migration 20251107010514_add_mpesa_payment_tables will run cleanly on next deployment.' as next_step;

