# Run Migration on Staging Supabase

## 🎯 What This Script Does

This migration script will:
1. ✅ **Fix duplicate ID numbers** - Adds sequential suffix to duplicates (e.g., 12345678 → 1234567801)
2. ✅ **Create unique constraint** - Ensures (idType, idNumber) combinations are unique
3. ✅ **Record migration** - Properly logs in `_prisma_migrations` table
4. ✅ **Verify success** - Checks all constraints are in place

## 🚀 How to Run on Staging

### Step 1: Get Your Staging Database URL

```bash
# From your .env or Supabase dashboard
# It should look like:
# postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

### Step 2: Execute the Migration

**Option A: Using psql (Recommended)**
```bash
cd apps/api

# Set your staging database URL
export STAGING_DB_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# Run the migration
psql $STAGING_DB_URL -f scripts/fix-duplicates-and-migrate.sql
```

**Option B: Using Supabase SQL Editor**
1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy the contents of `fix-duplicates-and-migrate.sql`
4. Paste and run

### Step 3: Verify Success

```bash
# Check customers table
psql $STAGING_DB_URL -c "SELECT COUNT(*) FROM customers;"

# Check for duplicates (should return 0 rows)
psql $STAGING_DB_URL -c "
  SELECT \"idType\", \"idNumber\", COUNT(*) as count
  FROM customers
  GROUP BY \"idType\", \"idNumber\"
  HAVING COUNT(*) > 1;
"

# Check migration record
psql $STAGING_DB_URL -c "
  SELECT migration_name, finished_at, logs
  FROM _prisma_migrations
  ORDER BY started_at DESC
  LIMIT 5;
"

# Verify constraint exists
psql $STAGING_DB_URL -c "
  SELECT conname, contype
  FROM pg_constraint
  WHERE conname = 'unique_id_type_number';
"
```

### Step 4: Run Prisma DB Push

Once the migration succeeds, you can safely run:

```bash
cd apps/api
npm exec prisma db push
```

This will apply any other pending schema changes.

## 📊 Expected Output

You should see messages like:

```
🔍 Searching for duplicate ID numbers...
✅ Updated customer abc-123-def (John Doe) - Changed ID from 12345678 to 1234567801
✅ Duplicate ID fix complete!
✅ Verification passed - No duplicates found
🔧 Creating unique constraint on (idType, idNumber)...
✅ Unique constraint created successfully

════════════════════════════════════════════════════════
             MIGRATION SUMMARY
════════════════════════════════════════════════════════
Total customers: 3
Unique ID combinations: 3
Unique constraint exists: true
Migration completed at: 2025-10-10 15:30:45
════════════════════════════════════════════════════════

✅ MIGRATION SUCCESSFUL - All checks passed!
✅ Migration completed successfully!
```

## 🔄 What Was Changed

### Modified Records Example:
| Customer | Old ID Number | New ID Number | Status |
|----------|--------------|---------------|--------|
| John Doe (oldest) | 12345678 | 12345678 | ✅ Unchanged |
| Test User | 12345678 | 1234567801 | ✅ Modified |

### Database Changes:
- ✅ Updated `customers.idNumber` for duplicate records
- ✅ Added unique constraint `unique_id_type_number`
- ✅ Added migration record to `_prisma_migrations`
- ✅ Updated `customers.updatedAt` timestamp

## ⚠️ Important Notes

1. **Transaction Safety**: The entire migration runs in a transaction (BEGIN/COMMIT)
   - If anything fails, all changes are rolled back
   - Database remains in consistent state

2. **Idempotent**: Safe to run multiple times
   - Skips if constraint already exists
   - Won't create duplicate migration records

3. **Production Ready**: After testing on staging, use the same script for production

## 🆘 Troubleshooting

### Error: "Still have duplicate ID combinations"
- Check the output to see which IDs are duplicated
- The script failed before making changes (transaction rolled back)
- Review the duplicate records manually

### Error: "Unique constraint already exists"
- This is just a warning, migration continues
- Constraint was added in a previous run

### Connection Issues
- Verify your DATABASE_URL is correct
- Check Supabase dashboard for connection limits
- Ensure your IP is whitelisted

## 📝 Next Steps

After successful migration:
1. ✅ Verify all data is correct
2. ✅ Test customer creation API
3. ✅ Run Prisma DB push for other schema changes
4. ✅ Update local database with same migration
5. ✅ Document any ID changes for reference

## 🔐 Security Note

Never commit your actual DATABASE_URL to git. Always use environment variables.

