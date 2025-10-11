-- Migration: Fix duplicate ID numbers and add unique constraint
-- Target: Staging Supabase Database
-- Date: 2025-10-10
-- Description: Resolves duplicate (idType, idNumber) combinations and adds unique constraint

BEGIN;

-- ============================================================================
-- STEP 1: Fix duplicate ID numbers by adding sequential suffix
-- ============================================================================

DO $$
DECLARE
  duplicate_record RECORD;
  new_id_number VARCHAR(20);
  row_counter INT;
BEGIN
  RAISE NOTICE '🔍 Searching for duplicate ID numbers...';
  
  -- Loop through each set of duplicates
  FOR duplicate_record IN 
    WITH duplicate_sets AS (
      SELECT 
        c.id,
        c."idType",
        c."idNumber",
        c."firstName" || ' ' || c."lastName" as full_name,
        c."createdAt",
        ROW_NUMBER() OVER (
          PARTITION BY c."idType", c."idNumber" 
          ORDER BY c."createdAt" ASC
        ) as row_num
      FROM customers c
      WHERE EXISTS (
        SELECT 1 
        FROM customers c2 
        WHERE c2."idType" = c."idType" 
          AND c2."idNumber" = c."idNumber"
        GROUP BY c2."idType", c2."idNumber"
        HAVING COUNT(*) > 1
      )
    )
    SELECT * FROM duplicate_sets WHERE row_num > 1
  LOOP
    -- Generate new ID number by appending row number
    -- Example: 12345678 becomes 1234567801, 1234567802, etc.
    new_id_number := duplicate_record."idNumber" || LPAD((duplicate_record.row_num - 1)::text, 2, '0');
    
    -- Update the record
    UPDATE customers
    SET "idNumber" = new_id_number,
        "updatedAt" = NOW()
    WHERE id = duplicate_record.id;
    
    RAISE NOTICE '✅ Updated customer % (%) - Changed ID from % to %', 
      duplicate_record.id,
      duplicate_record.full_name,
      duplicate_record."idNumber", 
      new_id_number;
  END LOOP;
  
  RAISE NOTICE '✅ Duplicate ID fix complete!';
END $$;

-- ============================================================================
-- STEP 2: Verify no duplicates remain
-- ============================================================================

DO $$
DECLARE
  duplicate_count INT;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT "idType", "idNumber"
    FROM customers
    GROUP BY "idType", "idNumber"
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF duplicate_count > 0 THEN
    RAISE EXCEPTION '❌ Still have % duplicate ID combinations!', duplicate_count;
  ELSE
    RAISE NOTICE '✅ Verification passed - No duplicates found';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Create unique constraint on (idType, idNumber)
-- ============================================================================

DO $$
BEGIN
  -- Check if constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_id_type_number'
  ) THEN
    RAISE NOTICE '🔧 Creating unique constraint on (idType, idNumber)...';
    
    ALTER TABLE customers
    ADD CONSTRAINT unique_id_type_number 
    UNIQUE ("idType", "idNumber");
    
    RAISE NOTICE '✅ Unique constraint created successfully';
  ELSE
    RAISE NOTICE '⚠️  Unique constraint already exists, skipping';
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Record migration in _prisma_migrations table
-- ============================================================================

-- Create _prisma_migrations table if it doesn't exist
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

-- Insert migration record
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
  'fix-duplicate-ids-' || TO_CHAR(NOW(), 'YYYYMMDDHHMMSS'),
  MD5('fix_duplicate_customer_ids_and_add_unique_constraint'),
  NOW(),
  '20251010_fix_duplicate_customer_ids_and_add_unique_constraint',
  'Fixed duplicate customer ID numbers and added unique constraint on (idType, idNumber)',
  NOW(),
  3
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 5: Final verification and summary
-- ============================================================================

DO $$
DECLARE
  total_customers INT;
  unique_id_combinations INT;
  constraint_exists BOOLEAN;
BEGIN
  -- Count total customers
  SELECT COUNT(*) INTO total_customers FROM customers;
  
  -- Count unique ID combinations
  SELECT COUNT(*) INTO unique_id_combinations
  FROM (
    SELECT DISTINCT "idType", "idNumber"
    FROM customers
  ) unique_ids;
  
  -- Check constraint exists
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_id_type_number'
  ) INTO constraint_exists;
  
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '             MIGRATION SUMMARY';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE 'Total customers: %', total_customers;
  RAISE NOTICE 'Unique ID combinations: %', unique_id_combinations;
  RAISE NOTICE 'Unique constraint exists: %', constraint_exists;
  RAISE NOTICE 'Migration completed at: %', NOW();
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  
  IF total_customers = unique_id_combinations AND constraint_exists THEN
    RAISE NOTICE '✅ MIGRATION SUCCESSFUL - All checks passed!';
  ELSE
    RAISE EXCEPTION '❌ MIGRATION VERIFICATION FAILED - Manual review required!';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
\echo '✅ Migration completed successfully!'
\echo '📊 Run this to verify: SELECT COUNT(*) FROM customers;'
\echo '🔍 Check migrations: SELECT * FROM _prisma_migrations ORDER BY started_at DESC LIMIT 5;'

