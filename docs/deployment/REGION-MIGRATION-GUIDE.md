# Region Migration Guide: Tokyo to Frankfurt

**Migration Date**: October 16, 2025  
**From**: Tokyo, Japan (`nrt`)  
**To**: Frankfurt, Germany (`fra`)

---

## Overview

This guide helps you migrate your existing Fly.io applications from Tokyo region to Frankfurt region. This migration improves latency for European and African users and aligns better with your target market.

---

## Why Frankfurt?

| Benefit | Description |
|---------|-------------|
| **Lower Latency** | Better performance for European and African users |
| **High Capacity** | 2831 available capacity (vs Tokyo's 223) |
| **Timezone Alignment** | Better for support team working hours |
| **Cost-Effective** | Optimal for target market geography |
| **Reliability** | One of Fly.io's largest and most reliable regions |

---

## Pre-Migration Checklist

Before starting the migration:

- [ ] Backup all databases and critical data
- [ ] Document current app configurations
- [ ] Export all secrets from existing apps
- [ ] Notify team of planned maintenance window
- [ ] Schedule migration during low-traffic hours
- [ ] Have rollback plan ready

---

## Migration Options

### Option 1: Recreate Apps (Recommended)

This is the cleanest approach for renaming apps and changing regions simultaneously.

#### Step 1: Export Current Configuration

```bash
# List current apps and their regions
flyctl apps list

# For each app, export secrets (names only)
flyctl secrets list -a microbima-production-internal-api > internal-api-secrets.txt
flyctl secrets list -a microbima-production-public-api > public-api-secrets.txt
flyctl secrets list -a maishapoa-production-agent-registration > agent-reg-secrets.txt

# Export current app configuration
flyctl config show -a microbima-production-internal-api > internal-api-config.txt
flyctl config show -a microbima-production-public-api > public-api-config.txt
```

#### Step 2: Create Backup of Secrets

**Important**: Secret values are not shown in the list. You need to have them stored securely (e.g., in a password manager or secrets vault).

```bash
# Example: Export secrets to a secure file (manual entry required)
cat > production-secrets.env <<EOF
# Internal API Secrets
DATABASE_URL=postgresql://...
JWT_SECRET=...
SENTRY_DSN=...

# Agent Registration Secrets
SUPABASE_SERVICE_ROLE_KEY=...

# Public API Secrets
KONG_SECRET=...
EOF

# Secure the file
chmod 600 production-secrets.env
```

#### Step 3: Destroy Old Apps

**⚠️ WARNING**: This will delete the apps. Ensure you have backups!

```bash
# Destroy old apps
flyctl apps destroy microbima-production-internal-api
flyctl apps destroy microbima-production-public-api

# Only if you need to recreate with new name
# flyctl apps destroy maishapoa-production-agent-registration
```

#### Step 4: Create New Apps

```bash
# View available regions to confirm Frankfurt is available
flyctl platform regions

# Create new apps (region will be set from fly.toml on first deploy)
flyctl apps create maishapoa-production-internal-api --org maisha-poa-org
flyctl apps create maishapoa-production-public-api --org maisha-poa-org
flyctl apps create maishapoa-production-agent-registration --org maisha-poa-org

# Note: The fly.toml files have primary_region = "fra"
# Apps will be provisioned in Frankfurt when you first deploy
```

#### Step 5: Configure Secrets

```bash
# Internal API secrets
flyctl secrets set \
  DATABASE_URL="postgresql://..." \
  JWT_SECRET="..." \
  SENTRY_DSN="..." \
  API_KEY="..." \
  -a maishapoa-production-internal-api

# Agent Registration secrets
flyctl secrets set \
  SUPABASE_SERVICE_ROLE_KEY="..." \
  -a maishapoa-production-agent-registration

# Public API secrets (if any)
flyctl secrets set \
  KONG_SECRET="..." \
  -a maishapoa-production-public-api
```

#### Step 6: Deploy to New Apps

```bash
# Deploy each app with updated fly.toml
# This is when the apps get provisioned in Frankfurt (fra)
flyctl deploy -a maishapoa-production-internal-api \
  -c infra/fly/internal-api/production/fly.toml

flyctl deploy -a maishapoa-production-agent-registration \
  -c infra/fly/agent-registration/production/fly.toml

flyctl deploy -a maishapoa-production-public-api \
  -c infra/fly/public-api/production/fly.toml

# The fly.toml files contain primary_region = "fra"
# Fly.io will create the VMs in Frankfurt automatically
```

#### Step 7: Verify Deployment

```bash
# Check app status
flyctl status -a maishapoa-production-internal-api
flyctl status -a maishapoa-production-agent-registration
flyctl status -a maishapoa-production-public-api

# Test health endpoints
curl https://maishapoa-production-internal-api.fly.dev/api/health
curl https://maishapoa-production-agent-registration.fly.dev/
curl https://maishapoa-production-public-api.fly.dev/

# Check logs for errors
flyctl logs -a maishapoa-production-internal-api
```

---

### Option 2: Redeploy Existing Apps (Simpler Alternative)

If your apps are already named correctly (e.g., `maishapoa-*`), you can simply redeploy with the updated fly.toml.

**Note**: This is simpler but you keep the same app name.

#### Step 1: Deploy with Updated fly.toml

```bash
# The fly.toml now has primary_region = "fra"
# Deploying will move the app to Frankfurt
flyctl deploy -a maishapoa-production-internal-api \
  -c infra/fly/internal-api/production/fly.toml

# Fly.io will provision new instances in Frankfurt
```

#### Step 2: Scale Down Old Region Instances (if needed)

```bash
# Check current instances
flyctl scale show -a maishapoa-production-internal-api

# If you see instances in both nrt and fra, scale down nrt
flyctl scale count 0 --region nrt -a maishapoa-production-internal-api
```

#### Step 3: Test and Verify

```bash
# Test new app
curl https://maishapoa-production-internal-api.fly.dev/api/health

# Check logs
flyctl logs -a maishapoa-production-internal-api
```

#### Step 4: Destroy Old App (After Verification)

```bash
# Once verified, destroy old app
flyctl apps destroy microbima-production-internal-api
```

---

## Staging Migration

Before migrating production, test the process with staging apps:

```bash
# If your staging apps are also in Tokyo, migrate them first:

# 1. Destroy and recreate (or just deploy with updated fly.toml)
flyctl deploy -a maishapoa-staging-internal-api \
  -c infra/fly/internal-api/staging/fly.toml

# The fly.toml now has primary_region = "fra"
# Fly.io will automatically use the new region

# 2. Verify
curl https://maishapoa-staging-internal-api.fly.dev/api/health
```

---

## DNS and URL Considerations

**Good News**: Fly.io handles DNS automatically!

- Old URLs: `https://microbima-production-internal-api.fly.dev`
- New URLs: `https://maishapoa-production-internal-api.fly.dev`

**Action Items**:
- Update any external services pointing to old URLs
- Update documentation with new URLs
- Update environment variables in dependent services

---

## Rollback Plan

If something goes wrong during migration:

### If Old Apps Still Exist

```bash
# Scale up old app
flyctl scale count 2 -a microbima-production-internal-api

# Update DNS or routing to point back to old app
```

### If Old Apps Are Destroyed

```bash
# Recreate in Tokyo with old name (emergency only)
flyctl apps create microbima-production-internal-api --region nrt

# Restore secrets and deploy
flyctl secrets set DATABASE_URL="..." -a microbima-production-internal-api
flyctl deploy -a microbima-production-internal-api -c [old-config]
```

---

## Post-Migration Verification

After migration, verify:

### 1. Application Health

```bash
# All apps should return 200 OK
curl -f https://maishapoa-production-internal-api.fly.dev/api/health
curl -f https://maishapoa-production-agent-registration.fly.dev/
curl -f https://maishapoa-production-public-api.fly.dev/
```

### 2. Database Connectivity

```bash
# SSH into app and test DB connection
flyctl ssh console -a maishapoa-production-internal-api

# Inside container:
node -e "const db = require('./dist/database'); db.testConnection();"
```

### 3. Response Times

```bash
# Check response times from different locations
curl -w "@curl-format.txt" -o /dev/null -s \
  https://maishapoa-production-internal-api.fly.dev/api/health

# Create curl-format.txt:
cat > curl-format.txt <<EOF
    time_namelookup:  %{time_namelookup}s\n
       time_connect:  %{time_connect}s\n
    time_appconnect:  %{time_appconnect}s\n
   time_pretransfer:  %{time_pretransfer}s\n
      time_redirect:  %{time_redirect}s\n
 time_starttransfer:  %{time_starttransfer}s\n
                    ----------\n
         time_total:  %{time_total}s\n
EOF
```

### 4. Application Metrics

```bash
# Check metrics in Fly.io dashboard
flyctl dashboard -a maishapoa-production-internal-api

# Monitor CPU, Memory, Request counts
```

### 5. Logs Check

```bash
# Monitor logs for errors
flyctl logs -a maishapoa-production-internal-api --tail

# Look for:
# - Database connection errors
# - API errors
# - Timeout issues
```

---

## Expected Improvements

After migrating to Frankfurt, you should see:

| Metric | Before (Tokyo) | After (Frankfurt) | Improvement |
|--------|----------------|-------------------|-------------|
| EU Latency | ~250-300ms | ~20-50ms | **80-85% faster** |
| Africa Latency | ~300-400ms | ~100-150ms | **60-70% faster** |
| Capacity | 223 | 2831 | **12x more** |

---

## Troubleshooting

### App Won't Start in New Region

```bash
# Check logs
flyctl logs -a maishapoa-production-internal-api

# Common issues:
# - Missing secrets: flyctl secrets list -a [app-name]
# - Wrong Dockerfile path: Check fly.toml [build] section
# - Port mismatch: Verify PORT env var matches fly.toml
```

### Database Connection Issues

```bash
# Verify DATABASE_URL secret is set
flyctl secrets list -a maishapoa-production-internal-api

# Test connection
flyctl ssh console -a maishapoa-production-internal-api
> ping your-database-host.com
```

### High Latency Still Present

```bash
# Verify app is actually in Frankfurt
flyctl info -a maishapoa-production-internal-api | grep Region

# Should show: Region = fra

# If not, check fly.toml has:
# primary_region = "fra"
```

---

## Timeline Estimate

| Phase | Duration | Notes |
|-------|----------|-------|
| Preparation | 30 minutes | Export configs, secrets, backups |
| Create new apps | 5 minutes | Run flyctl commands |
| Configure secrets | 10 minutes | Set all secrets |
| Deploy apps | 15-20 minutes | Deploy all services |
| Verification | 30 minutes | Health checks, testing |
| Monitoring | 2 hours | Watch for issues |
| **Total** | **~3-4 hours** | With team on standby |

**Recommended**: Schedule a 4-hour maintenance window during low traffic.

---

## Communication Template

**Before Migration**:
```
Subject: Scheduled Maintenance - Server Region Migration

We will be migrating our servers to a new region to improve 
performance for our users. 

Date: [DATE]
Time: [TIME] - [TIME]
Expected downtime: ~30 minutes

What to expect:
- Brief service interruption during migration
- Faster response times after migration
- No data loss

We'll keep you updated throughout the process.
```

**After Migration**:
```
Subject: Migration Completed Successfully

Our server migration to Frankfurt is complete! 

Results:
✅ All services operational
✅ 80% faster response times for EU/Africa users
✅ Zero data loss

Thank you for your patience!
```

---

## Checklist

Use this checklist during migration:

### Pre-Migration
- [ ] Backup all data
- [ ] Export all secrets
- [ ] Document current configuration
- [ ] Notify team and users
- [ ] Schedule maintenance window

### Migration
- [ ] Destroy old apps
- [ ] Create new apps in Frankfurt
- [ ] Configure all secrets
- [ ] Deploy all services
- [ ] Verify deployments

### Post-Migration
- [ ] Health checks pass
- [ ] Database connections work
- [ ] Test critical user flows
- [ ] Monitor logs (no errors)
- [ ] Update documentation
- [ ] Notify users of completion

---

## Support

If you encounter issues during migration:

1. **Check logs**: `flyctl logs -a [app-name]`
2. **Fly.io status**: https://status.flyio.net
3. **Fly.io support**: https://community.fly.io
4. **Emergency rollback**: See "Rollback Plan" section above

---

## References

- Fly.io Regions: https://fly.io/docs/reference/regions/
- Fly.io Scaling: https://fly.io/docs/apps/scale-count/
- Fly.io Secrets: https://fly.io/docs/reference/secrets/


