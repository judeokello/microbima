# Staging Deployment Guide

## Database Schema Changes

Since development, we've made several schema changes using `prisma db push` that need to be applied to staging.

### Option 1: Generate Migration from Current Schema (RECOMMENDED)

This will create a migration that brings staging in sync with your current development schema.

```bash
# 1. Navigate to API directory
cd apps/api

# 2. Create a new migration from current schema
# This will compare staging DB with your schema and create a migration
npx prisma migrate deploy --preview-feature

# OR use this approach:
# First, ensure your .env points to staging database
# Then create the migration
npx prisma migrate dev --name add_agent_registration_features

# 3. Review the generated migration file in prisma/migrations/
# It will include all the changes since the last migration
```

### Option 2: Manual Migration Steps

If you want more control, here are the key schema changes that need to be applied:

#### New Tables Added:
1. **`brand_ambassadors`** - Brand Ambassador records
2. **`agent_registrations`** - Agent registration tracking
3. **`ba_payouts`** - Brand Ambassador payout tracking
4. **`missing_requirements`** - Deferred/missing field tracking
5. **`deferred_requirements_default`** - Default deferred requirements config
6. **`deferred_requirements_partner`** - Partner-specific deferred requirements

#### New Enums Added:
1. **`RegistrationStatus`** - DRAFT, SUBMITTED, APPROVED, REJECTED
2. **`RegistrationMissingStatus`** - PENDING, SUBMITTED, APPROVED, REJECTED
3. **`RegistrationEntityKind`** - CUSTOMER, SPOUSE, CHILD, BENEFICIARY
4. **`BAPayoutStatus`** - PENDING, PROCESSING, PAID, FAILED, CANCELLED

#### Modified Tables:

**`customers` table:**
- Added: `createdBy` (String, nullable) - User ID who created
- Added: `updatedBy` (String, nullable) - User ID who last updated
- Added: `hasMissingRequirements` (Boolean, default false)
- Modified: `email` - Changed from required to optional/nullable
- Added: Unique constraint on `(idType, idNumber)`

**`beneficiaries` table:**
- Added: `email` (String, nullable, max 100 chars)
- Added: `phoneNumber` (String, nullable, max 20 chars)
- Added: `isVerified` (Boolean, default false)
- Added: `verifiedAt` (DateTime, nullable)
- Added: `verifiedBy` (String/UUID, nullable)
- Added: `relationshipDescription` (String, nullable) - For "other" relationship type

**`dependants` table:**
- Added: `phoneNumber` (String, nullable, max 20 chars)
- Added: `isVerified` (Boolean, default false)
- Added: `verifiedAt` (DateTime, nullable)
- Added: `verifiedBy` (String/UUID, nullable)

### Deployment Steps for Staging

#### Prerequisites:
1. Backup staging database
2. Ensure you have staging database credentials
3. Stop staging API to prevent conflicts

#### Step-by-Step:

```bash
# 1. Backup staging database first!
pg_dump $STAGING_DATABASE_URL > staging_backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Update environment variables to point to staging
# Edit apps/api/.env or create apps/api/.env.production
DATABASE_URL="<your-staging-database-url>"

# 3. Generate migration from schema
cd apps/api
npx prisma migrate deploy

# 4. Verify migration was applied
npx prisma migrate status

# 5. Check database
npx prisma studio
# Or
npx prisma db pull
```

#### If Using Fly.io:

```bash
# 1. Get staging database URL
fly postgres connect -a <your-postgres-app-name>

# 2. Or run migrations directly on Fly
fly ssh console -a <your-api-app-name>
cd /app
npx prisma migrate deploy

# 3. Verify
npx prisma migrate status
```

### Post-Deployment Verification

After deploying migrations, verify:

1. **Check Tables Exist:**
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
   );
   ```

2. **Check New Columns:**
   ```sql
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'customers'
   AND column_name IN ('createdBy', 'updatedBy', 'hasMissingRequirements');
   
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'beneficiaries'
   AND column_name IN ('email', 'phoneNumber', 'isVerified', 'verifiedAt', 'verifiedBy');
   ```

3. **Test API Health:**
   ```bash
   curl https://your-staging-api.fly.dev/api/health
   ```

### Rollback Plan

If something goes wrong:

```bash
# Restore from backup
psql $STAGING_DATABASE_URL < staging_backup_<timestamp>.sql

# Or revert specific migration
cd apps/api
npx prisma migrate resolve --rolled-back <migration-name>
```

### Important Notes

1. **Don't use `prisma db push` in production/staging** - It's for development only
2. **Always use `prisma migrate deploy`** for production/staging deployments
3. **Test migrations on a staging clone first** before applying to production
4. **Keep migration files in version control** (they're already in git)
5. **Run `prisma generate`** after migrations to update Prisma Client

### Current Migration Status

As of this guide:
- **Local Dev**: All changes applied via `db push`
- **Migration Files**: 4 existing migrations
- **Pending Changes**: New tables (agent_registrations, brand_ambassadors, etc.) + field additions

### Environment-Specific Considerations

**Staging:**
- Use `prisma migrate deploy` (doesn't prompt for confirmation)
- Set `DATABASE_URL` to staging database
- Run in CI/CD pipeline or manually via SSH

**Production:**
- Same as staging but with production DATABASE_URL
- Always test migration on staging first
- Consider maintenance window for large migrations
- Monitor application after deployment

## Code Deployment

After database migrations are complete:

1. **Deploy API Changes:**
   ```bash
   # Fly.io example
   fly deploy -a microbima-staging-api
   ```

2. **Deploy Agent Registration App:**
   ```bash
   fly deploy -a maishapoa-staging-agent-registration
   ```

3. **Verify Deployment:**
   - Check health endpoints
   - Test customer registration flow
   - Test beneficiary creation
   - Verify Brand Ambassador functionality

## Data Seeding (if needed)

If you need to seed default data:

```bash
# Create default deferred requirements
# This should be in a seed script or manual SQL
INSERT INTO deferred_requirements_default (entity_kind, field_path, created_at, updated_at)
VALUES 
  ('SPOUSE', 'dateOfBirth', NOW(), NOW()),
  ('SPOUSE', 'idNumber', NOW(), NOW()),
  ('CHILD', 'dateOfBirth', NOW(), NOW()),
  ('CHILD', 'idNumber', NOW(), NOW()),
  ('BENEFICIARY', 'dateOfBirth', NOW(), NOW()),
  ('BENEFICIARY', 'idNumber', NOW(), NOW())
ON CONFLICT (entity_kind, field_path) DO NOTHING;
```

## Monitoring

After deployment, monitor:
1. Application logs (`fly logs`)
2. Database performance
3. API response times
4. Error rates in Sentry
5. Customer registration success rates

