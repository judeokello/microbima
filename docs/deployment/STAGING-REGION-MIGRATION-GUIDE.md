# Staging Region Migration Guide

## Overview

This guide provides step-by-step instructions for migrating staging Fly.io apps from Tokyo (nrt) to Frankfurt (fra) to resolve performance issues caused by geographic latency.

**Problem:**
- Staging apps are in Tokyo (nrt) or wrong region
- Staging database is in US East 2 (Ohio, USA)
- This causes 200-300ms latency per query
- Impact: 8.5x slower migrations, 21x slower seeding, 17+ second form submissions

**Solution:**
- Move staging apps to Frankfurt (fra) to match production
- Move staging database to EU Central 1 (Frankfurt) to match production
- This will reduce latency to 5-10ms per query

## Prerequisites

- [ ] Fly.io CLI installed and authenticated
- [ ] Access to staging Supabase project
- [ ] Backup of all secrets (use `scripts/extract-fly-secrets.sh`)
- [ ] Review of current app regions (verify they're actually in Tokyo)

## Step 1: Verify Current App Regions

Before migrating, verify where your apps actually are:

```bash
# Check app regions
flyctl status -a maishapoa-staging-internal-api
flyctl status -a maishapoa-staging-agent-registration
flyctl status -a microbima-staging-public-api

# Check database regions from connection strings
flyctl ssh console -a maishapoa-staging-internal-api -C "printenv DATABASE_URL"
flyctl ssh console -a maishapoa-staging-internal-api -C "printenv DIRECT_URL"
```

**Expected findings:**
- Apps may be in Tokyo (nrt) despite fly.toml saying "fra"
- Database pooler: `aws-1-us-east-2.pooler.supabase.com` (US East 2)
- Database direct: `db.*.supabase.co` (likely US East 2)

## Step 2: Extract All Secrets

**CRITICAL: Do this BEFORE any migration to ensure you have all configuration.**

```bash
# Run the extraction script
./scripts/extract-fly-secrets.sh
```

This will:
1. Extract all secrets from each staging app
2. Save them to `fly-secrets-backup/YYYYMMDD-HHMMSS/`
3. Create both human-readable and flyctl command formats

**Review the output files** to ensure all secrets are captured.

## Step 3: Verify Database Region

Check your Supabase project region:

1. Go to Supabase Dashboard → Your Staging Project
2. Go to Settings → Infrastructure
3. Check the region (should show US East 2 or similar)

**Note:** Moving the database region requires:
- Creating a new Supabase project in EU Central 1, OR
- Using Supabase's region migration feature (if available)
- This is a separate process from app migration

## Step 4: Create New Apps in Frankfurt

**Option A: Create New Apps (Recommended - Zero Downtime)**

This approach creates new apps in Frankfurt while keeping old apps running:

```bash
# Create new apps in Frankfurt
flyctl apps create maishapoa-staging-internal-api-fra --org <your-org> --region fra
flyctl apps create maishapoa-staging-agent-registration-fra --org <your-org> --region fra
flyctl apps create microbima-staging-public-api-fra --org <your-org> --region fra
```

**Option B: Use Existing App Names (Requires Downtime)**

If you want to keep the same app names:

```bash
# Note: This will cause downtime during migration
# The apps will be recreated in Frankfurt on first deployment
# Just deploy with the fly.toml that has primary_region = "fra"
```

## Step 5: Set Secrets on New Apps

Use the extracted secrets from Step 2:

```bash
# For each app, set all secrets
# Example for internal-api:
cd fly-secrets-backup/<timestamp>/
cat maishapoa-staging-internal-api-secrets.txt

# Copy the flyctl command from the file and update the app name
flyctl secrets set \
  DATABASE_URL="..." \
  DIRECT_URL="..." \
  JWT_SECRET="..." \
  # ... all other secrets
  -a maishapoa-staging-internal-api-fra
```

**Important:**
- Update `DATABASE_URL` to point to EU Central 1 database (after database migration)
- Update `DIRECT_URL` to point to EU Central 1 database
- Keep all other secrets exactly as they were

## Step 6: Deploy to New Apps

Deploy using the existing fly.toml files (they already have `primary_region = "fra"`):

```bash
# Deploy internal API
flyctl deploy -a maishapoa-staging-internal-api-fra \
  -c infra/fly/internal-api/staging/fly.toml

# Deploy agent registration
flyctl deploy -a maishapoa-staging-agent-registration-fra \
  -c infra/fly/agent-registration/staging/fly.toml

# Deploy public API
flyctl deploy -a microbima-staging-public-api-fra \
  -c infra/fly/public-api/staging/fly.toml
```

## Step 7: Verify New Deployments

```bash
# Check app status
flyctl status -a maishapoa-staging-internal-api-fra

# Check health endpoints
curl -f https://maishapoa-staging-internal-api-fra.fly.dev/api/health

# Check logs
flyctl logs -a maishapoa-staging-internal-api-fra
```

## Step 8: Update GitHub Actions Workflow

Update `.github/workflows/deploy.yml` to use new app names:

```yaml
# Change from:
flyctl deploy -a maishapoa-staging-internal-api

# To:
flyctl deploy -a maishapoa-staging-internal-api-fra
```

**OR** if using same names, just ensure fly.toml has `primary_region = "fra"`.

## Step 9: Database Migration (Separate Process)

Moving the database is a separate process:

### Option A: Create New Supabase Project in EU Central 1

1. Create new Supabase project in EU Central 1 region
2. Export data from old project
3. Import data to new project
4. Update connection strings in Fly.io secrets
5. Run migrations on new database

### Option B: Use Supabase Region Migration (if available)

Check Supabase documentation for region migration features.

## Step 10: Cutover (Zero Downtime Approach)

If you created new apps with `-fra` suffix:

1. **Test new apps thoroughly** in parallel with old apps
2. **Update DNS/URLs** to point to new apps
3. **Monitor for 24-48 hours**
4. **Delete old apps** once confirmed stable:

```bash
# Only after confirming new apps work perfectly
flyctl apps destroy maishapoa-staging-internal-api
flyctl apps destroy maishapoa-staging-agent-registration
flyctl apps destroy microbima-staging-public-api
```

## Step 11: Clean Up

1. Remove old app secrets backup (after confirming migration success)
2. Update documentation with new app names/regions
3. Update team on new URLs

## Expected Performance Improvements

After migration:

- **Deployment time:** 25m 3s → ~14-15 minutes (matching production)
- **Migration time:** 8m 34s → ~1-2 minutes
- **Seeding time:** 5m 47s → ~16 seconds
- **Form submission:** 17+ seconds → <2 seconds
- **Query latency:** 200-300ms → 5-10ms

## Troubleshooting

### App Creation Fails

```bash
# Check if app name already exists
flyctl apps list | grep staging

# Use different name or delete old app (if safe)
```

### Secrets Not Working

```bash
# Verify secrets are set
flyctl secrets list -a <app-name>

# Check secret values (masked)
flyctl secrets show -a <app-name> <secret-name>
```

### Deployment Fails

```bash
# Check logs
flyctl logs -a <app-name>

# Check app status
flyctl status -a <app-name>

# Verify fly.toml configuration
cat infra/fly/<app>/staging/fly.toml
```

### Database Connection Issues

```bash
# Test database connection from container
flyctl ssh console -a <app-name> -C "printenv DATABASE_URL"
flyctl ssh console -a <app-name> -C "printenv DIRECT_URL"

# Test connection
flyctl ssh console -a <app-name> -C "cd /app/apps/api && npx prisma db execute --stdin" <<< "SELECT 1;"
```

## Rollback Plan

If something goes wrong:

1. **Keep old apps running** (don't delete until new apps are confirmed)
2. **Revert GitHub Actions changes** to point to old apps
3. **Update secrets** on old apps if needed
4. **Investigate issues** before retrying migration

## Safety Checklist

Before starting migration:

- [ ] All secrets extracted and backed up
- [ ] Current app regions verified
- [ ] Database region confirmed
- [ ] New Supabase project created (if migrating database)
- [ ] Team notified of potential downtime
- [ ] Rollback plan documented
- [ ] Test plan prepared

During migration:

- [ ] Old apps remain running
- [ ] New apps tested thoroughly
- [ ] All health checks passing
- [ ] Performance metrics verified

After migration:

- [ ] All functionality working
- [ ] Performance improved as expected
- [ ] Old apps can be safely deleted
- [ ] Documentation updated

## Related Documentation

- [Fly.io Region Migration](https://fly.io/docs/app-guides/region-migration/)
- [Supabase Region Selection](https://supabase.com/docs/guides/platform/regions)
- [Prisma Migration Performance Guide](../apps/api/docs/SUPABASE_MIGRATION_PERFORMANCE.md)

