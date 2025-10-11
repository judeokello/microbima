# Supabase Migration Guide

## 📋 Pre-Migration Checklist

Before running the migration on Supabase staging:

- [ ] **Backup your database** (Supabase dashboard → Database → Backups → Create backup)
- [ ] **Review the migration SQL file** at `apps/api/prisma/migrations/manual_staging_migration.sql`
- [ ] **Stop or scale down the staging API** to prevent conflicts during migration
- [ ] **Notify team members** about the planned maintenance window
- [ ] **Test the migration on a clone/dev database first** (if possible)

## 🚀 Migration Steps

### Option 1: Using Supabase Dashboard (Recommended for Staging)

1. **Access Supabase Dashboard**
   - Go to https://app.supabase.com
   - Select your staging project
   - Navigate to **SQL Editor** in the left sidebar

2. **Create a New Query**
   - Click **+ New query**
   - Name it: `Agent Registration Migration - 2025-10-10`

3. **Copy the Migration SQL**
   - Open `apps/api/prisma/migrations/manual_staging_migration.sql`
   - Copy the entire content
   - Paste into the Supabase SQL Editor

4. **Review the SQL**
   - Scroll through and verify it looks correct
   - Pay special attention to:
     - Table names match your schema
     - Foreign keys reference correct tables
     - Default values are appropriate

5. **Run the Migration**
   - Click **Run** or press `Ctrl+Enter` (Windows/Linux) or `Cmd+Enter` (Mac)
   - Wait for completion (should take 5-30 seconds)
   - Check for any errors in the output panel

6. **Verify Success**
   - Run the verification queries at the bottom of the migration file
   - Or use the queries provided below in the Verification section

### Option 2: Using Supabase CLI

```bash
# 1. Install Supabase CLI (if not already installed)
npm install -g supabase

# 2. Login to Supabase
supabase login

# 3. Link to your staging project
supabase link --project-ref <your-project-ref>

# 4. Run the migration
supabase db execute --file apps/api/prisma/migrations/manual_staging_migration.sql

# 5. Verify migration
supabase db execute --file verification_queries.sql
```

### Option 3: Using psql (Direct Connection)

```bash
# 1. Get your Supabase connection string
# Dashboard → Settings → Database → Connection string

# 2. Run the migration
psql "postgresql://postgres:[YOUR-PASSWORD]@[HOST]:5432/postgres" \
  -f apps/api/prisma/migrations/manual_staging_migration.sql

# 3. Check for errors in output
```

## ✅ Post-Migration Verification

### 1. Verify New Tables

Run this query in Supabase SQL Editor:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'brand_ambassadors',
  'agent_registrations',
  'ba_payouts',
  'missing_requirements',
  'deferred_requirements_default',
  'deferred_requirements_partner'
)
ORDER BY table_name;
```

**Expected Result:** All 6 tables should be listed.

### 2. Verify New Columns in Customers Table

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'customers'
AND column_name IN ('createdBy', 'updatedBy', 'hasMissingRequirements')
ORDER BY column_name;
```

**Expected Result:**
| column_name | data_type | is_nullable |
|-------------|-----------|-------------|
| createdBy | text | YES |
| hasMissingRequirements | boolean | NO |
| updatedBy | text | YES |

### 3. Verify New Columns in Beneficiaries Table

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'beneficiaries'
AND column_name IN ('email', 'phoneNumber', 'isVerified', 'verifiedAt', 'verifiedBy', 'relationshipDescription')
ORDER BY column_name;
```

**Expected Result:** All 6 columns should be listed.

### 4. Verify New Enums

```sql
SELECT typname, array_agg(enumlabel ORDER BY enumsortorder) as values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typtype = 'e' 
AND typname LIKE '%Registration%' OR typname LIKE '%BAPayout%'
GROUP BY typname
ORDER BY typname;
```

**Expected Result:** Should show 4 enums:
- `BAPayoutStatus`
- `RegistrationEntityKind`
- `RegistrationMissingStatus`
- `RegistrationStatus`

### 5. Verify Foreign Keys

```sql
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name IN ('brand_ambassadors', 'agent_registrations', 'missing_requirements')
ORDER BY tc.table_name, kcu.column_name;
```

**Expected Result:** Should show foreign keys for all new tables.

### 6. Verify Default Data

```sql
SELECT entity_kind, field_path 
FROM deferred_requirements_default 
ORDER BY entity_kind, field_path;
```

**Expected Result:** 6 rows with default deferred requirements:
- BENEFICIARY / dateOfBirth
- BENEFICIARY / idNumber
- CHILD / dateOfBirth
- CHILD / idNumber
- SPOUSE / dateOfBirth
- SPOUSE / idNumber

### 7. Count Records in New Tables

```sql
SELECT 
  'brand_ambassadors' as table_name, COUNT(*) as count FROM brand_ambassadors
UNION ALL
SELECT 
  'agent_registrations', COUNT(*) FROM agent_registrations
UNION ALL
SELECT 
  'ba_payouts', COUNT(*) FROM ba_payouts
UNION ALL
SELECT 
  'missing_requirements', COUNT(*) FROM missing_requirements
UNION ALL
SELECT 
  'deferred_requirements_default', COUNT(*) FROM deferred_requirements_default
UNION ALL
SELECT 
  'deferred_requirements_partner', COUNT(*) FROM deferred_requirements_partner;
```

**Expected Result:** 
- All tables should exist (count >= 0)
- `deferred_requirements_default` should have 6 rows

## 🔧 Update Prisma Client

After successful migration, update your Prisma client:

```bash
# Navigate to API directory
cd apps/api

