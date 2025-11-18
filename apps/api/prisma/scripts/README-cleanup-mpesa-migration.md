# Complete Rollback Script for MPESA Payment Tables Migration

## Problem
A duplicate migration `20250202150000_add_mpesa_payment_tables` was created and applied on staging, but then removed locally and replaced with `20251107010514_add_mpesa_payment_tables`. This causes Prisma to see two migrations, with one already applied, leading to conflicts.

## Solution
Run the SQL rollback script directly in Supabase SQL Editor to completely undo everything the MPESA migration did, then redeploy for a clean migration path.

## Steps

### 1. Open Supabase SQL Editor
1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Select your staging database

### 2. Run the Rollback Script
Copy and paste the entire contents of `apps/api/prisma/scripts/rollback-mpesa-migration-complete.sql` into the SQL Editor and run it.

**File location:** `apps/api/prisma/scripts/rollback-mpesa-migration-complete.sql`

This script will:
1. ✅ Drop foreign key constraints
2. ✅ Drop indexes (`idx_transaction_reference`, `idx_mpesa_payment_report_upload_id`)
3. ✅ Drop tables (`mpesa_payment_report_items`, `mpesa_payment_report_uploads`)
4. ✅ Drop enum type (`MpesaStatementReasonType`)
5. ✅ Remove migration entries from `_prisma_migrations` table for both:
   - `20250202150000_add_mpesa_payment_tables` (old duplicate)
   - `20251107010514_add_mpesa_payment_tables` (new migration)

The script includes verification queries at the end that will show you the cleanup status.

### 3. Verify Cleanup
After running the script, check the verification queries output. You should see:
- ✅ All tables dropped successfully
- ✅ Enum dropped successfully  
- ✅ Migration entries removed successfully

### 4. Verify Migration Status (Optional)
You can also verify via command line:

```bash
flyctl ssh console -a maishapoa-staging-internal-api -C "sh -c 'cd /app/apps/api && npx prisma migrate status'"
```

You should see `20251107010514_add_mpesa_payment_tables` as a pending migration.

### 5. Redeploy
Push to staging branch or trigger deployment. The migration `20251107010514_add_mpesa_payment_tables` will run cleanly from scratch.

## What Gets Removed

The script completely removes:
- **Tables:** `mpesa_payment_report_items`, `mpesa_payment_report_uploads` (and all their data)
- **Indexes:** `idx_transaction_reference`, `idx_mpesa_payment_report_upload_id`
- **Enum:** `MpesaStatementReasonType`
- **Foreign Keys:** `mpesa_payment_report_items_mpesaPaymentReportUploadId_fkey`
- **Migration Tracking:** Entries in `_prisma_migrations` table

⚠️ **Warning:** This will delete all MPESA payment data that was uploaded. Make sure you have backups if needed.

## Migration File

The migration file `20251107010514_add_mpesa_payment_tables/migration.sql` is idempotent (uses `IF NOT EXISTS` and exception handling), so it will work correctly whether objects exist or not. This provides safety for production deployments.

## Production

The same migration will work cleanly in production since it hasn't been applied there yet. No staging-specific workarounds are needed in the deployment workflow.

