-- Script to fix duplicate customer records by modifying ID numbers
-- Strategy: Keep the oldest record unchanged, modify newer duplicates by appending random digits

-- Step 1: Preview duplicates and proposed changes (RUN THIS FIRST)
WITH duplicate_customers AS (
  SELECT 
    c.id,
    c."firstName",
    c."middleName",
    c."lastName",
    c."idType",
    c."idNumber",
    c."createdAt",
    c."createdByPartnerId",
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
SELECT 
  id,
  "firstName" || ' ' || COALESCE("middleName" || ' ', '') || "lastName" as full_name,
  "idType",
  "idNumber" as current_id_number,
  CASE 
    WHEN row_num = 1 THEN "idNumber" || ' (KEPT - NO CHANGE)'
    ELSE "idNumber" || LPAD((row_num - 1)::text, 2, '0')
  END as new_id_number,
  "createdAt",
  CASE 
    WHEN row_num = 1 THEN 'KEEP ORIGINAL'
    ELSE 'WILL BE MODIFIED'
  END as action
FROM duplicate_customers
ORDER BY "idType", "idNumber", "createdAt";

-- Step 2: Apply the changes (Uncomment when ready)
-- WARNING: This will modify ID numbers for duplicate records
/*
DO $$
DECLARE
  duplicate_record RECORD;
  new_id_number VARCHAR(20);
  row_counter INT;
BEGIN
  -- Loop through each set of duplicates
  FOR duplicate_record IN 
    WITH duplicate_sets AS (
      SELECT 
        c.id,
        c."idType",
        c."idNumber",
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
    
    RAISE NOTICE 'Updated customer % - Changed ID from % to %', 
      duplicate_record.id, 
      duplicate_record."idNumber", 
      new_id_number;
  END LOOP;
  
  RAISE NOTICE 'Duplicate fix complete!';
END $$;
*/

-- Step 3: Verify no duplicates remain (Run after Step 2)
/*
SELECT 
  "idType", 
  "idNumber", 
  COUNT(*) as count
FROM customers
GROUP BY "idType", "idNumber"
HAVING COUNT(*) > 1;
-- Should return no rows if successful
*/

-- Step 4: View all modified records (Run after Step 2)
/*
SELECT 
  id,
  "firstName" || ' ' || COALESCE("middleName" || ' ', '') || "lastName" as full_name,
  "idType",
  "idNumber",
  "createdAt",
  "updatedAt"
FROM customers
WHERE "idNumber" ~ '\d{2}$'  -- IDs ending with appended digits
  AND LENGTH("idNumber") > 8   -- Longer than typical ID
ORDER BY "updatedAt" DESC;
*/