# Update DATABASE_URL to point to staging (temporarily)
# Or create .env.staging

# Pull the schema to verify
npx prisma db pull

# Generate Prisma Client
npx prisma generate
```

## 🚀 Deploy Updated Code

Once migration is verified:

```bash
# 1. Build the API
cd apps/api
pnpm build

# 2. Deploy to Fly.io staging
fly deploy -a microbima-staging-api

# 3. Deploy agent registration app
cd ../agent-registration
fly deploy -a maishapoa-staging-agent-registration

# 4. Verify deployments
fly status -a microbima-staging-api
fly status -a maishapoa-staging-agent-registration
```

## 🧪 Test the Deployment

1. **Test API Health**
   ```bash
   curl https://microbima-staging-api.fly.dev/api/health
   ```

2. **Test Brand Ambassador Creation**
   ```bash
   # Use your staging API URL and credentials
   curl -X POST https://microbima-staging-api.fly.dev/api/internal/partner-management/partners/1/brand-ambassadors \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "userId": "test-user-id",
       "displayName": "Test BA",
       "phoneNumber": "+254700000000"
     }'
   ```

3. **Test Customer Registration Flow**
   - Navigate to: https://maishapoa-staging-agent-registration.fly.dev
   - Log in as a Brand Ambassador
   - Test creating a customer
   - Test adding beneficiaries
   - Verify data is saved correctly

## 🔥 Troubleshooting

### Issue: "relation already exists"
**Cause:** Migration was partially run before.
**Solution:** The migration uses `IF NOT EXISTS` and `DO $$ BEGIN...EXCEPTION` blocks to handle this. Re-running should be safe.

### Issue: "column already exists"
**Cause:** Some columns were manually added before.
**Solution:** The migration uses `ADD COLUMN IF NOT EXISTS` to handle this safely.

### Issue: "foreign key violation"
**Cause:** Existing data doesn't match new constraints.
**Solution:** Review existing data and fix inconsistencies before re-running.

### Issue: Migration transaction fails
**Cause:** Some part of the migration failed.
**Solution:** 
1. Check the error message
2. The transaction will rollback automatically
3. Fix the issue in the SQL file
4. Re-run the migration

## 🔄 Rollback Plan

If you need to rollback the migration:

### Option 1: Restore from Backup (Safest)

1. Go to Supabase Dashboard → Database → Backups
2. Find the backup created before migration
3. Click "Restore"

### Option 2: Manual Rollback (Advanced)

```sql
BEGIN;

-- Drop new tables
DROP TABLE IF EXISTS "ba_payouts" CASCADE;
DROP TABLE IF EXISTS "missing_requirements" CASCADE;
DROP TABLE IF EXISTS "deferred_requirements_partner" CASCADE;
DROP TABLE IF EXISTS "deferred_requirements_default" CASCADE;
DROP TABLE IF EXISTS "agent_registrations" CASCADE;
DROP TABLE IF EXISTS "brand_ambassadors" CASCADE;

-- Drop new enums
DROP TYPE IF EXISTS "BAPayoutStatus";
DROP TYPE IF EXISTS "RegistrationEntityKind";
DROP TYPE IF EXISTS "RegistrationMissingStatus";
DROP TYPE IF EXISTS "RegistrationStatus";

-- Remove new columns from existing tables
ALTER TABLE "customers" 
  DROP COLUMN IF EXISTS "createdBy",
  DROP COLUMN IF EXISTS "updatedBy",
  DROP COLUMN IF EXISTS "hasMissingRequirements";

ALTER TABLE "beneficiaries"
  DROP COLUMN IF EXISTS "email",
  DROP COLUMN IF EXISTS "phoneNumber",
  DROP COLUMN IF EXISTS "isVerified",
  DROP COLUMN IF EXISTS "verifiedAt",
  DROP COLUMN IF EXISTS "verifiedBy",
  DROP COLUMN IF EXISTS "relationshipDescription";

ALTER TABLE "dependants"
  DROP COLUMN IF EXISTS "phoneNumber",
  DROP COLUMN IF EXISTS "isVerified",
  DROP COLUMN IF EXISTS "verifiedAt",
  DROP COLUMN IF EXISTS "verifiedBy";

-- Remove unique index
DROP INDEX IF EXISTS "customers_idType_idNumber_key";

COMMIT;
```

## 📝 Migration Checklist

Use this checklist when running the migration:

- [ ] Database backup created
- [ ] Staging API stopped/scaled down
- [ ] Migration SQL reviewed
- [ ] Migration executed successfully
- [ ] All verification queries passed
- [ ] Prisma client regenerated
- [ ] Code deployed to staging
- [ ] Health endpoints responding
- [ ] Customer registration tested
- [ ] Beneficiary creation tested
- [ ] Team notified of completion

## 📞 Support

If you encounter issues:

1. Check the error message carefully
2. Review the Troubleshooting section above
3. Check Supabase logs: Dashboard → Database → Logs
4. Check API logs: `fly logs -a microbima-staging-api`
5. Restore from backup if needed

## 🎉 Success Criteria

Migration is successful when:

- ✅ All 6 new tables exist
- ✅ All 4 new enums exist
- ✅ All new columns added to existing tables
- ✅ All foreign keys created successfully
- ✅ Default deferred requirements inserted
- ✅ API health endpoint responds
- ✅ Customer registration flow works
- ✅ Beneficiary creation works
- ✅ No errors in application logs

