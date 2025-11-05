# Debugging Migration: verification_required_to_dependants

## Issue
Migration `20251105174320_add_verification_required_to_dependants` is not applying during deployment.

## Diagnostic Commands

### 1. Check Migration Status
```bash
flyctl ssh console -a microbima-staging-internal-api
cd /app/apps/api
npx prisma migrate status
```

### 2. Check if Column Already Exists
```bash
flyctl ssh console -a microbima-staging-internal-api -C "cd /app/apps/api && echo \"SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns WHERE table_name = 'dependants' AND column_name = 'verificationRequired';\" | npx prisma db execute --stdin --schema prisma/schema.prisma"
```

### 3. Check Migration History
```bash
flyctl ssh console -a microbima-staging-internal-api -C "cd /app/apps/api && echo \"SELECT migration_name, finished_at, applied_steps_count FROM _prisma_migrations WHERE migration_name LIKE '%verification%' ORDER BY started_at DESC;\" | npx prisma db execute --stdin --schema prisma/schema.prisma"
```

### 4. Manually Test Migration SQL
```bash
flyctl ssh console -a microbima-staging-internal-api -C "cd /app/apps/api && cat prisma/migrations/20251105174320_add_verification_required_to_dependants/migration.sql | npx prisma db execute --stdin --schema prisma/schema.prisma"
```

### 5. Check Prisma Version in Container
```bash
flyctl ssh console -a microbima-staging-internal-api -C "cd /app/apps/api && npx prisma --version"
```

### 6. Verify Migration File Exists in Container
```bash
flyctl ssh console -a microbima-staging-internal-api -C "ls -la /app/apps/api/prisma/migrations/ | grep verification"
```

### 7. Check Migration File Content
```bash
flyctl ssh console -a microbima-staging-internal-api -C "cat /app/apps/api/prisma/migrations/20251105174320_add_verification_required_to_dependants/migration.sql"
```

## Common Issues and Solutions

### Issue 1: Migration File Not in Container
**Symptom**: Migration file doesn't exist in container
**Solution**: Ensure migration is committed and pushed to repository before deployment

### Issue 2: Column Already Exists
**Symptom**: Column exists but migration not marked as applied
**Solution**: 
```bash
flyctl ssh console -a microbima-staging-internal-api -C "cd /app/apps/api && npx prisma migrate resolve --applied 20251105174320_add_verification_required_to_dependants"
```

### Issue 3: Migration Partially Applied
**Symptom**: Migration marked as failed or rolled back
**Solution**:
```bash
# If column exists, mark as applied
flyctl ssh console -a microbima-staging-internal-api -C "cd /app/apps/api && npx prisma migrate resolve --applied 20251105174320_add_verification_required_to_dependants"

# If migration failed and needs to be rolled back
flyctl ssh console -a microbima-staging-internal-api -C "cd /app/apps/api && npx prisma migrate resolve --rolled-back 20251105174320_add_verification_required_to_dependants"
```

### Issue 4: Prisma Version Mismatch
**Symptom**: Migration syntax errors or compatibility issues
**Solution**: Ensure container has Prisma 6.19.0 installed (check package.json and Dockerfile)

### Issue 5: Database Connection Issues
**Symptom**: Timeout or connection errors
**Solution**: Check DIRECT_URL configuration for Supabase migrations

## Manual Migration Application

If automatic migration fails, you can manually apply:

```bash
flyctl ssh console -a microbima-staging-internal-api
cd /app/apps/api

# Run the migration SQL directly
cat prisma/migrations/20251105174320_add_verification_required_to_dependants/migration.sql | npx prisma db execute --stdin --schema prisma/schema.prisma

# Then mark as applied
npx prisma migrate resolve --applied 20251105174320_add_verification_required_to_dependants
```

## Expected Migration SQL

The migration should contain:
```sql
-- Add verificationRequired column to dependants table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'dependants' AND column_name = 'verificationRequired'
    ) THEN
        ALTER TABLE "dependants" ADD COLUMN "verificationRequired" BOOLEAN NOT NULL DEFAULT false;
        UPDATE "dependants" SET "verificationRequired" = false WHERE "verificationRequired" IS NULL;
    END IF;
END $$;
```

## Verification After Fix

After resolving the issue, verify:
1. Column exists: `SELECT column_name FROM information_schema.columns WHERE table_name = 'dependants' AND column_name = 'verificationRequired';`
2. Migration marked as applied: `npx prisma migrate status` should show no pending migrations
3. Default value set: All existing records should have `verificationRequired = false`

