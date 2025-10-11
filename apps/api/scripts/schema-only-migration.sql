-- Schema-Only Migration: Add unique constraint and update schema
-- Target: Staging Supabase Database (Clean - No Data)
-- Date: 2025-10-10
-- Description: Apply schema changes only - no data insertion

BEGIN;

-- ============================================================================
-- STEP 1: Verify tables are empty or have no duplicates
-- ============================================================================

DO $$
DECLARE
  customer_count INT;
  duplicate_count INT;
BEGIN
  RAISE NOTICE '🔍 Verifying database state...';
  
  -- Count customers
  SELECT COUNT(*) INTO customer_count FROM customers;
  RAISE NOTICE 'Total customers in database: %', customer_count;
  
  -- Check for duplicates
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT "idType", "idNumber"
    FROM customers
    GROUP BY "idType", "idNumber"
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF duplicate_count > 0 THEN
    RAISE EXCEPTION '❌ Found % duplicate ID combinations! Clean data first.', duplicate_count;
  ELSE
    RAISE NOTICE '✅ No duplicates found - safe to proceed';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Add unique constraint on customers (idType, idNumber)
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '🔧 Adding unique constraint on customers(idType, idNumber)...';
  
  -- Drop constraint if it exists (for idempotency)
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_id_type_number'
  ) THEN
    RAISE NOTICE '⚠️  Constraint already exists, dropping and recreating...';
    ALTER TABLE customers DROP CONSTRAINT unique_id_type_number;
  END IF;
  
  -- Create the constraint
  ALTER TABLE customers
  ADD CONSTRAINT unique_id_type_number 
  UNIQUE ("idType", "idNumber");
  
  RAISE NOTICE '✅ Unique constraint created successfully';
END $$;

-- ============================================================================
-- STEP 3: Add index on customers(idType, idNumber) for performance
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '🔧 Adding index on customers(idType, idNumber)...';
  
  -- Drop index if it exists
  DROP INDEX IF EXISTS idx_customers_id_type_number;
  
  -- Create index (note: unique constraint already creates an index, but we can add explicit one)
  -- This is optional since UNIQUE constraint creates an index automatically
  RAISE NOTICE '✅ Index handled by unique constraint';
END $$;

-- ============================================================================
-- STEP 4: Verify all enum types exist (no changes needed, just verification)
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '🔍 Verifying enum types...';
  
  -- Check CustomerStatus enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CustomerStatus') THEN
    RAISE EXCEPTION '❌ CustomerStatus enum missing!';
  END IF;
  
  -- Check OnboardingStep enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OnboardingStep') THEN
    RAISE EXCEPTION '❌ OnboardingStep enum missing!';
  END IF;
  
  -- Check IdType enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IdType') THEN
    RAISE EXCEPTION '❌ IdType enum missing!';
  END IF;
  
  -- Check Gender enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Gender') THEN
    RAISE EXCEPTION '❌ Gender enum missing!';
  END IF;
  
  -- Check DependantRelationship enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DependantRelationship') THEN
    RAISE EXCEPTION '❌ DependantRelationship enum missing!';
  END IF;
  
  RAISE NOTICE '✅ All enum types verified';
END $$;

-- ============================================================================
-- STEP 5: Create _prisma_migrations table if not exists
-- ============================================================================

DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS _prisma_migrations (
    id VARCHAR(36) PRIMARY KEY,
    checksum VARCHAR(64) NOT NULL,
    finished_at TIMESTAMPTZ,
    migration_name VARCHAR(255) NOT NULL,
    logs TEXT,
    rolled_back_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    applied_steps_count INTEGER NOT NULL DEFAULT 0
  );
  
  RAISE NOTICE '✅ _prisma_migrations table ready';
END $$;

-- ============================================================================
-- STEP 6: Record this migration in _prisma_migrations
-- ============================================================================

