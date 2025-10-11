# Schema-Only Migration - Clean Database

## 🎯 What This Does

This script applies **ONLY schema changes** to your clean staging database:
- ✅ Adds UNIQUE constraint on `customers(idType, idNumber)`
- ✅ Verifies all enum types exist
- ✅ Records migration in `_prisma_migrations` table
- ❌ **NO data insertion** into any tables

## ✅ Prerequisites

You've already completed:
- ✅ Deleted all data from tables
- ✅ Database is clean (no duplicate records)
- ✅ Ready for schema changes only

## 🚀 Execute Migration

### Step 1: Set Database URL

```bash
# Staging Supabase
export STAGING_DB_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
```

### Step 2: Run Schema Migration

```bash
cd apps/api
psql $STAGING_DB_URL -f scripts/schema-only-migration.sql
```

### Step 3: Sync Prisma Schema

```bash
npm exec prisma db push
```

This will ensure Prisma client is in sync with your database schema.

## 📊 What Gets Modified

### Schema Changes:
| Change | Description |
|--------|-------------|
| Constraint | `UNIQUE(idType, idNumber)` on customers table |
| Migration Record | Entry in `_prisma_migrations` table |

### Tables NOT Modified (No Data Changes):
- ✅ `partners` - Structure only, no data
- ✅ `partner_contacts` - Structure only, no data
- ✅ `customers` - Constraint added, no data
- ✅ `addresses` - No changes
- ✅ `dependants` - No changes
- ✅ `beneficiaries` - No changes
- ✅ `onboarding_progress` - No changes
- ✅ `kyc_verifications` - No changes
- ✅ `partner_customers` - No changes
- ✅ `policies` - No changes

## 🔍 Verification Commands

```bash
# 1. Check constraint was created
psql $STAGING_DB_URL -c "
  SELECT conname, contype, pg_get_constraintdef(oid) 
  FROM pg_constraint 
  WHERE conname = 'unique_id_type_number';
"

# 2. View migration record
psql $STAGING_DB_URL -c "
  SELECT migration_name, finished_at, logs 
  FROM _prisma_migrations 
  ORDER BY started_at DESC 
  LIMIT 5;
"

# 3. Verify tables are still empty
psql $STAGING_DB_URL -c "
  SELECT 
    'customers' as table_name, COUNT(*) as row_count FROM customers
  UNION ALL
  SELECT 'partners', COUNT(*) FROM partners
  UNION ALL
  SELECT 'dependants', COUNT(*) FROM dependants;
"

# 4. Test constraint (should fail on second insert with same ID)
psql $STAGING_DB_URL -c "
  -- First insert should succeed
  INSERT INTO customers (id, \"firstName\", \"lastName\", \"phoneNumber\", \"idType\", \"idNumber\", status, \"onboardingStep\", \"createdByPartnerId\")
  VALUES (gen_random_uuid(), 'Test', 'User1', '254700000001', 'NATIONAL_ID', '11111111', 'PENDING_KYC', 'BASIC_INFO', 1);
  
  -- Second insert with same idType+idNumber should FAIL
  INSERT INTO customers (id, \"firstName\", \"lastName\", \"phoneNumber\", \"idType\", \"idNumber\", status, \"onboardingStep\", \"createdByPartnerId\")
  VALUES (gen_random_uuid(), 'Test', 'User2', '254700000002', 'NATIONAL_ID', '11111111', 'PENDING_KYC', 'BASIC_INFO', 1);
"
# Expected: Second insert fails with unique constraint violation
```

## 📋 Expected Output

```
🔍 Verifying database state...
Total customers in database: 0
✅ No duplicates found - safe to proceed
🔧 Adding unique constraint on customers(idType, idNumber)...
✅ Unique constraint created successfully
🔍 Verifying enum types...
✅ All enum types verified
✅ _prisma_migrations table ready
✅ Migration recorded in _prisma_migrations
🔍 Verifying schema changes...
✅ All schema changes verified successfully

════════════════════════════════════════════════════════
          SCHEMA MIGRATION SUMMARY
════════════════════════════════════════════════════════
Migration: Add unique constraint on customers(idType, idNumber)
Type: Schema-only (no data modifications)

Current Database State:
  - Customers: 0
  - Partners: 0
  - Migrations recorded: 1

Schema Changes Applied:
  ✅ Added UNIQUE constraint: unique_id_type_number
  ✅ Verified all enum types exist
  ✅ Recorded in _prisma_migrations table

Completed at: 2025-10-10 16:00:00
════════════════════════════════════════════════════════

✅ SCHEMA MIGRATION SUCCESSFUL!

Next steps:
  1. Run: npm exec prisma db push (to sync Prisma schema)
  2. Test customer creation with duplicate IDs (should fail)
  3. Seed database if needed: npm run db:seed
```

## 🎯 After Migration

### 1. Sync Prisma Client
```bash
npm exec prisma generate
```

### 2. Test Constraint Works
Try creating duplicate customers via your API - should fail with validation error.

### 3. Seed Database (Optional)
```bash
npm run db:seed
```

### 4. Test API Endpoints
```bash
# Test customer creation
curl -X POST http://your-staging-api/v1/customers \
  -H "x-api-key: your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "phoneNumber": "254700000001",
    "idType": "NATIONAL_ID",
    "idNumber": "12345678"
  }'
```

## 🔄 Rollback (If Needed)

```sql
BEGIN;

-- Remove constraint
ALTER TABLE customers DROP CONSTRAINT IF EXISTS unique_id_type_number;

-- Remove migration record
DELETE FROM _prisma_migrations 
WHERE migration_name = '20251010_add_unique_constraint_customer_id_type_number';

COMMIT;
```

## ✅ Success Checklist

- [ ] Migration script executed successfully
- [ ] Constraint exists in database
- [ ] Migration recorded in `_prisma_migrations`
- [ ] Prisma schema synced (`prisma db push`)
- [ ] Tested duplicate prevention
- [ ] API endpoints working correctly

## 🆘 Troubleshooting

### "Found duplicate ID combinations"
- You still have data in the customers table
- Run your DELETE statements again
- Verify: `SELECT COUNT(*) FROM customers;`

### "Constraint already exists"
- Migration was already run
- This is safe - script is idempotent
- Verify constraint: Check verification commands above

### "Enum type missing"
- Your Prisma schema might be out of sync
- Run: `npm exec prisma db push` first
- Then run this migration

## 📝 Notes

- **Safe to run multiple times** - Script is idempotent
- **No data loss** - Only schema changes
- **Transaction-safe** - Rolls back on any error
- **Production-ready** - Use same script for production

