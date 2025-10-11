-- Script to merge duplicate customer records
-- Strategy: Keep oldest record, migrate relationships from duplicates

-- Step 1: Create a temporary table to track merges
CREATE TEMP TABLE IF NOT EXISTS duplicate_merge_log (
  kept_customer_id UUID,
  deleted_customer_id UUID,
  deleted_at TIMESTAMP DEFAULT NOW()
);

-- Step 2: Migrate partner_customers relationships
-- This moves all partner relationships from duplicates to the kept record
DO $$
DECLARE
  duplicate_record RECORD;
  kept_id UUID;
BEGIN
  -- Find all duplicate sets
  FOR duplicate_record IN 
    SELECT "idType", "idNumber"
    FROM customers
    GROUP BY "idType", "idNumber"
    HAVING COUNT(*) > 1
  LOOP
    -- Get the ID of the record to keep (oldest)
    SELECT MIN(id) INTO kept_id
    FROM customers
    WHERE "idType" = duplicate_record."idType"
      AND "idNumber" = duplicate_record."idNumber";
    
    -- Update partner_customers to point to kept record
    UPDATE "partner_customers"
    SET "customerId" = kept_id
    WHERE "customerId" IN (
      SELECT id 
      FROM customers
      WHERE "idType" = duplicate_record."idType"
        AND "idNumber" = duplicate_record."idNumber"
        AND id != kept_id
    )
    AND NOT EXISTS (
      -- Avoid creating duplicate partner_customer relationships
      SELECT 1 FROM "partner_customers" pc2
      WHERE pc2."customerId" = kept_id
        AND pc2."partnerId" = "partner_customers"."partnerId"
    );
    
    -- Migrate dependants
    UPDATE dependants
    SET "customerId" = kept_id
    WHERE "customerId" IN (
      SELECT id 
      FROM customers
      WHERE "idType" = duplicate_record."idType"
        AND "idNumber" = duplicate_record."idNumber"
        AND id != kept_id
    );
    
    -- Migrate beneficiaries
    UPDATE beneficiaries
    SET "customerId" = kept_id
    WHERE "customerId" IN (
      SELECT id 
      FROM customers
      WHERE "idType" = duplicate_record."idType"
        AND "idNumber" = duplicate_record."idNumber"
        AND id != kept_id
    );
    
    -- Log the duplicates that will be deleted
    INSERT INTO duplicate_merge_log (kept_customer_id, deleted_customer_id)
    SELECT 
      kept_id,
      id
    FROM customers
    WHERE "idType" = duplicate_record."idType"
      AND "idNumber" = duplicate_record."idNumber"
      AND id != kept_id;
    
    -- Delete the duplicate records
    DELETE FROM customers
    WHERE "idType" = duplicate_record."idType"
      AND "idNumber" = duplicate_record."idNumber"
      AND id != kept_id;
    
    RAISE NOTICE 'Merged duplicates for % %', duplicate_record."idType", duplicate_record."idNumber";
  END LOOP;
END $$;

-- Step 3: View merge log
SELECT * FROM duplicate_merge_log;

-- Step 4: Verify no duplicates remain
SELECT 
  "idType", 
  "idNumber", 
  COUNT(*) as count
FROM customers
GROUP BY "idType", "idNumber"
HAVING COUNT(*) > 1;
-- Should return no rows

