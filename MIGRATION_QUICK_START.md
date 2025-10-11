# 🚀 Quick Start: Staging Migration

## TL;DR - Run This Migration in 5 Minutes

### Step 1: Backup (1 min)
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your staging project
3. Database → Backups → **Create backup**
4. Wait for completion ✅

### Step 2: Run Migration (2 min)
1. In Supabase Dashboard, go to **SQL Editor**
2. Click **+ New query**
3. Copy content from: `apps/api/prisma/migrations/manual_staging_migration.sql`
4. Paste and click **Run** ✅

### Step 3: Verify (1 min)
Run this verification query:
```sql
-- Quick verification
SELECT 'Tables' as type, COUNT(*) as count 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('brand_ambassadors', 'agent_registrations', 'ba_payouts', 'missing_requirements')

UNION ALL

SELECT 'Deferred Requirements', COUNT(*) 
FROM deferred_requirements_default;
```

**Expected:** 
- Tables: 4 ✅
- Deferred Requirements: 6 ✅

### Step 4: Deploy Code (1 min)
```bash
# Deploy API
fly deploy -a microbima-staging-api

# Deploy Agent Registration
fly deploy -a maishapoa-staging-agent-registration
```

### Step 5: Test (30 sec)
```bash
# Test API
curl https://microbima-staging-api.fly.dev/api/health

# Test in browser
# https://maishapoa-staging-agent-registration.fly.dev
```

## 📋 What This Migration Does

### New Features Added:
✅ Brand Ambassador Management
✅ Agent Registration Tracking  
✅ Missing Requirements System
✅ Deferred Requirements Config
✅ BA Payout Tracking

### Schema Changes:
- **6 new tables** created
- **4 new enums** created
- **3 new columns** in `customers` table
- **6 new columns** in `beneficiaries` table
- **4 new columns** in `dependants` table

## 🔥 Quick Troubleshooting

### Error: "relation already exists"
✅ **Safe to ignore** - Migration handles this with IF NOT EXISTS

### Error: "column already exists"  
✅ **Safe to ignore** - Migration uses ADD COLUMN IF NOT EXISTS

### Error: Something else
❌ **Check the error** → Migration will auto-rollback
📖 **See full guide**: `SUPABASE_MIGRATION_GUIDE.md`

## 🆘 Emergency Rollback

If things go wrong:

### Quick Rollback (Supabase Dashboard):
1. Database → Backups
2. Find backup from before migration
3. Click **Restore**
4. Confirm

### Or run this rollback SQL:
See `SUPABASE_MIGRATION_GUIDE.md` → Rollback section

## 📚 Full Documentation

For detailed information, see:
- `SUPABASE_MIGRATION_GUIDE.md` - Complete migration guide
- `STAGING_DEPLOYMENT_GUIDE.md` - General deployment guide
- `apps/api/prisma/migrations/manual_staging_migration.sql` - The actual SQL

## ✅ Success Checklist

Run through this after migration:

- [ ] Migration completed without errors
- [ ] Verification query returns expected counts
- [ ] API deployed successfully
- [ ] Agent Registration app deployed
- [ ] Health endpoint responds: `/api/health`
- [ ] Can log into agent registration app
- [ ] Can create a customer
- [ ] Can add beneficiaries
- [ ] No errors in `fly logs`

## 🎉 You're Done!

Once all checks pass, your staging environment is ready with:
- Full agent registration functionality
- Brand ambassador tracking
- Deferred requirements system
- Enhanced customer and beneficiary data

**Total Time: ~5-10 minutes** ⏱️