DO $$
BEGIN
  INSERT INTO _prisma_migrations (
    id,
    checksum,
    finished_at,
    migration_name,
    logs,
    started_at,
    applied_steps_count
  )
  VALUES (
    'schema-only-' || TO_CHAR(NOW(), 'YYYYMMDDHHMMSS'),
    MD5('add_unique_constraint_customer_id_type_number'),
    NOW(),
    '20251010_add_unique_constraint_customer_id_type_number',
    'Schema-only migration: Added unique constraint on customers(idType, idNumber). No data modifications.',
    NOW(),
    2
  )
  ON CONFLICT (id) DO NOTHING;
  
  RAISE NOTICE '✅ Migration recorded in _prisma_migrations';
END $$;

-- ============================================================================
-- STEP 7: Verify schema changes
-- ============================================================================

DO $$
DECLARE
  constraint_exists BOOLEAN;
  migration_recorded BOOLEAN;
BEGIN
  RAISE NOTICE '🔍 Verifying schema changes...';
  
  -- Check constraint exists
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_id_type_number'
      AND conrelid = 'customers'::regclass
  ) INTO constraint_exists;
  
  -- Check migration recorded
  SELECT EXISTS (
    SELECT 1 FROM _prisma_migrations 
    WHERE migration_name = '20251010_add_unique_constraint_customer_id_type_number'
  ) INTO migration_recorded;
  
  IF constraint_exists AND migration_recorded THEN
    RAISE NOTICE '✅ All schema changes verified successfully';
  ELSE
    RAISE EXCEPTION '❌ Schema verification failed! Constraint: %, Migration: %', 
      constraint_exists, migration_recorded;
  END IF;
END $$;

-- ============================================================================
-- STEP 8: Summary
-- ============================================================================

DO $$
DECLARE
  total_customers INT;
  total_partners INT;
  total_migrations INT;
BEGIN
  SELECT COUNT(*) INTO total_customers FROM customers;
  SELECT COUNT(*) INTO total_partners FROM partners;
  SELECT COUNT(*) INTO total_migrations FROM _prisma_migrations;
  
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '          SCHEMA MIGRATION SUMMARY';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE 'Migration: Add unique constraint on customers(idType, idNumber)';
  RAISE NOTICE 'Type: Schema-only (no data modifications)';
  RAISE NOTICE '';
  RAISE NOTICE 'Current Database State:';
  RAISE NOTICE '  - Customers: %', total_customers;
  RAISE NOTICE '  - Partners: %', total_partners;
  RAISE NOTICE '  - Migrations recorded: %', total_migrations;
  RAISE NOTICE '';
  RAISE NOTICE 'Schema Changes Applied:';
  RAISE NOTICE '  ✅ Added UNIQUE constraint: unique_id_type_number';
  RAISE NOTICE '  ✅ Verified all enum types exist';
  RAISE NOTICE '  ✅ Recorded in _prisma_migrations table';
  RAISE NOTICE '';
  RAISE NOTICE 'Completed at: %', NOW();
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '✅ SCHEMA MIGRATION SUCCESSFUL!';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Run: npm exec prisma db push (to sync Prisma schema)';
  RAISE NOTICE '  2. Test customer creation with duplicate IDs (should fail)';
  RAISE NOTICE '  3. Seed database if needed: npm run db:seed';
END $$;

COMMIT;

-- ============================================================================
-- Post-migration verification queries (run separately if needed)
-- ============================================================================

-- Verify constraint
-- SELECT conname, contype, pg_get_constraintdef(oid) 
-- FROM pg_constraint 
-- WHERE conname = 'unique_id_type_number';

-- View recent migrations
-- SELECT migration_name, finished_at, logs 
-- FROM _prisma_migrations 
-- ORDER BY started_at DESC 
-- LIMIT 5;

-- Test constraint (should fail if run twice with same data)
-- INSERT INTO customers (id, "firstName", "lastName", "phoneNumber", "idType", "idNumber", status, "onboardingStep", "createdByPartnerId")
-- VALUES (gen_random_uuid(), 'Test', 'User', '254700000000', 'NATIONAL_ID', '12345678', 'PENDING_KYC', 'BASIC_INFO', 1);

