# Staging Database Migration - Quick Reference

## 🎯 Objective
Fix duplicate customer ID numbers on staging Supabase and add unique constraint.

## 📋 Pre-Migration Checklist
- [ ] Have staging database URL ready
- [ ] Backup staging database (optional but recommended)
- [ ] Reviewed the migration script
- [ ] Tested on local database first (optional)

## ⚡ Quick Commands

```bash
# 1. Set staging database URL
export STAGING_DB_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# 2. Run migration
cd apps/api
psql $STAGING_DB_URL -f scripts/fix-duplicates-and-migrate.sql

# 3. Verify (should return 0 duplicates)
psql $STAGING_DB_URL -c "
  SELECT \"idType\", \"idNumber\", COUNT(*) 
  FROM customers 
  GROUP BY \"idType\", \"idNumber\" 
  HAVING COUNT(*) > 1;
"

# 4. Apply Prisma schema changes
npm exec prisma db push
```

## ✅ What Gets Done

| Step | Action | Result |
|------|--------|--------|
| 1 | Find duplicates | Identifies all duplicate (idType, idNumber) |
| 2 | Fix duplicates | Appends suffix to newer records (e.g., 12345678 → 1234567801) |
| 3 | Verify | Confirms no duplicates remain |
| 4 | Add constraint | Creates UNIQUE constraint on (idType, idNumber) |
| 5 | Record migration | Adds entry to _prisma_migrations table |
| 6 | Final check | Verifies everything is correct |

## 🔍 Migration Details

**Tables Modified:**
- `customers` - ID numbers updated for duplicates
- `_prisma_migrations` - Migration record added

**Tables NOT Modified:**
- ✅ `partners` - No changes
- ✅ `partner_contacts` - No changes
- ✅ `addresses` - No changes
- ✅ `dependants` - No changes
- ✅ `beneficiaries` - No changes
- ✅ `onboarding_progress` - No changes
- ✅ `kyc_verifications` - No changes
- ✅ `policies` - No changes

**Data Preservation:**
- ✅ Oldest record keeps original ID number
- ✅ All customer data preserved
- ✅ All relationships intact
- ✅ Only ID numbers modified

## 📊 Expected Changes

```
Before:
Customer 1: idType=NATIONAL_ID, idNumber=12345678 (created 2024-01-01)
Customer 2: idType=NATIONAL_ID, idNumber=12345678 (created 2024-01-02) ← DUPLICATE

After:
Customer 1: idType=NATIONAL_ID, idNumber=12345678 (unchanged)
Customer 2: idType=NATIONAL_ID, idNumber=1234567801 (modified)
```

## 🚨 Rollback Plan

If something goes wrong:

```sql
-- The migration runs in a transaction
-- If it fails, all changes are automatically rolled back
-- No manual rollback needed!

-- But if you need to manually revert changes:
BEGIN;

-- Find modified customers (ID numbers longer than 8 digits)
SELECT id, "idNumber", "updatedAt" 
FROM customers 
WHERE LENGTH("idNumber") > 8 
  AND "updatedAt" > NOW() - INTERVAL '1 hour';

-- Manually restore if needed (example)
UPDATE customers 
SET "idNumber" = SUBSTRING("idNumber", 1, 8)
WHERE id = 'customer-id-here';

COMMIT;
```

## ⏱️ Estimated Time
- Script execution: ~1-2 seconds
- Total process: ~5 minutes (including verification)

## 📞 Support
- Review full documentation: `RUN-ON-STAGING.md`
- Check troubleshooting section for common issues
- Verify on local first if unsure

## 🎉 Post-Migration
After successful migration:
1. Test customer creation API
2. Verify duplicate prevention works
3. Apply same migration to production when ready
4. Update seed scripts to prevent future duplicates

