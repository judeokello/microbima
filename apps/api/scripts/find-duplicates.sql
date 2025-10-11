-- Find duplicate customers by idType and idNumber
SELECT 
  "idType", 
  "idNumber", 
  COUNT(*) as duplicate_count,
  STRING_AGG(id::text, ', ') as customer_ids,
  STRING_AGG("firstName" || ' ' || "lastName", ', ') as customer_names
FROM customers
GROUP BY "idType", "idNumber"
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Show all details of duplicate records
SELECT 
  c.id,
  c."firstName",
  c."middleName",
  c."lastName",
  c.email,
  c."phoneNumber",
  c."idType",
  c."idNumber",
  c."createdAt",
  c."createdByPartnerId"
FROM customers c
WHERE EXISTS (
  SELECT 1 
  FROM customers c2 
  WHERE c2."idType" = c."idType" 
    AND c2."idNumber" = c."idNumber"
  GROUP BY c2."idType", c2."idNumber"
  HAVING COUNT(*) > 1
)
ORDER BY c."idType", c."idNumber", c."createdAt";

