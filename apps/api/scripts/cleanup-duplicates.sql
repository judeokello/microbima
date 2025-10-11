-- Script to clean up duplicate customer records
-- Strategy: Keep the oldest record (first created), delete newer duplicates

-- Step 1: Review duplicates before deletion (RUN THIS FIRST)
-- Uncomment to see what will be deleted:
/*
SELECT 
  c.id,
  c."firstName" || ' ' || c."lastName" as full_name,
  c.email,
  c."idType",
  c."idNumber",
  c."createdAt",
  'WILL BE DELETED' as action
FROM customers c
WHERE c.id NOT IN (
  -- Keep the oldest record for each idType/idNumber combination
  SELECT MIN(id)
  FROM customers
  GROUP BY "idType", "idNumber"
)
AND EXISTS (
  -- Only for records that have duplicates
  SELECT 1 
  FROM customers c2 
  WHERE c2."idType" = c."idType" 
    AND c2."idNumber" = c."idNumber"
  GROUP BY c2."idType", c2."idNumber"
  HAVING COUNT(*) > 1
)
ORDER BY c."idType", c."idNumber", c."createdAt";
*/

-- Step 2: Check if duplicates have any related data
-- Uncomment to check:
/*
SELECT 
  c.id as customer_id,
  c."firstName" || ' ' || c."lastName" as customer_name,
  (SELECT COUNT(*) FROM dependants WHERE "customerId" = c.id) as dependants_count,
  (SELECT COUNT(*) FROM beneficiaries WHERE "customerId" = c.id) as beneficiaries_count,
  (SELECT COUNT(*) FROM "partner_customers" WHERE "customerId" = c.id) as partner_relationships,
  'CHECK BEFORE DELETE' as warning
FROM customers c
WHERE c.id NOT IN (
  SELECT MIN(id)
  FROM customers
  GROUP BY "idType", "idNumber"
)
AND EXISTS (
  SELECT 1 
  FROM customers c2 
  WHERE c2."idType" = c."idType" 
    AND c2."idNumber" = c."idNumber"
  GROUP BY c2."idType", c2."idNumber"
  HAVING COUNT(*) > 1
);
*/

-- Step 3: Delete duplicates (KEEP OLDEST RECORD)
-- WARNING: This will permanently delete duplicate records
-- Uncomment when ready to execute:
/*
DELETE FROM customers
WHERE id NOT IN (
  -- Keep the oldest record for each idType/idNumber combination
  SELECT MIN(id)
  FROM customers
  GROUP BY "idType", "idNumber"
)
AND EXISTS (
  -- Only delete records that have duplicates
  SELECT 1 
  FROM customers c2 
  WHERE c2."idType" = customers."idType" 
    AND c2."idNumber" = customers."idNumber"
  GROUP BY c2."idType", c2."idNumber"
  HAVING COUNT(*) > 1
);
*/

-- Step 4: Verify cleanup
-- Run this after deletion to confirm no duplicates remain:
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

