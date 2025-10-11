# Database Cleanup Scripts

## Problem
You have duplicate customer records that are blocking the creation of a unique constraint on `(idType, idNumber)`.

## Error Message
```
ERROR: could not create unique index "customers_idType_idNumber_key"
Key ("idType", "idNumber")=(NATIONAL_ID, 12345678) is duplicated.
```

## Solution Options

### Option 1: Find and Review Duplicates (SAFE - Run First)

```bash
# Connect to your database and run:
psql $DATABASE_URL -f apps/api/scripts/find-duplicates.sql
```

This will show you:
- Which ID combinations are duplicated
- How many duplicates exist
- Customer IDs and names involved

### Option 2: Fix by Modifying ID Numbers (RECOMMENDED - No Data Loss)

**Append Sequential Suffix:**
- Keeps oldest record unchanged
- Adds sequential numbers to duplicates (e.g., 12345678 → 1234567801, 1234567802)
- No data loss, all records preserved

```bash
# Preview changes
psql $DATABASE_URL -f apps/api/scripts/fix-duplicates-by-modifying-id.sql

# Apply changes (uncomment Step 2 in the file first)
psql $DATABASE_URL -f apps/api/scripts/fix-duplicates-by-modifying-id.sql
```

**OR - Add Random Suffix:**
- Keeps oldest record unchanged  
- Adds random 2-digit suffix (e.g., 12345678 → 1234567843)
- Ensures uniqueness with retry logic

```bash
# Preview changes
psql $DATABASE_URL -f apps/api/scripts/fix-duplicates-random-suffix.sql

# Apply changes (uncomment Step 2 in the file first)
psql $DATABASE_URL -f apps/api/scripts/fix-duplicates-random-suffix.sql
```

### Option 3: Simple Delete (Keep Oldest Record)

**⚠️ WARNING: This deletes data permanently**

1. **Review what will be deleted:**
   - Edit `cleanup-duplicates.sql`
   - Uncomment Step 1 query
   - Run it to see what will be deleted

2. **Check for related data:**
   - Uncomment Step 2 query
   - Check if duplicates have dependants/beneficiaries
   - If they do, use Option 3 instead

3. **Execute deletion:**
   - Uncomment Step 3 query
   - Run the script
   - Verify with Step 4

### Option 4: Merge Duplicates (If you want to combine records)

This approach:
- ✅ Keeps the oldest record
- ✅ Migrates all dependants to kept record
- ✅ Migrates all beneficiaries to kept record
- ✅ Migrates all partner relationships to kept record
- ✅ Logs what was merged

```bash
# Run the merge script
psql $DATABASE_URL -f apps/api/scripts/merge-duplicates.sql
```

### Option 5: Manual Cleanup (For Complex Cases)

If you have specific requirements about which record to keep:

```sql
-- Find specific duplicate
SELECT * FROM customers 
WHERE "idType" = 'NATIONAL_ID' 
  AND "idNumber" = '12345678'
ORDER BY "createdAt";

-- Delete specific record by ID
DELETE FROM customers WHERE id = 'specific-uuid-here';
```

## After Cleanup

Once duplicates are removed, you can successfully run:

```bash
# Apply the unique constraint
npm exec prisma db push
```

## Prevention

Going forward, your API already prevents duplicates through:
- ✅ Validation in CustomerService
- ✅ Database unique constraint (once applied)
- ✅ Error handling for duplicate attempts

## Quick Command Reference

```bash
# Check for duplicates
psql $DATABASE_URL -c "
  SELECT \"idType\", \"idNumber\", COUNT(*) as count
  FROM customers
  GROUP BY \"idType\", \"idNumber\"
  HAVING COUNT(*) > 1;
"

# Count total customers
psql $DATABASE_URL -c "SELECT COUNT(*) FROM customers;"

# Apply schema changes after cleanup
npm exec prisma db push
```

## Need Help?

If you're unsure which option to use:
1. Start with Option 1 (find duplicates)
2. Review the output
3. If duplicates have no relationships → use Option 2
4. If duplicates have relationships → use Option 3

