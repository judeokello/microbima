# Migration Cleanup Guide: verification_required_to_dependants

## Issue
A migration was initially created with incorrect timestamp `20250202150000_add_verification_required_to_dependants` which placed it chronologically before later migrations. This has been corrected to `20251105174320_add_verification_required_to_dependants`.

## Impact Assessment

### ✅ Safe Migration SQL
The migration SQL is **idempotent** - it checks if the column exists before adding it:
```sql
IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dependants' AND column_name = 'verificationRequired'
) THEN
    ALTER TABLE "dependants" ADD COLUMN "verificationRequired" BOOLEAN NOT NULL DEFAULT false;
END IF;
```

This means:
- ✅ Running it multiple times won't cause errors
- ✅ If the old migration was already applied, the new one will be a no-op
- ✅ No data loss or corruption risk

### ⚠️ Potential Issues

1. **If old migration was already applied on staging:**
   - The `_prisma_migrations` table will show `20250202150000_add_verification_required_to_dependants` as applied
   - The new migration `20251105174320_add_verification_required_to_dependants` will also try to apply
   - Since SQL is idempotent, it won't fail, but Prisma will mark both as applied

2. **If old migration was partially applied:**
   - Column might exist but migration status might be inconsistent
   - New migration will complete successfully (idempotent check)

## Cleanup Steps (If Needed)

### Option 1: Automatic Cleanup (Recommended)
The migration SQL is idempotent, so no manual cleanup is required. The new migration will:
- Check if column exists (it will)
- Skip adding it (no-op)
- Mark migration as applied in `_prisma_migrations` table

### Option 2: Manual Cleanup (If you want to clean up migration history)
If you want to clean up the migration history table, you can manually remove the old migration record:

```bash
# Connect to staging database
flyctl ssh console -a microbima-staging-internal-api

# Check if old migration is recorded
cd /app/apps/api
npx prisma migrate status

# If you see the old migration (20250202150000) marked as applied and want to clean it up:
# (Only do this if you're sure the column already exists)
# You can manually delete the record from _prisma_migrations table if needed
```

**⚠️ Warning:** Only do manual cleanup if you understand the implications. The automatic approach is safer.

## Verification

After deployment, verify the migration was applied correctly:

```bash
# Check migration status
flyctl ssh console -a microbima-staging-internal-api -C "cd /app/apps/api && npx prisma migrate status"

# Verify column exists
flyctl ssh console -a microbima-staging-internal-api -C "cd /app/apps/api && echo \"SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'dependants' AND column_name = 'verificationRequired';\" | npx prisma db execute --stdin"
```

Expected result:
- Column `verificationRequired` exists with type `boolean` and default `false`
- Migration `20251105174320_add_verification_required_to_dependants` is marked as applied

## Prevention

To prevent this in the future:
1. Always use `npx prisma migrate dev --name <migration_name>` to create migrations
2. Never manually create migration folders with timestamps
3. Let Prisma generate the correct timestamp automatically

