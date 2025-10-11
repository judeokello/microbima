# Clean Database Schema Migration - Quick Start

## ✅ You've Already Done
- Deleted all data from tables
- Database is clean and ready

## ⚡ Quick Commands

```bash
# 1. Set staging URL
export STAGING_DB_URL="your-staging-connection-string"

# 2. Run schema migration
cd apps/api
psql $STAGING_DB_URL -f scripts/schema-only-migration.sql

# 3. Sync Prisma
npm exec prisma db push

# 4. Done! ✅
```

## 📊 What This Does

**Schema Changes:**
- ✅ Adds `UNIQUE(idType, idNumber)` constraint on customers
- ✅ Records migration in `_prisma_migrations`
- ✅ Verifies all enums exist

**Data Changes:**
- ❌ **NONE** - Zero data insertion or modification

## 🎯 Files to Use

| File | Purpose |
|------|---------|
| `schema-only-migration.sql` | Main migration script |
| `RUN-SCHEMA-MIGRATION.md` | Detailed guide |
| This file | Quick reference |

## ✅ Success Indicators

After running, you should see:
```
✅ No duplicates found - safe to proceed
✅ Unique constraint created successfully
✅ All enum types verified
✅ Migration recorded in _prisma_migrations
✅ SCHEMA MIGRATION SUCCESSFUL!
```

## 🔍 Quick Verify

```bash
# Check constraint exists
psql $STAGING_DB_URL -c "
  SELECT conname FROM pg_constraint 
  WHERE conname = 'unique_id_type_number';
"
# Should return: unique_id_type_number

# Check migration recorded
psql $STAGING_DB_URL -c "
  SELECT migration_name FROM _prisma_migrations 
  ORDER BY started_at DESC LIMIT 1;
"
# Should return: 20251010_add_unique_constraint_customer_id_type_number
```

## 🚀 Next Steps

1. Test duplicate prevention via API
2. Seed database if needed: `npm run db:seed`
3. Deploy your application
4. Celebrate! 🎉

## 📞 Need Help?

See `RUN-SCHEMA-MIGRATION.md` for:
- Detailed verification steps
- Troubleshooting guide
- Rollback instructions
- Testing procedures

