-- Script to fix duplicate customer records by adding random 2-digit suffix
-- Strategy: Keep the oldest record unchanged, add random suffix to newer duplicates

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
    ) as row_num,
    -- Generate random 2-digit number (10-99)
    (10 + FLOOR(RANDOM() * 90)::INT)::text as random_suffix
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
    ELSE "idNumber" || random_suffix
  END as new_id_number,
  "createdAt",
  CASE 
    WHEN row_num = 1 THEN 'KEEP ORIGINAL'
    ELSE 'WILL BE MODIFIED'
  END as action
FROM duplicate_customers
ORDER BY "idType", "idNumber", "createdAt";

-- Step 2: Apply the changes with random suffix (Uncomment when ready)
-- WARNING: This will modify ID numbers for duplicate records
/*
DO $$
DECLARE
  duplicate_record RECORD;
  new_id_number VARCHAR(20);
  random_suffix TEXT;
  max_attempts INT := 10;
  attempt INT;
  is_unique BOOLEAN;
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
    -- Try to generate a unique ID number
    attempt := 0;
    is_unique := FALSE;
    
    WHILE attempt < max_attempts AND NOT is_unique LOOP
      -- Generate random 2-digit suffix (10-99)
      random_suffix := LPAD((10 + FLOOR(RANDOM() * 90)::INT)::text, 2, '0');
      new_id_number := duplicate_record."idNumber" || random_suffix;
      
      -- Check if this ID number is unique
      SELECT NOT EXISTS (
        SELECT 1 FROM customers 
        WHERE "idType" = duplicate_record."idType" 
          AND "idNumber" = new_id_number
      ) INTO is_unique;
      
      attempt := attempt + 1;
    END LOOP;
    
    IF is_unique THEN
      -- Update the record
      UPDATE customers
      SET "idNumber" = new_id_number,
          "updatedAt" = NOW()
      WHERE id = duplicate_record.id;
      
      RAISE NOTICE 'Updated customer % - Changed ID from % to %', 
        duplicate_record.id, 
        duplicate_record."idNumber", 
        new_id_number;
    ELSE
      RAISE WARNING 'Could not find unique ID for customer % after % attempts', 
        duplicate_record.id, 
        max_attempts;
    END IF;
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
WHERE "updatedAt" > NOW() - INTERVAL '5 minutes'
ORDER BY "updatedAt" DESC;
*/

